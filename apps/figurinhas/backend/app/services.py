from __future__ import annotations

import io
import json
import shutil
import uuid
from collections import defaultdict
from datetime import datetime
from pathlib import Path

import fitz
from PIL import Image
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from .auto_detect import detect_sticker_rectangles
from .config import get_settings
from .custom_stickers import DEFAULT_CUSTOM_STICKER_PROMPT_TEMPLATE, generate_custom_sticker_render
from .models import (
    Album,
    Collection,
    CollectionStatus,
    CustomProfileType,
    Export,
    Page,
    PrintOrder,
    PrintOrderStatus,
    PrintServiceType,
    ServiceSettings,
    Sticker,
    StickerCategory,
    StickerSourceType,
)
from .name_ocr import detect_sticker_name


settings = get_settings()

CUSTOM_BASE_FIELD_BY_PROFILE: dict[CustomProfileType, str] = {
    CustomProfileType.HOMEM: "custom_base_homem_path",
    CustomProfileType.MULHER: "custom_base_mulher_path",
    CustomProfileType.MENINO: "custom_base_menino_path",
    CustomProfileType.MENINA: "custom_base_menina_path",
}


def slugify(value: str) -> str:
    normalized = "".join(char.lower() if char.isalnum() else "-" for char in value.strip())
    collapsed = "-".join(part for part in normalized.split("-") if part)
    return collapsed[:150] or "colecao"


def album_sort_key(album: Album) -> tuple[int, str, int]:
    return (album.sort_order, album.name.lower(), album.id)


def collection_sort_key(collection: Collection) -> tuple[int, str, int]:
    return (collection.sort_order, collection.name.lower(), collection.id)


def is_visible_collection(collection: Collection) -> bool:
    return not collection.is_system


def ensure_collection_slug_unique(db: Session, slug: str, excluding_id: int | None = None) -> None:
    statement = select(Collection).where(Collection.slug == slug)
    if excluding_id is not None:
        statement = statement.where(Collection.id != excluding_id)
    exists = db.execute(statement).scalar_one_or_none()
    if exists:
        raise ValueError("Ja existe uma colecao com esse slug.")


def ensure_album_slug_unique(db: Session, slug: str, excluding_id: int | None = None) -> None:
    statement = select(Album).where(Album.slug == slug)
    if excluding_id is not None:
        statement = statement.where(Album.id != excluding_id)
    exists = db.execute(statement).scalar_one_or_none()
    if exists:
        raise ValueError("Ja existe um album com esse slug.")


def album_stats(db: Session, album_ids: list[int]) -> dict[int, dict[str, int]]:
    if not album_ids:
        return {}

    collection_counts = {
        row.album_id: row.total
        for row in db.execute(
            select(Collection.album_id, func.count(Collection.id).label("total"))
            .where(Collection.album_id.in_(album_ids), Collection.is_system.is_(False))
            .group_by(Collection.album_id)
        )
        if row.album_id is not None
    }
    published_collection_counts = {
        row.album_id: row.total
        for row in db.execute(
            select(Collection.album_id, func.count(Collection.id).label("total"))
            .where(
                Collection.album_id.in_(album_ids),
                Collection.status == CollectionStatus.PUBLICADA,
                Collection.is_system.is_(False),
            )
            .group_by(Collection.album_id)
        )
        if row.album_id is not None
    }
    return {
        album_id: {
            "collections": collection_counts.get(album_id, 0),
            "published_collections": published_collection_counts.get(album_id, 0),
        }
        for album_id in album_ids
    }


def collection_stats(db: Session, collection_ids: list[int]) -> dict[int, dict[str, int]]:
    if not collection_ids:
        return {}
    sticker_counts = {
        row.collection_id: row.total
        for row in db.execute(
            select(Sticker.collection_id, func.count(Sticker.id).label("total"))
            .where(Sticker.collection_id.in_(collection_ids))
            .group_by(Sticker.collection_id)
        )
    }
    page_counts = {
        row.collection_id: row.total
        for row in db.execute(
            select(Page.collection_id, func.count(Page.id).label("total"))
            .where(Page.collection_id.in_(collection_ids))
            .group_by(Page.collection_id)
        )
    }
    return {
        collection_id: {
            "stickers": sticker_counts.get(collection_id, 0),
            "pages": page_counts.get(collection_id, 0),
        }
        for collection_id in collection_ids
    }


def ensure_default_album_assignments(db: Session) -> None:
    collections_without_album = db.execute(
        select(Collection).where(Collection.album_id.is_(None)).order_by(Collection.created_at.asc(), Collection.id.asc())
    ).scalars().all()
    if collections_without_album:
        default_album = db.execute(select(Album).where(Album.slug == "acervo-atual")).scalar_one_or_none()
        if not default_album:
            default_album = Album(
                name="Acervo atual",
                slug="acervo-atual",
                description="Album criado automaticamente para colecoes existentes.",
            )
            db.add(default_album)
            db.flush()
        for collection in collections_without_album:
            collection.album = default_album

    orders_without_album = db.execute(
        select(PrintOrder)
        .options(selectinload(PrintOrder.collection), selectinload(PrintOrder.collection).selectinload(Collection.album))
        .where(PrintOrder.album_id.is_(None))
    ).scalars().all()
    for order in orders_without_album:
        if order.collection and order.collection.album_id:
            order.album_id = order.collection.album_id
            order.album_name = order.collection.album.name if order.collection.album else None


def clear_collection_rendered_files(collection: Collection) -> None:
    for branch in ("pages", "crops", "exports"):
        target = settings.storage_root / branch / collection.slug
        if target.exists():
            shutil.rmtree(target, ignore_errors=True)


def save_pdf_and_render_pages(collection: Collection, upload_name: str, upload_bytes: bytes, db: Session) -> None:
    clear_collection_rendered_files(collection)
    pdf_dir = settings.storage_root / "originals" / collection.slug
    pdf_dir.mkdir(parents=True, exist_ok=True)
    pdf_path = pdf_dir / f"{collection.slug}.pdf"
    pdf_path.write_bytes(upload_bytes)

    collection.source_pdf_path = str(pdf_path.relative_to(settings.storage_root).as_posix())
    collection.pages.clear()
    collection.stickers.clear()
    collection.exports.clear()
    db.flush()

    pages_dir = settings.storage_root / "pages" / collection.slug
    pages_dir.mkdir(parents=True, exist_ok=True)

    with fitz.open(pdf_path) as document:
        for page_index in range(document.page_count):
            page = document.load_page(page_index)
            pixmap = page.get_pixmap(matrix=fitz.Matrix(settings.render_scale, settings.render_scale), alpha=False)
            image_path = pages_dir / f"page-{page_index + 1}.png"
            pixmap.save(image_path)
            with Image.open(image_path) as image:
                width, height = image.size
            db.add(
                Page(
                    collection=collection,
                    page_number=page_index + 1,
                    image_path=str(image_path.relative_to(settings.storage_root).as_posix()),
                    width=width,
                    height=height,
                )
            )
    db.flush()


def validate_sticker_bounds(x_ratio: float, y_ratio: float, width_ratio: float, height_ratio: float) -> None:
    if x_ratio + width_ratio > 1:
        raise ValueError("A largura do recorte ultrapassa os limites da pagina.")
    if y_ratio + height_ratio > 1:
        raise ValueError("A altura do recorte ultrapassa os limites da pagina.")


def crop_sticker_image(sticker: Sticker, page_image: Image.Image | None = None) -> None:
    collection_slug = sticker.collection.slug
    page_image_path = settings.storage_root / sticker.page.image_path
    if page_image is None:
        if not page_image_path.exists():
            raise FileNotFoundError("Imagem da pagina nao encontrada.")
        with Image.open(page_image_path) as opened_page_image:
            _crop_sticker_image_from_page(sticker, opened_page_image, collection_slug)
    else:
        _crop_sticker_image_from_page(sticker, page_image, collection_slug)


def _crop_sticker_image_from_page(sticker: Sticker, page_image: Image.Image, collection_slug: str) -> None:
    width, height = page_image.size
    left = max(0, int(round(sticker.x_ratio * width)))
    top = max(0, int(round(sticker.y_ratio * height)))
    right = min(width, int(round((sticker.x_ratio + sticker.width_ratio) * width)))
    bottom = min(height, int(round((sticker.y_ratio + sticker.height_ratio) * height)))
    if right <= left or bottom <= top:
        raise ValueError("Area de recorte invalida.")

    crop = page_image.crop((left, top, right, bottom))
    crops_dir = settings.storage_root / "crops" / collection_slug
    crops_dir.mkdir(parents=True, exist_ok=True)
    file_name = f"sticker-{sticker.id}.png"
    crop_path = crops_dir / file_name
    crop.save(crop_path, optimize=True)

    relative = str(crop_path.relative_to(settings.storage_root).as_posix())
    sticker.crop_path = relative
    sticker.preview_path = relative


def refresh_sticker_ocr(sticker: Sticker, update_name: bool = False) -> None:
    if not sticker.crop_path:
        return

    crop_path = settings.storage_root / sticker.crop_path
    result = detect_sticker_name(crop_path)
    sticker.ocr_name_raw = result.raw_text
    sticker.ocr_name_suggested = result.suggested_name
    sticker.ocr_confidence = result.confidence
    sticker.ocr_processed_at = datetime.utcnow()

    if update_name and result.suggested_name and (result.confidence is None or result.confidence >= 75):
        sticker.name = result.suggested_name


def get_or_create_service_settings(db: Session) -> ServiceSettings:
    settings_record = db.get(ServiceSettings, 1)
    if settings_record:
        return settings_record

    settings_record = ServiceSettings(
        id=1,
        service_enabled=settings.default_service_enabled,
        donation_enabled=settings.default_donation_enabled,
        pack_size=settings.default_pack_size,
        print_price_cents=settings.default_print_price_cents,
        pack_price_cents=settings.default_pack_price_cents,
        pix_key=settings.default_pix_key or None,
        pix_holder=settings.default_pix_holder or None,
        donation_message=settings.default_donation_message or None,
        pickup_note=settings.default_pickup_note or None,
        custom_prompt_template=DEFAULT_CUSTOM_STICKER_PROMPT_TEMPLATE,
    )
    db.add(settings_record)
    db.flush()
    return settings_record


def get_custom_base_relative_path(service_settings: ServiceSettings, profile_type: CustomProfileType) -> str | None:
    field_name = CUSTOM_BASE_FIELD_BY_PROFILE[profile_type]
    return getattr(service_settings, field_name, None)


def get_custom_base_file_path(service_settings: ServiceSettings, profile_type: CustomProfileType) -> Path | None:
    relative_path = get_custom_base_relative_path(service_settings, profile_type)
    if not relative_path:
        return None
    file_path = settings.storage_root / relative_path
    return file_path if file_path.exists() else None


def save_custom_base_image(
    service_settings: ServiceSettings,
    *,
    profile_type: CustomProfileType,
    upload_bytes: bytes,
    original_name: str,
) -> str:
    with Image.open(io.BytesIO(upload_bytes)) as raw_image:
        image = raw_image.convert("RGBA")

    target_dir = settings.storage_root / "custom_bases"
    target_dir.mkdir(parents=True, exist_ok=True)
    file_name = f"{profile_type.value.lower()}-{uuid.uuid4().hex[:10]}.png"
    file_path = target_dir / file_name
    image.save(file_path, format="PNG", optimize=True)

    field_name = CUSTOM_BASE_FIELD_BY_PROFILE[profile_type]
    previous_relative_path = getattr(service_settings, field_name, None)
    if previous_relative_path:
        previous_path = settings.storage_root / previous_relative_path
        if previous_path.exists():
            previous_path.unlink(missing_ok=True)

    relative_path = str(file_path.relative_to(settings.storage_root).as_posix())
    setattr(service_settings, field_name, relative_path)
    return relative_path


def delete_custom_base_image(service_settings: ServiceSettings, profile_type: CustomProfileType) -> None:
    field_name = CUSTOM_BASE_FIELD_BY_PROFILE[profile_type]
    previous_relative_path = getattr(service_settings, field_name, None)
    if previous_relative_path:
        previous_path = settings.storage_root / previous_relative_path
        if previous_path.exists():
            previous_path.unlink(missing_ok=True)
    setattr(service_settings, field_name, None)


def delete_sticker_assets(sticker: Sticker) -> None:
    for relative_path in {
        sticker.crop_path,
        sticker.preview_path,
        sticker.uploaded_photo_path,
        sticker.generated_portrait_path,
    }:
        if not relative_path:
            continue
        file_path = settings.storage_root / relative_path
        if file_path.exists():
            file_path.unlink(missing_ok=True)


def delete_sticker_record(db: Session, sticker: Sticker) -> None:
    delete_sticker_assets(sticker)
    db.delete(sticker)


def auto_detect_collection_pages(
    db: Session,
    collection: Collection,
    target_pages: list[Page],
    replace_existing: bool = True,
) -> dict:
    results: list[dict] = []
    total_detected = 0
    total_replaced = 0

    pages_by_id = {page.id: page for page in target_pages}

    for page in sorted(target_pages, key=lambda current: current.page_number):
        existing_stickers = db.execute(
            select(Sticker)
            .options(selectinload(Sticker.collection), selectinload(Sticker.page))
            .where(Sticker.page_id == page.id)
            .order_by(Sticker.sort_order.asc(), Sticker.id.asc())
        ).scalars().all()
        replaced_count = len(existing_stickers) if replace_existing else 0

        detection = detect_sticker_rectangles(settings.storage_root / page.image_path)
        if detection.status != "detected":
            results.append(
                {
                    "page_id": page.id,
                    "page_number": page.page_number,
                    "status": detection.status,
                    "template": detection.template,
                    "reason": detection.reason,
                    "detected_count": 0,
                    "replaced_count": 0,
                }
            )
            continue

        if replace_existing:
            for sticker in existing_stickers:
                delete_sticker_record(db, sticker)
            db.flush()

        current_max_order = db.execute(
            select(func.max(Sticker.sort_order)).where(Sticker.collection_id == collection.id)
        ).scalar_one()
        next_sort_order = (current_max_order or 0) + 1
        detected_stickers: list[Sticker] = []

        for index, rectangle in enumerate(detection.rectangles, start=1):
            sticker = Sticker(
                collection=collection,
                page=pages_by_id[page.id],
                name=f"Figurinha {page.page_number:02d}-{index:02d}",
                code=f"auto-p{page.page_number:02d}-{index:02d}",
                category=rectangle.category,
                sort_order=next_sort_order,
                x_ratio=rectangle.x_ratio,
                y_ratio=rectangle.y_ratio,
                width_ratio=rectangle.width_ratio,
                height_ratio=rectangle.height_ratio,
                active=True,
                detected_automatically=True,
                preview_path="",
                crop_path="",
            )
            next_sort_order += 1
            db.add(sticker)
            detected_stickers.append(sticker)

        if detected_stickers:
            db.flush()
            page_image_path = settings.storage_root / page.image_path
            if not page_image_path.exists():
                raise FileNotFoundError("Imagem da pagina nao encontrada.")
            with Image.open(page_image_path) as page_image:
                for sticker in detected_stickers:
                    crop_sticker_image(sticker, page_image=page_image)
            for sticker in detected_stickers:
                refresh_sticker_ocr(sticker, update_name=True)

        detected_count = len(detection.rectangles)
        total_detected += detected_count
        total_replaced += replaced_count
        results.append(
            {
                "page_id": page.id,
                "page_number": page.page_number,
                "status": detection.status,
                "template": detection.template,
                "reason": detection.reason,
                "detected_count": detected_count,
                "replaced_count": replaced_count,
            }
        )

    return {
        "detected_count": total_detected,
        "replaced_count": total_replaced,
        "page_results": results,
    }


def load_generated_sticker_for_session(db: Session, album_id: int, session_token: str) -> Sticker | None:
    if not session_token.strip():
        return None
    return (
        db.execute(
            select(Sticker)
            .join(Collection, Sticker.collection_id == Collection.id)
            .options(selectinload(Sticker.collection), selectinload(Sticker.page))
            .where(
                Collection.album_id == album_id,
                Collection.is_system.is_(True),
                Sticker.source_type == StickerSourceType.GENERATED,
                Sticker.session_token == session_token.strip(),
                Sticker.active.is_(True),
            )
            .order_by(Sticker.updated_at.desc(), Sticker.id.desc())
        )
        .scalars()
        .first()
    )


def delete_generated_stickers_for_session(db: Session, album_id: int, session_token: str) -> None:
    stickers = db.execute(
        select(Sticker)
        .join(Collection, Sticker.collection_id == Collection.id)
        .options(selectinload(Sticker.collection), selectinload(Sticker.page))
        .where(
            Collection.album_id == album_id,
            Collection.is_system.is_(True),
            Sticker.source_type == StickerSourceType.GENERATED,
            Sticker.session_token == session_token.strip(),
        )
    ).scalars().all()
    for sticker in stickers:
        delete_sticker_record(db, sticker)
    db.flush()


def resolve_generated_template_sticker(db: Session, album: Album) -> Sticker:
    stickers = db.execute(
        select(Sticker)
        .join(Collection, Sticker.collection_id == Collection.id)
        .options(selectinload(Sticker.collection), selectinload(Sticker.page))
        .where(
            Collection.album_id == album.id,
            Collection.is_system.is_(False),
            Collection.status == CollectionStatus.PUBLICADA,
            Sticker.active.is_(True),
            Sticker.source_type == StickerSourceType.PDF,
        )
        .order_by(Collection.sort_order.asc(), Collection.name.asc(), Sticker.sort_order.asc(), Sticker.id.asc())
    ).scalars().all()
    if not stickers:
        raise ValueError("Publique pelo menos uma selecao com figurinhas antes de criar a Minha Figurinha.")

    preferred_categories = {
        StickerCategory.JOGADOR,
        StickerCategory.GOLEIRO,
        StickerCategory.DEFESA,
        StickerCategory.MEIO,
        StickerCategory.ATAQUE,
    }
    for sticker in stickers:
        if sticker.category in preferred_categories:
            return sticker
    return stickers[0]


def ensure_generated_collection_page(
    db: Session,
    album: Album,
    template_sticker: Sticker,
) -> tuple[Collection, Page]:
    generated_slug = slugify(f"{album.slug}-minha-figurinha")
    collection = db.execute(
        select(Collection)
        .options(selectinload(Collection.pages))
        .where(Collection.album_id == album.id, Collection.slug == generated_slug)
    ).scalar_one_or_none()
    if not collection:
        collection = Collection(
            album=album,
            name="Minha Figurinha",
            slug=generated_slug,
            description="Colecao interna para figurinhas personalizadas por sessao.",
            sort_order=9999,
            is_system=True,
            status=CollectionStatus.RASCUNHO,
        )
        db.add(collection)
        db.flush()

    page = next((current for current in collection.pages if current.page_number == 1), None)
    if page is None:
        page = Page(collection=collection, page_number=1, image_path="", width=template_sticker.page.width, height=template_sticker.page.height)
        db.add(page)
        db.flush()

    regenerate_page_image = (
        page.width != template_sticker.page.width
        or page.height != template_sticker.page.height
    )
    page.width = template_sticker.page.width
    page.height = template_sticker.page.height

    page_dir = settings.storage_root / "pages" / collection.slug
    page_dir.mkdir(parents=True, exist_ok=True)
    page_path = page_dir / "page-1.png"
    if not page_path.exists() or regenerate_page_image:
        Image.new("RGB", (template_sticker.page.width, template_sticker.page.height), "#ffffff").save(page_path, optimize=True)
    page.image_path = str(page_path.relative_to(settings.storage_root).as_posix())
    db.flush()
    return collection, page


def upsert_generated_sticker(
    db: Session,
    *,
    album: Album,
    session_token: str,
    name: str,
    profile_type: CustomProfileType,
    birth_date_text: str | None,
    height_text: str | None,
    weight_text: str | None,
    city_or_team: str | None,
    uploaded_photo_bytes: bytes,
) -> Sticker:
    session_token = session_token.strip()
    if not session_token:
        raise ValueError("Sessao invalida para criar a figurinha personalizada.")

    service_settings = get_or_create_service_settings(db)
    template_sticker = resolve_generated_template_sticker(db, album)
    collection, page = ensure_generated_collection_page(db, album, template_sticker)
    delete_generated_stickers_for_session(db, album.id, session_token)

    if not template_sticker.collection.source_pdf_path:
        raise ValueError("A selecao base desse album ainda nao tem PDF de origem configurado.")
    source_pdf_path = settings.storage_root / template_sticker.collection.source_pdf_path
    with fitz.open(source_pdf_path) as document:
        page_rect = document.load_page(template_sticker.page.page_number - 1).rect
        export_width_pt = float(page_rect.width * template_sticker.width_ratio)
        export_height_pt = float(page_rect.height * template_sticker.height_ratio)

    scale = max(settings.export_render_scale, 6.0)
    width_px = max(int(round(export_width_pt * scale)), 680)
    height_px = max(int(round(export_height_pt * scale)), 920)

    render = generate_custom_sticker_render(
        settings,
        uploaded_photo_bytes=uploaded_photo_bytes,
        name=name.strip(),
        profile_type=profile_type.value,
        birth_date_text=(birth_date_text or "").strip() or None,
        height_text=(height_text or "").strip() or None,
        weight_text=(weight_text or "").strip() or None,
        city_or_team=(city_or_team or "").strip() or None,
        target_width_px=width_px,
        target_height_px=height_px,
        base_template_path=get_custom_base_file_path(service_settings, profile_type),
        prompt_template=service_settings.custom_prompt_template,
    )

    upload_dir = settings.storage_root / "custom_uploads" / album.slug
    portrait_dir = settings.storage_root / "custom_portraits" / album.slug
    sticker_dir = settings.storage_root / "custom_stickers" / album.slug
    upload_dir.mkdir(parents=True, exist_ok=True)
    portrait_dir.mkdir(parents=True, exist_ok=True)
    sticker_dir.mkdir(parents=True, exist_ok=True)

    asset_key = uuid.uuid4().hex[:10]
    upload_path = upload_dir / f"{asset_key}-upload.png"
    portrait_path = portrait_dir / f"{asset_key}-portrait.png"
    sticker_path = sticker_dir / f"{asset_key}-sticker.png"
    upload_path.write_bytes(uploaded_photo_bytes)
    portrait_path.write_bytes(render.portrait_bytes)
    sticker_path.write_bytes(render.final_bytes)

    current_max_order = db.execute(
        select(func.max(Sticker.sort_order)).where(Sticker.collection_id == collection.id)
    ).scalar_one()

    sticker = Sticker(
        collection=collection,
        page=page,
        name=name.strip(),
        code=f"minha-figurinha-{asset_key}",
        category=StickerCategory.JOGADOR,
        source_type=StickerSourceType.GENERATED,
        session_token=session_token,
        profile_type=profile_type,
        birth_date_text=(birth_date_text or "").strip() or None,
        height_text=(height_text or "").strip() or None,
        weight_text=(weight_text or "").strip() or None,
        city_or_team=(city_or_team or "").strip() or None,
        uploaded_photo_path=str(upload_path.relative_to(settings.storage_root).as_posix()),
        generated_portrait_path=str(portrait_path.relative_to(settings.storage_root).as_posix()),
        export_width_pt=export_width_pt,
        export_height_pt=export_height_pt,
        sort_order=(current_max_order or 0) + 1,
        x_ratio=template_sticker.x_ratio,
        y_ratio=template_sticker.y_ratio,
        width_ratio=template_sticker.width_ratio,
        height_ratio=template_sticker.height_ratio,
        preview_path=str(sticker_path.relative_to(settings.storage_root).as_posix()),
        crop_path=str(sticker_path.relative_to(settings.storage_root).as_posix()),
        active=True,
        detected_automatically=False,
    )
    db.add(sticker)
    db.flush()
    return sticker


def prepare_export_plan(album: Album, stickers: list[Sticker], db: Session) -> dict:
    if not stickers:
        raise ValueError("Selecione pelo menos uma figurinha para exportar.")

    selected_collection_ids = sorted({sticker.collection_id for sticker in stickers})
    collections = db.execute(
        select(Collection)
        .options(selectinload(Collection.pages))
        .where(Collection.id.in_(selected_collection_ids))
    ).scalars().all()
    collections_by_id = {collection.id: collection for collection in collections}
    template_collections = db.execute(
        select(Collection)
        .options(selectinload(Collection.pages))
        .where(
            Collection.album_id == album.id,
            Collection.is_system.is_(False),
            Collection.status == CollectionStatus.PUBLICADA,
        )
    ).scalars().all()

    source_pdf_paths: dict[int, Path] = {}
    page_sizes_by_collection: dict[int, dict[int, tuple[float, float]]] = {}
    template_layouts: dict[tuple[float, float], dict] = {}

    def resolve_page_sizes(collection: Collection) -> dict[int, tuple[float, float]]:
        if collection.source_pdf_path:
            source_pdf_path = settings.storage_root / collection.source_pdf_path
            if not source_pdf_path.exists():
                raise FileNotFoundError(f"PDF de origem da colecao {collection.name} nao encontrado.")
            source_pdf_paths[collection.id] = source_pdf_path
            with fitz.open(source_pdf_path) as document:
                return {
                    page_index + 1: (
                        float(document.load_page(page_index).rect.width),
                        float(document.load_page(page_index).rect.height),
                    )
                    for page_index in range(document.page_count)
                }
        return {
            page.page_number: (float(page.width), float(page.height))
            for page in collection.pages
        }

    for collection in collections:
        if collection.album_id != album.id:
            raise ValueError("Nao e possivel misturar figurinhas de albuns diferentes.")
        page_sizes_by_collection[collection.id] = resolve_page_sizes(collection)

    if not template_collections:
        raise ValueError("Nao existe uma selecao publicada para servir de base de exportacao nesse album.")

    for collection in template_collections:
        page_sizes = resolve_page_sizes(collection)
        template_stickers = db.execute(
            select(Sticker)
            .options(selectinload(Sticker.page))
            .where(
                Sticker.collection_id == collection.id,
                Sticker.active.is_(True),
                Sticker.source_type == StickerSourceType.PDF,
            )
            .order_by(Sticker.sort_order.asc(), Sticker.id.asc())
        ).scalars().all()

        for size_key, layout in _build_template_export_layouts(template_stickers, page_sizes).items():
            template_layouts.setdefault(size_key, layout)

    if not template_layouts:
        raise ValueError("Nao foi encontrada uma grade valida de exportacao para esse album.")

    for sticker in stickers:
        if sticker.source_type == StickerSourceType.PDF and sticker.collection_id not in source_pdf_paths:
            raise ValueError(f"A colecao {sticker.collection.name} nao possui PDF de origem para exportacao.")

    selected_groups: dict[tuple[float, float], list[Sticker]] = defaultdict(list)
    for sticker in stickers:
        selected_groups[_sticker_size_key(sticker, page_sizes_by_collection)].append(sticker)

    batches: list[dict] = []
    for group_key, group_stickers in selected_groups.items():
        layout = template_layouts.get(group_key)
        if not layout or not layout["slots"]:
            raise ValueError("Nao foi possivel montar um template de exportacao para esse conjunto de figurinhas.")

        slots = layout["slots"]
        slots_per_page = len(slots)
        if slots_per_page <= 0:
            raise ValueError("Template de exportacao invalido para esse conjunto de figurinhas.")

        ordered_group = sorted(
            group_stickers,
            key=lambda current: (
                1 if current.source_type == StickerSourceType.GENERATED else 0,
                collections_by_id[current.collection_id].name.lower(),
                current.sort_order,
                current.name.lower(),
                current.id,
            ),
        )

        for offset in range(0, len(ordered_group), slots_per_page):
            batch = ordered_group[offset : offset + slots_per_page]
            batches.append(
                {
                    "page_size": layout["page_size"],
                    "placements": list(zip(slots, batch, strict=False)),
                }
            )

    return {
        "source_pdf_paths": source_pdf_paths,
        "page_sizes_by_collection": page_sizes_by_collection,
        "batches": batches,
        "sheet_count": len(batches),
    }


def build_export_pdf(album: Album, stickers: list[Sticker], db: Session, plan: dict | None = None) -> Export:
    export_dir = settings.storage_root / "exports" / album.slug
    export_dir.mkdir(parents=True, exist_ok=True)
    export_key = f"{datetime.utcnow():%Y%m%d-%H%M%S}-{uuid.uuid4().hex[:8]}"
    export_path = export_dir / f"{album.slug}-{export_key}.pdf"

    plan = plan or prepare_export_plan(album, stickers, db)
    page_sizes_by_collection = plan["page_sizes_by_collection"]
    batches = plan["batches"]
    initial_page_size = batches[0]["page_size"] if batches else (595.2756, 841.8898)

    documents: dict[int, fitz.Document] = {}
    try:
        pdf = canvas.Canvas(str(export_path), pagesize=initial_page_size)
        pdf.setTitle(f"{album.name} - figurinhas selecionadas")

        is_first_page = True
        for batch in batches:
            page_width, page_height = batch["page_size"]
            if not is_first_page:
                pdf.showPage()
            pdf.setPageSize((page_width, page_height))

            for slot, sticker in batch["placements"]:
                image_bytes = _render_sticker_export_image(
                    documents,
                    plan["source_pdf_paths"],
                    sticker,
                    page_sizes_by_collection,
                )
                x_position = slot["x_pt"]
                y_position = page_height - slot["y_pt"] - slot["height_pt"]
                pdf.drawImage(
                    ImageReader(io.BytesIO(image_bytes)),
                    x_position,
                    y_position,
                    width=slot["width_pt"],
                    height=slot["height_pt"],
                    preserveAspectRatio=False,
                    mask="auto",
                )

            is_first_page = False

        pdf.save()
    finally:
        for document in documents.values():
            document.close()

    primary_collection = next((sticker.collection for sticker in stickers if not sticker.collection.is_system), stickers[0].collection)
    export_record = Export(
        collection=primary_collection,
        file_path=str(export_path.relative_to(settings.storage_root).as_posix()),
        item_count=len(stickers),
    )
    db.add(export_record)
    db.flush()
    return export_record


def build_order_quote(album: Album, stickers: list[Sticker], db: Session, service_settings: ServiceSettings) -> dict:
    plan = prepare_export_plan(album, stickers, db)
    item_count = len(stickers)
    sheet_count = plan["sheet_count"]
    pack_size = service_settings.pack_size
    pack_remainder = item_count % pack_size
    pack_eligible = pack_remainder == 0
    pack_count = item_count // pack_size if pack_eligible else 0
    print_total_cents = sheet_count * service_settings.print_price_cents
    pack_total_cents = (
        print_total_cents + (pack_count * service_settings.pack_price_cents)
        if pack_eligible
        else None
    )

    return {
        "plan": plan,
        "service_enabled": service_settings.service_enabled,
        "item_count": item_count,
        "sheet_count": sheet_count,
        "pack_size": pack_size,
        "print_price_cents": service_settings.print_price_cents,
        "pack_price_cents": service_settings.pack_price_cents,
        "print_total_cents": print_total_cents,
        "pack_count": pack_count,
        "pack_total_cents": pack_total_cents,
        "pack_eligible": pack_eligible,
        "pack_remainder": pack_remainder,
        "pix_key": service_settings.pix_key,
        "pix_holder": service_settings.pix_holder,
        "pickup_note": service_settings.pickup_note,
    }


def create_print_order(
    db: Session,
    album: Album,
    stickers: list[Sticker],
    service_type: PrintServiceType,
    customer_name: str,
    customer_whatsapp: str,
    customer_nickname: str | None,
    notes: str | None,
    service_settings: ServiceSettings,
) -> PrintOrder:
    if not service_settings.service_enabled:
        raise ValueError("O servico de impressao ainda nao esta disponivel.")
    if service_settings.print_price_cents <= 0:
        raise ValueError("Configure o preco por folha antes de receber pedidos.")
    if not (service_settings.pix_key or "").strip():
        raise ValueError("Configure a chave Pix antes de receber pedidos.")

    quote = build_order_quote(album, stickers, db, service_settings)
    total_price_cents = quote["print_total_cents"]
    pack_count = 0
    pack_price_cents = 0

    if service_type == PrintServiceType.IMPRESSAO_PACOTINHOS:
        if not quote["pack_eligible"]:
            raise ValueError(
                f"Pacotinhos sao montados com {quote['pack_size']} figurinhas. Ajuste a selecao para um multiplo desse valor."
            )
        if service_settings.pack_price_cents <= 0:
            raise ValueError("Configure o preco dos pacotinhos antes de receber esse tipo de pedido.")
        pack_count = quote["pack_count"]
        pack_price_cents = service_settings.pack_price_cents
        total_price_cents = quote["pack_total_cents"] or total_price_cents

    export_record = build_export_pdf(album, stickers, db, plan=quote["plan"])
    selected_collection_names = sorted({sticker.collection.name for sticker in stickers}, key=str.lower)
    primary_collection = next((sticker.collection for sticker in stickers if not sticker.collection.is_system), stickers[0].collection)
    sticker_payload = json.dumps(
        [
            {
                "id": sticker.id,
                "collection_name": "Minha Figurinha" if sticker.source_type == StickerSourceType.GENERATED else sticker.collection.name,
                "name": sticker.name,
                "category": sticker.category.value,
                "page_number": sticker.page.page_number,
            }
            for sticker in stickers
        ],
        ensure_ascii=False,
    )

    order = PrintOrder(
        reference_code=f"PEND-{uuid.uuid4().hex[:10]}",
        album=album,
        album_name=album.name,
        collection=primary_collection,
        collection_name=primary_collection.name if len(selected_collection_names) == 1 else "Selecao mista",
        customer_name=customer_name.strip(),
        customer_whatsapp=customer_whatsapp.strip(),
        customer_nickname=(customer_nickname or "").strip() or None,
        notes=(notes or "").strip() or None,
        admin_notes=None,
        service_type=service_type,
        status=PrintOrderStatus.AGUARDANDO_PIX,
        item_count=quote["item_count"],
        sheet_count=quote["sheet_count"],
        pack_count=pack_count,
        pack_size=quote["pack_size"],
        print_price_cents=quote["print_price_cents"],
        pack_price_cents=pack_price_cents,
        total_price_cents=total_price_cents,
        export_file_path=export_record.file_path,
        sticker_payload=sticker_payload,
    )
    db.add(order)
    db.flush()
    order.reference_code = f"FG-{order.id:05d}"
    db.flush()
    return order


def _sticker_page_box_points(
    sticker: Sticker,
    page_sizes_by_collection: dict[int, dict[int, tuple[float, float]]],
) -> tuple[float, float, float, float, float, float]:
    page_width, page_height = page_sizes_by_collection[sticker.collection_id][sticker.page.page_number]
    x_pt = page_width * sticker.x_ratio
    y_pt = page_height * sticker.y_ratio
    width_pt = page_width * sticker.width_ratio
    height_pt = page_height * sticker.height_ratio
    return x_pt, y_pt, width_pt, height_pt, page_width, page_height


def _sticker_size_key(
    sticker: Sticker,
    page_sizes_by_collection: dict[int, dict[int, tuple[float, float]]],
) -> tuple[float, float]:
    if (
        sticker.source_type == StickerSourceType.GENERATED
        and sticker.export_width_pt is not None
        and sticker.export_height_pt is not None
    ):
        return round(sticker.export_width_pt), round(sticker.export_height_pt)
    _, _, width_pt, height_pt, _, _ = _sticker_page_box_points(sticker, page_sizes_by_collection)
    return round(width_pt), round(height_pt)


def _build_template_export_layouts(
    stickers: list[Sticker],
    page_sizes: dict[int, tuple[float, float]],
) -> dict[tuple[float, float], dict]:
    page_sizes_by_collection = {stickers[0].collection_id: page_sizes} if stickers else {}
    by_size: dict[tuple[float, float], list[Sticker]] = defaultdict(list)
    for sticker in stickers:
        by_size[_sticker_size_key(sticker, page_sizes_by_collection)].append(sticker)

    templates: dict[tuple[float, float], dict] = {}
    for size_key, group in by_size.items():
        by_page: dict[int, list[Sticker]] = defaultdict(list)
        for sticker in group:
            by_page[sticker.page.page_number].append(sticker)

        template_page_number, template_group = max(
            by_page.items(),
            key=lambda item: (len(item[1]), -item[0]),
        )
        page_width, page_height = page_sizes[template_page_number]
        slots = []
        for sticker in sorted(
            template_group,
            key=lambda current: (
                round(current.y_ratio, 6),
                round(current.x_ratio, 6),
                current.sort_order,
                current.id,
            ),
        ):
            x_pt, y_pt, width_pt, height_pt, _, _ = _sticker_page_box_points(sticker, page_sizes_by_collection)
            slots.append(
                {
                    "x_pt": x_pt,
                    "y_pt": y_pt,
                    "width_pt": width_pt,
                    "height_pt": height_pt,
                }
            )

        templates[size_key] = {
            "page_size": (page_width, page_height),
            "page_number": template_page_number,
            "slots": slots,
        }

    return templates


def _render_sticker_export_image(
    documents: dict[int, fitz.Document],
    source_pdf_paths: dict[int, Path],
    sticker: Sticker,
    page_sizes_by_collection: dict[int, dict[int, tuple[float, float]]],
) -> bytes:
    if sticker.source_type == StickerSourceType.GENERATED:
        sticker_file = settings.storage_root / sticker.crop_path
        if not sticker_file.exists():
            raise FileNotFoundError(f"Arquivo da figurinha personalizada {sticker.name} nao encontrado.")
        return sticker_file.read_bytes()

    document = documents.get(sticker.collection_id)
    if document is None:
        document = fitz.open(source_pdf_paths[sticker.collection_id])
        documents[sticker.collection_id] = document

    page = document.load_page(sticker.page.page_number - 1)
    x_pt, y_pt, width_pt, height_pt, _, _ = _sticker_page_box_points(sticker, page_sizes_by_collection)
    clip = fitz.Rect(x_pt, y_pt, x_pt + width_pt, y_pt + height_pt)
    pixmap = page.get_pixmap(matrix=fitz.Matrix(settings.export_render_scale, settings.export_render_scale), clip=clip, alpha=False)
    return pixmap.tobytes("png")


def load_collection_or_fail(db: Session, collection_id: int) -> Collection:
    statement = select(Collection).options(selectinload(Collection.album)).where(Collection.id == collection_id)
    collection = db.execute(statement).scalar_one_or_none()
    if not collection:
        raise LookupError("Colecao nao encontrada.")
    return collection


def load_collection_by_slug_or_fail(db: Session, slug: str, public_only: bool = False) -> Collection:
    statement = (
        select(Collection)
        .options(selectinload(Collection.album))
        .where(Collection.slug == slug, Collection.is_system.is_(False))
    )
    if public_only:
        statement = statement.where(Collection.status == CollectionStatus.PUBLICADA)
    collection = db.execute(statement).scalar_one_or_none()
    if not collection:
        raise LookupError("Colecao nao encontrada.")
    return collection


def load_album_or_fail(db: Session, album_id: int) -> Album:
    album = db.get(Album, album_id)
    if not album:
        raise LookupError("Album nao encontrado.")
    return album


def load_album_by_slug_or_fail(db: Session, slug: str) -> Album:
    album = db.execute(select(Album).where(Album.slug == slug)).scalar_one_or_none()
    if not album:
        raise LookupError("Album nao encontrado.")
    return album


def load_sticker_or_fail(db: Session, sticker_id: int) -> Sticker:
    statement = (
        select(Sticker)
        .options(selectinload(Sticker.collection), selectinload(Sticker.page))
        .where(Sticker.id == sticker_id)
    )
    sticker = db.execute(statement).scalar_one_or_none()
    if not sticker:
        raise LookupError("Figurinha nao encontrada.")
    return sticker


def load_print_order_or_fail(db: Session, order_id: int) -> PrintOrder:
    order = db.get(PrintOrder, order_id)
    if not order:
        raise LookupError("Pedido nao encontrado.")
    return order


def collection_to_response(collection: Collection, stats: dict[str, int]) -> dict:
    return {
        "id": collection.id,
        "album_id": collection.album_id,
        "album_name": collection.album.name if collection.album else None,
        "album_slug": collection.album.slug if collection.album else None,
        "name": collection.name,
        "slug": collection.slug,
        "description": collection.description,
        "sort_order": collection.sort_order,
        "status": collection.status,
        "source_pdf_path": collection.source_pdf_path,
        "created_at": collection.created_at,
        "updated_at": collection.updated_at,
        "sticker_count": stats.get("stickers", 0),
        "page_count": stats.get("pages", 0),
    }


def album_to_response(album: Album, stats: dict[str, int], collections: list[dict] | None = None) -> dict:
    return {
        "id": album.id,
        "name": album.name,
        "slug": album.slug,
        "description": album.description,
        "sort_order": album.sort_order,
        "created_at": album.created_at,
        "updated_at": album.updated_at,
        "collection_count": stats.get("collections", 0),
        "published_collection_count": stats.get("published_collections", 0),
        "collections": collections or [],
    }


def page_to_response(page: Page) -> dict:
    return {
        "id": page.id,
        "page_number": page.page_number,
        "image_path": page.image_path,
        "width": page.width,
        "height": page.height,
    }


def sticker_to_response(sticker: Sticker) -> dict:
    return {
        "id": sticker.id,
        "collection_id": sticker.collection_id,
        "page_id": sticker.page_id,
        "name": sticker.name,
        "code": sticker.code,
        "category": sticker.category,
        "source_type": sticker.source_type,
        "profile_type": sticker.profile_type,
        "birth_date_text": sticker.birth_date_text,
        "height_text": sticker.height_text,
        "weight_text": sticker.weight_text,
        "city_or_team": sticker.city_or_team,
        "sort_order": sticker.sort_order,
        "x_ratio": sticker.x_ratio,
        "y_ratio": sticker.y_ratio,
        "width_ratio": sticker.width_ratio,
        "height_ratio": sticker.height_ratio,
        "preview_path": sticker.preview_path,
        "crop_path": sticker.crop_path,
        "active": sticker.active,
        "detected_automatically": sticker.detected_automatically,
        "ocr_name_raw": sticker.ocr_name_raw,
        "ocr_name_suggested": sticker.ocr_name_suggested,
        "ocr_confidence": sticker.ocr_confidence,
        "ocr_processed_at": sticker.ocr_processed_at,
        "created_at": sticker.created_at,
        "updated_at": sticker.updated_at,
        "page_number": sticker.page.page_number,
    }


def service_settings_to_response(service_settings: ServiceSettings) -> dict:
    return {
        "service_enabled": service_settings.service_enabled,
        "donation_enabled": service_settings.donation_enabled,
        "pack_size": service_settings.pack_size,
        "print_price_cents": service_settings.print_price_cents,
        "pack_price_cents": service_settings.pack_price_cents,
        "pix_key": service_settings.pix_key,
        "pix_holder": service_settings.pix_holder,
        "donation_message": service_settings.donation_message,
        "pickup_note": service_settings.pickup_note,
        "custom_prompt_template": service_settings.custom_prompt_template or DEFAULT_CUSTOM_STICKER_PROMPT_TEMPLATE,
        "custom_base_homem_path": service_settings.custom_base_homem_path,
        "custom_base_mulher_path": service_settings.custom_base_mulher_path,
        "custom_base_menino_path": service_settings.custom_base_menino_path,
        "custom_base_menina_path": service_settings.custom_base_menina_path,
    }


def print_order_to_response(order: PrintOrder, service_settings: ServiceSettings | None = None) -> dict:
    try:
        selected_stickers = json.loads(order.sticker_payload)
    except json.JSONDecodeError:
        selected_stickers = []

    normalized_selected_stickers = []
    fallback_collection_name = order.collection_name or (order.collection.name if order.collection else None) or "Selecao"
    for sticker in selected_stickers:
        if not isinstance(sticker, dict):
            continue
        normalized_selected_stickers.append(
            {
                "id": sticker.get("id"),
                "collection_name": sticker.get("collection_name") or fallback_collection_name,
                "name": sticker.get("name") or "Figurinha",
                "category": sticker.get("category") or "JOGADOR",
                "page_number": sticker.get("page_number") or 1,
            }
        )

    response = {
        "id": order.id,
        "reference_code": order.reference_code,
        "album_id": order.album_id,
        "album_name": order.album_name,
        "collection_id": order.collection_id,
        "collection_name": order.collection_name,
        "customer_name": order.customer_name,
        "customer_whatsapp": order.customer_whatsapp,
        "customer_nickname": order.customer_nickname,
        "notes": order.notes,
        "admin_notes": order.admin_notes,
        "service_type": order.service_type,
        "status": order.status,
        "item_count": order.item_count,
        "sheet_count": order.sheet_count,
        "pack_count": order.pack_count,
        "pack_size": order.pack_size,
        "print_price_cents": order.print_price_cents,
        "pack_price_cents": order.pack_price_cents,
        "total_price_cents": order.total_price_cents,
        "export_download_path": f"/admin/orders/{order.id}/download",
        "selected_stickers": normalized_selected_stickers,
        "created_at": order.created_at,
        "updated_at": order.updated_at,
        "pix_key": service_settings.pix_key if service_settings else None,
        "pix_holder": service_settings.pix_holder if service_settings else None,
        "pickup_note": service_settings.pickup_note if service_settings else None,
    }
    return response
