from __future__ import annotations

import io
import base64
import json
import logging
import shutil
import tempfile
import time
import unicodedata
import uuid
from collections import defaultdict
from datetime import UTC, datetime
from pathlib import Path
from statistics import median
from threading import Lock
from typing import Callable

import fitz
from PIL import Image, ImageOps
import qrcode
from reportlab.lib.colors import HexColor
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas
from sqlalchemy import and_, exists, func, or_, select
from sqlalchemy.orm import Session, object_session, selectinload

from .auto_detect import detect_sticker_rectangles
from .config import get_settings
from .custom_stickers import DEFAULT_CUSTOM_STICKER_PROMPT_TEMPLATE, generate_custom_sticker_render
from .mercadopago import MercadoPagoError, MercadoPagoPixClient
from .models import (
    Album,
    Collection,
    CollectionExportMode,
    CollectionStatus,
    CollectionType,
    CustomCategoryType,
    CustomProfileType,
    CustomStickerUnlock,
    CustomStickerUnlockStatus,
    CustomStickerUnlockType,
    CustomStickerTemplate,
    CustomStickerTemplateLayer,
    CustomStickerTemplatePhotoSlot,
    CustomStickerTemplateTextSlot,
    CustomTemplateTextField,
    CustomTemplateCompositionMode,
    CustomTemplateLayerType,
    CustomPositionType,
    Export,
    Page,
    PageLayoutTemplate,
    PageLayoutTemplateBlock,
    PageSelectionBlock,
    PrintOrder,
    PrintOrderStatus,
    PrintServiceType,
    ServiceSettings,
    SourceDetectedSticker,
    SourceDetectedStickerStatus,
    SourceDocument,
    SourceDocumentPage,
    Sticker,
    StickerCategory,
    StickerSourceType,
    SourceDocumentStatus,
)
from .name_ocr import detect_sticker_name


settings = get_settings()
logger = logging.getLogger("uvicorn.error")
_template_export_layout_cache_lock = Lock()
_template_export_layout_cache: dict[int, dict] = {}
_source_document_layout_cache_lock = Lock()
_source_document_layout_cache: dict[int, dict] = {}
_collection_page_sizes_cache_lock = Lock()
_collection_page_sizes_cache: dict[int, dict] = {}
_extra_pdf_page_count_cache_lock = Lock()
_extra_pdf_page_count_cache: dict[int, dict] = {}


def _log_export_plan_performance(event: str, **fields) -> None:
    normalized_fields = " ".join(f"{key}={value}" for key, value in fields.items())
    logger.info("perf event=%s %s", event, normalized_fields)

CUSTOM_TEMPLATE_IMPORT_RULES: list[dict] = [
    {"keywords": ("fundo", "background", "bg", "base"), "layer_type": CustomTemplateLayerType.BACKGROUND, "label": "Fundo", "z_index": 0, "singleton": True},
    {"keywords": ("moldura", "frame", "recorte"), "layer_type": CustomTemplateLayerType.FRAME, "label": "Moldura", "z_index": 20, "singleton": True},
    {"keywords": ("camisa", "frontal", "frente", "shirt", "jersey", "uniforme"), "layer_type": CustomTemplateLayerType.PHOTO_FRONT, "label": "Camisa frontal", "z_index": 40, "singleton": True},
    {"keywords": ("faixa", "painel", "panel", "info", "infos", "dados", "footer"), "layer_type": CustomTemplateLayerType.INFO_PANEL, "label": "Faixa inferior", "z_index": 60, "singleton": True},
    {"keywords": ("brilho", "shine", "glow"), "layer_type": CustomTemplateLayerType.SHINE, "label": "Brilho", "z_index": 90, "singleton": True},
    {"keywords": ("overlay", "sobreposicao"), "layer_type": CustomTemplateLayerType.OVERLAY, "label": "Overlay", "z_index": 70, "singleton": False},
]
CUSTOM_TEMPLATE_REQUIRED_LAYER_TYPES: set[CustomTemplateLayerType] = {
    CustomTemplateLayerType.BACKGROUND,
    CustomTemplateLayerType.INFO_PANEL,
}
CUSTOM_TEMPLATE_REQUIRED_FOREGROUND_LAYER_TYPES: set[CustomTemplateLayerType] = {
    CustomTemplateLayerType.FRAME,
    CustomTemplateLayerType.PHOTO_FRONT,
    CustomTemplateLayerType.OVERLAY,
    CustomTemplateLayerType.SHINE,
}
CUSTOM_TEMPLATE_LAYER_LABELS: dict[CustomTemplateLayerType, str] = {
    CustomTemplateLayerType.BACKGROUND: "Fundo",
    CustomTemplateLayerType.FRAME: "Moldura",
    CustomTemplateLayerType.PHOTO_FRONT: "Camada frontal da foto",
    CustomTemplateLayerType.INFO_PANEL: "Faixa de informacoes",
    CustomTemplateLayerType.OVERLAY: "Overlay extra",
    CustomTemplateLayerType.SHINE: "Brilho/acabamento",
}


def normalize_custom_profile_type(profile_type: CustomProfileType | None) -> CustomProfileType | None:
    if profile_type in {CustomProfileType.MENINO, CustomProfileType.MENINA, CustomProfileType.CRIANCA}:
        return CustomProfileType.CRIANCA
    return profile_type


def custom_profile_type_values_for_match(profile_type: CustomProfileType) -> tuple[CustomProfileType, ...]:
    normalized = normalize_custom_profile_type(profile_type)
    if normalized == CustomProfileType.CRIANCA:
        return (CustomProfileType.CRIANCA, CustomProfileType.MENINO, CustomProfileType.MENINA)
    return (normalized,)


def photo_visibility_preset_for_template(template: CustomStickerTemplate) -> tuple[float, float, float, float]:
    if template.position_type == CustomPositionType.GOLEIRO:
        return (0.08, 0.0, 0.84, 0.76)
    if normalize_custom_profile_type(template.profile_type) == CustomProfileType.CRIANCA:
        return (0.09, 0.0, 0.82, 0.76)
    if template.profile_type == CustomProfileType.MULHER:
        return (0.09, 0.0, 0.82, 0.74)
    return (0.08, 0.0, 0.84, 0.74)


def photo_max_scale_preset_for_template(template: CustomStickerTemplate) -> float:
    if template.position_type == CustomPositionType.GOLEIRO:
        return 2.5
    if normalize_custom_profile_type(template.profile_type) == CustomProfileType.CRIANCA:
        return 2.35
    if template.profile_type == CustomProfileType.MULHER:
        return 2.4
    return 2.4

CUSTOM_BASE_FIELD_BY_PROFILE: dict[CustomProfileType, str] = {
    CustomProfileType.HOMEM: "custom_base_homem_path",
    CustomProfileType.MULHER: "custom_base_mulher_path",
    CustomProfileType.CRIANCA: "custom_base_menino_path",
    CustomProfileType.MENINO: "custom_base_menino_path",
    CustomProfileType.MENINA: "custom_base_menino_path",
}


def _sanitize_pix_field(value: str | None, *, max_length: int, fallback: str) -> str:
    normalized = unicodedata.normalize("NFD", (value or "").strip())
    ascii_only = "".join(char for char in normalized if unicodedata.category(char) != "Mn")
    cleaned = "".join(char for char in ascii_only.upper() if char.isalnum() or char in {" ", "-", "."}).strip()
    compacted = " ".join(cleaned.split())
    return (compacted or fallback)[:max_length]


def _pix_crc16(payload: str) -> str:
    polynomial = 0x1021
    crc = 0xFFFF
    data = (payload + "6304").encode("utf-8")
    for byte in data:
        crc ^= byte << 8
        for _ in range(8):
            if crc & 0x8000:
                crc = ((crc << 1) ^ polynomial) & 0xFFFF
            else:
                crc = (crc << 1) & 0xFFFF
    return f"{crc:04X}"


def _pix_field(field_id: str, value: str) -> str:
    return f"{field_id}{len(value):02d}{value}"


def build_static_pix_payload(pix_key: str | None, pix_holder: str | None) -> str | None:
    normalized_key = (pix_key or "").strip()
    if not normalized_key:
        return None
    merchant_name = _sanitize_pix_field(pix_holder, max_length=25, fallback="APOIO FIGURINHAS")
    merchant_city = "SAO LUIS"
    merchant_account = _pix_field("00", "BR.GOV.BCB.PIX") + _pix_field("01", normalized_key)
    payload = "".join(
        [
            _pix_field("00", "01"),
            _pix_field("26", merchant_account),
            _pix_field("52", "0000"),
            _pix_field("53", "986"),
            _pix_field("58", "BR"),
            _pix_field("59", merchant_name),
            _pix_field("60", merchant_city),
            _pix_field("62", _pix_field("05", "***")),
        ]
    )
    return f"{payload}6304{_pix_crc16(payload)}"


def build_static_pix_qr_base64(pix_payload: str | None) -> str | None:
    if not pix_payload:
        return None
    qr = qrcode.QRCode(box_size=8, border=2)
    qr.add_data(pix_payload)
    qr.make(fit=True)
    image = qr.make_image(fill_color="black", back_color="white")
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    return base64.b64encode(buffer.getvalue()).decode("ascii")


def slugify(value: str) -> str:
    normalized = "".join(char.lower() if char.isalnum() else "-" for char in value.strip())
    collapsed = "-".join(part for part in normalized.split("-") if part)
    return collapsed[:150] or "colecao"


def source_document_sort_key(document: SourceDocument) -> tuple[int, str, int]:
    return (-document.created_at.timestamp(), document.title.lower(), document.id)


def source_document_storage_slug(document: SourceDocument) -> str:
    base = slugify(document.title) or "documento"
    if document.id is None:
        return base
    return f"{base}-{document.id}"


def album_sort_key(album: Album) -> tuple[int, str, int]:
    return (album.sort_order, album.name.lower(), album.id)


def collection_sort_key(collection: Collection) -> tuple[int, str, int]:
    return (
        int(collection.display_group_order or 999),
        int(collection.display_item_order or 999),
        int(collection.sort_order or 0),
        collection.name.lower(),
        collection.id,
    )


def default_group_order_for_collection_type(collection_type: CollectionType | str) -> int:
    normalized = (
        collection_type
        if isinstance(collection_type, CollectionType)
        else CollectionType(collection_type or CollectionType.SELECAO.value)
    )
    mapping = {
        CollectionType.SELECAO: 1,
        CollectionType.ESCUDOS: 2,
        CollectionType.LEGENDS: 3,
        CollectionType.ESPECIAL: 4,
        CollectionType.PARCEIROS: 5,
        CollectionType.OUTROS: 6,
    }
    return mapping.get(normalized, 9)


def default_export_mode_for_collection_type(collection_type: CollectionType | str) -> CollectionExportMode:
    normalized = (
        collection_type
        if isinstance(collection_type, CollectionType)
        else CollectionType(collection_type or CollectionType.SELECAO.value)
    )
    if normalized == CollectionType.OUTROS:
        return CollectionExportMode.APPEND_FULL_PDF
    return CollectionExportMode.GRID


def normalize_collection_export_settings(collection: Collection) -> int:
    normalized_count = 0
    current_type = (
        collection.collection_type
        if isinstance(collection.collection_type, CollectionType)
        else CollectionType((collection.collection_type or CollectionType.SELECAO.value))
    )
    expected_mode = default_export_mode_for_collection_type(current_type)
    current_mode = (
        collection.export_mode
        if isinstance(collection.export_mode, CollectionExportMode)
        else CollectionExportMode((collection.export_mode or expected_mode.value))
    )
    if current_mode != expected_mode:
        collection.export_mode = expected_mode
        normalized_count += 1

    expected_allow_quantity = current_type == CollectionType.OUTROS
    if bool(collection.allow_quantity_choice) != expected_allow_quantity:
        collection.allow_quantity_choice = expected_allow_quantity
        normalized_count += 1

    expected_default_quantity = max(0, int(collection.default_quantity or 0))
    expected_max_quantity = max(0, int(collection.max_quantity_per_order or 0))
    if current_type == CollectionType.OUTROS:
        if expected_default_quantity <= 0:
            expected_default_quantity = 1
        if expected_max_quantity > 0 and expected_max_quantity < expected_default_quantity:
            expected_max_quantity = expected_default_quantity
    else:
        expected_default_quantity = 1
        expected_max_quantity = 1

    if int(collection.default_quantity or 0) != expected_default_quantity:
        collection.default_quantity = expected_default_quantity
        normalized_count += 1
    if int(collection.max_quantity_per_order or 0) != expected_max_quantity:
        collection.max_quantity_per_order = expected_max_quantity
        normalized_count += 1

    return normalized_count


def infer_collection_type_from_name(name: str) -> CollectionType:
    normalized = (name or "").strip().upper()
    if normalized == "ESCUDOS":
        return CollectionType.ESCUDOS
    if normalized == "LEGENDS":
        return CollectionType.LEGENDS
    if normalized in {"COCA-COLA", "MC DONALDS", "MC DONALD'S", "MCDONALDS"}:
        return CollectionType.PARCEIROS
    if normalized in {"DOURADAS", "FWC INICIO E FINAL", "PACOTINHO"}:
        return CollectionType.ESPECIAL
    return CollectionType.SELECAO


def normalize_collection_metadata(db: Session) -> int:
    collections = db.execute(select(Collection).order_by(Collection.id.asc())).scalars().all()
    normalized_count = 0
    type_counters: dict[CollectionType, int] = defaultdict(int)
    ordered = sorted(collections, key=lambda item: (item.album_id or 0, item.sort_order or 0, item.name.lower(), item.id))
    for collection in ordered:
        current_type = (
            collection.collection_type
            if isinstance(collection.collection_type, CollectionType)
            else CollectionType((collection.collection_type or CollectionType.SELECAO.value))
        )
        expected_group_order = default_group_order_for_collection_type(current_type)
        if int(collection.display_group_order or 0) != expected_group_order:
            collection.display_group_order = expected_group_order
            normalized_count += 1
        normalized_count += normalize_collection_export_settings(collection)
        type_counters[current_type] += 1
        expected_item_order = type_counters[current_type]
        if int(collection.display_item_order or 0) <= 0 or int(collection.display_item_order or 0) == 999:
            collection.display_item_order = expected_item_order
            normalized_count += 1
    return normalized_count


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


def ensure_default_custom_template_assignments(db: Session) -> None:
    templates_without_album = db.execute(
        select(CustomStickerTemplate)
        .where(CustomStickerTemplate.album_id.is_(None))
        .order_by(CustomStickerTemplate.created_at.asc(), CustomStickerTemplate.id.asc())
    ).scalars().all()
    if not templates_without_album:
        return

    default_album = db.execute(
        select(Album).order_by(Album.sort_order.asc(), Album.created_at.asc(), Album.id.asc())
    ).scalars().first()
    if not default_album:
        return

    for template in templates_without_album:
        template.album_id = default_album.id


def _safe_session_token_fragment(session_token: str) -> str:
    cleaned = "".join(character for character in (session_token or "") if character.isalnum() or character in {"-", "_"})
    return cleaned[:80] or "sessao"


def save_prepared_cutout_assets(
    album: Album,
    *,
    session_token: str,
    cutout_bytes: bytes,
    portrait_bytes: bytes,
) -> str:
    safe_session = _safe_session_token_fragment(session_token)
    base_dir = settings.storage_root / "custom_cutouts" / album.slug / safe_session
    base_dir.mkdir(parents=True, exist_ok=True)
    asset_token = uuid.uuid4().hex[:12]
    (base_dir / f"{asset_token}-cutout.png").write_bytes(cutout_bytes)
    (base_dir / f"{asset_token}-portrait.png").write_bytes(portrait_bytes)
    return asset_token


def load_prepared_portrait_bytes(album: Album, *, session_token: str, asset_token: str | None) -> bytes | None:
    if not asset_token:
        return None
    safe_session = _safe_session_token_fragment(session_token)
    asset_name = "".join(character for character in asset_token if character.isalnum() or character in {"-", "_"})
    if not asset_name:
        return None
    portrait_path = settings.storage_root / "custom_cutouts" / album.slug / safe_session / f"{asset_name}-portrait.png"
    if not portrait_path.exists():
        return None
    return portrait_path.read_bytes()


def clear_collection_rendered_files(collection: Collection) -> None:
    for branch in ("pages", "crops", "exports"):
        target = settings.storage_root / branch / collection.slug
        if target.exists():
            shutil.rmtree(target, ignore_errors=True)


def clear_source_document_rendered_files(document: SourceDocument) -> None:
    document_slug = source_document_storage_slug(document)
    for branch in ("source_documents", "source_document_pages", "source_detected"):
        target = settings.storage_root / branch / document.album.slug / document_slug
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

    with fitz.open(pdf_path) as source_pdf:
        for page_index in range(source_pdf.page_count):
            page = source_pdf.load_page(page_index)
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


def save_source_document_and_render_pages(
    document: SourceDocument,
    upload_name: str,
    upload_bytes: bytes,
    db: Session,
) -> None:
    if document.id is None:
        db.flush()
    clear_source_document_rendered_files(document)
    existing_detected = db.execute(
        select(SourceDetectedSticker).where(SourceDetectedSticker.document_id == document.id)
    ).scalars().all()
    for detected_sticker in existing_detected:
        delete_source_detected_sticker_record(db, detected_sticker)
    document_slug = source_document_storage_slug(document)

    pdf_dir = settings.storage_root / "source_documents" / document.album.slug / document_slug
    pdf_dir.mkdir(parents=True, exist_ok=True)
    upload_suffix = Path(upload_name).suffix.lower() or ".pdf"
    pdf_path = pdf_dir / f"{document_slug}{upload_suffix}"
    pdf_path.write_bytes(upload_bytes)

    document.pdf_path = str(pdf_path.relative_to(settings.storage_root).as_posix())
    document.pages.clear()
    document.page_count = 0
    document.status = SourceDocumentStatus.RASCUNHO
    db.flush()

    pages_dir = settings.storage_root / "source_document_pages" / document.album.slug / document_slug
    pages_dir.mkdir(parents=True, exist_ok=True)

    with fitz.open(pdf_path) as source_pdf:
        document.page_count = source_pdf.page_count
        for page_index in range(source_pdf.page_count):
            page = source_pdf.load_page(page_index)
            pixmap = page.get_pixmap(matrix=fitz.Matrix(settings.render_scale, settings.render_scale), alpha=False)
            image_path = pages_dir / f"page-{page_index + 1}.png"
            pixmap.save(image_path)
            with Image.open(image_path) as image:
                width, height = image.size
            db.add(
                SourceDocumentPage(
                    document=document,
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
        custom_generation_mode=CustomTemplateCompositionMode.LAYERS,
        custom_sticker_unlock_enabled=settings.default_custom_sticker_unlock_enabled,
        custom_sticker_unlock_price_cents=settings.default_custom_sticker_unlock_price_cents,
        custom_sticker_unlock_message=settings.default_custom_sticker_unlock_message or None,
        custom_ai_unlock_enabled=settings.default_custom_ai_unlock_enabled,
        custom_ai_unlock_price_cents=settings.default_custom_ai_unlock_price_cents,
        custom_ai_unlock_message=settings.default_custom_ai_unlock_message or None,
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


def has_generated_sticker(stickers: list[Sticker]) -> bool:
    return any(sticker.source_type == StickerSourceType.GENERATED for sticker in stickers)


def generated_sticker_for_selection(stickers: list[Sticker]) -> Sticker | None:
    return next((sticker for sticker in stickers if sticker.source_type == StickerSourceType.GENERATED), None)


def generated_sticker_requires_manual_unlock(
    sticker: Sticker | None,
    service_settings: ServiceSettings,
) -> bool:
    if not sticker or sticker.source_type != StickerSourceType.GENERATED:
        return False
    return (
        sticker.composition_mode_used != CustomTemplateCompositionMode.AI_OPTIONAL
        and service_settings.custom_sticker_unlock_enabled
    )


def generated_sticker_has_export_access(
    db: Session,
    *,
    album_id: int,
    session_token: str,
    sticker: Sticker | None,
    service_settings: ServiceSettings,
) -> bool:
    if not sticker or sticker.source_type != StickerSourceType.GENERATED:
        return True
    if sticker.composition_mode_used == CustomTemplateCompositionMode.AI_OPTIONAL:
        if not service_settings.custom_ai_unlock_enabled:
            return True
        return has_paid_custom_sticker_unlock(
            db,
            album_id=album_id,
            session_token=session_token,
            unlock_type=CustomStickerUnlockType.AI_CREATE,
        )
    if not service_settings.custom_sticker_unlock_enabled:
        return True
    return is_custom_sticker_unlocked(
        db,
        album_id=album_id,
        session_token=session_token,
        unlock_type=CustomStickerUnlockType.MANUAL_PDF,
    )


def get_custom_base_relative_path(service_settings: ServiceSettings, profile_type: CustomProfileType) -> str | None:
    normalized = normalize_custom_profile_type(profile_type)
    field_name = CUSTOM_BASE_FIELD_BY_PROFILE[normalized]
    relative_path = getattr(service_settings, field_name, None)
    if relative_path:
        return relative_path
    if normalized == CustomProfileType.CRIANCA:
        return service_settings.custom_base_menina_path
    return None


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
    normalized = normalize_custom_profile_type(profile_type)
    with Image.open(io.BytesIO(upload_bytes)) as raw_image:
        image = raw_image.convert("RGBA")

    target_dir = settings.storage_root / "custom_bases"
    target_dir.mkdir(parents=True, exist_ok=True)
    file_name = f"{normalized.value.lower()}-{uuid.uuid4().hex[:10]}.png"
    file_path = target_dir / file_name
    image.save(file_path, format="PNG", optimize=True)

    field_name = CUSTOM_BASE_FIELD_BY_PROFILE[normalized]
    previous_relative_path = getattr(service_settings, field_name, None)
    if previous_relative_path:
        previous_path = settings.storage_root / previous_relative_path
        if previous_path.exists():
            previous_path.unlink(missing_ok=True)

    relative_path = str(file_path.relative_to(settings.storage_root).as_posix())
    setattr(service_settings, field_name, relative_path)
    if normalized == CustomProfileType.CRIANCA:
        legacy_relative_path = service_settings.custom_base_menina_path
        if legacy_relative_path and legacy_relative_path != relative_path:
            legacy_path = settings.storage_root / legacy_relative_path
            if legacy_path.exists():
                legacy_path.unlink(missing_ok=True)
        service_settings.custom_base_menina_path = None
    return relative_path


def delete_custom_base_image(service_settings: ServiceSettings, profile_type: CustomProfileType) -> None:
    normalized = normalize_custom_profile_type(profile_type)
    field_name = CUSTOM_BASE_FIELD_BY_PROFILE[normalized]
    previous_relative_path = getattr(service_settings, field_name, None)
    if previous_relative_path:
        previous_path = settings.storage_root / previous_relative_path
        if previous_path.exists():
            previous_path.unlink(missing_ok=True)
    setattr(service_settings, field_name, None)
    if normalized == CustomProfileType.CRIANCA and service_settings.custom_base_menina_path:
        previous_path = settings.storage_root / service_settings.custom_base_menina_path
        if previous_path.exists():
            previous_path.unlink(missing_ok=True)
        service_settings.custom_base_menina_path = None


def save_custom_template_layer_image(
    layer: CustomStickerTemplateLayer,
    *,
    upload_bytes: bytes,
    original_name: str | None,
) -> str:
    extension = Path(original_name or "camada.png").suffix.lower() or ".png"
    safe_extension = extension if extension in {".png", ".jpg", ".jpeg", ".webp"} else ".png"
    target_dir = settings.storage_root / "custom_template_layers" / str(layer.template_id)
    target_dir.mkdir(parents=True, exist_ok=True)
    file_name = f"{layer.id}-{uuid.uuid4().hex[:8]}{safe_extension}"
    file_path = target_dir / file_name

    with Image.open(io.BytesIO(upload_bytes)) as raw_image:
        image = ImageOps.exif_transpose(raw_image)
        if safe_extension in {".jpg", ".jpeg"}:
            image = image.convert("RGB")
            image.save(file_path, quality=96)
        else:
            image.save(file_path)

    previous_relative_path = layer.file_path
    if previous_relative_path:
        previous_path = settings.storage_root / previous_relative_path
        if previous_path.exists():
            previous_path.unlink(missing_ok=True)

    relative_path = str(file_path.relative_to(settings.storage_root).as_posix())
    layer.file_path = relative_path
    return relative_path


def delete_custom_template_layer_image(layer: CustomStickerTemplateLayer) -> None:
    previous_relative_path = layer.file_path
    if previous_relative_path:
        previous_path = settings.storage_root / previous_relative_path
        if previous_path.exists():
            previous_path.unlink(missing_ok=True)
    layer.file_path = None


def normalize_template_asset_name(file_name: str) -> str:
    normalized = unicodedata.normalize("NFD", file_name or "")
    normalized = "".join(char for char in normalized if unicodedata.category(char) != "Mn")
    return normalized.lower()


def infer_custom_template_layer_definition(file_name: str) -> dict:
    normalized = normalize_template_asset_name(Path(file_name).stem)
    for rule in CUSTOM_TEMPLATE_IMPORT_RULES:
        if any(keyword in normalized for keyword in rule["keywords"]):
            return rule
    return {
        "layer_type": CustomTemplateLayerType.OVERLAY,
        "label": "Overlay",
        "z_index": 70,
        "singleton": False,
    }


def default_photo_slot_for_template(template: CustomStickerTemplate) -> CustomStickerTemplatePhotoSlot:
    visible_x, visible_y, visible_width, visible_height = photo_visibility_preset_for_template(template)
    max_scale = photo_max_scale_preset_for_template(template)
    if template.position_type == CustomPositionType.GOLEIRO:
        return CustomStickerTemplatePhotoSlot(
            x=0.1,
            y=0.05,
            width=0.8,
            height=0.65,
            default_scale=1.0,
            min_scale=0.7,
            max_scale=max_scale,
            portrait_z_index=50,
            anchor_x=0.5,
            anchor_y=0.52,
            visible_x=visible_x,
            visible_y=visible_y,
            visible_width=visible_width,
            visible_height=visible_height,
        )
    return CustomStickerTemplatePhotoSlot(
        x=0.1,
        y=0.05,
        width=0.8,
        height=0.63,
        default_scale=1.0,
        min_scale=0.7,
        max_scale=max_scale,
        portrait_z_index=50,
        anchor_x=0.5,
        anchor_y=0.52,
        visible_x=visible_x,
        visible_y=visible_y,
        visible_width=visible_width,
        visible_height=visible_height,
    )


def resolve_effective_portrait_z_index(template: CustomStickerTemplate | None) -> int:
    if template is None or template.photo_slot is None:
        return 50

    configured = int(template.photo_slot.portrait_z_index or 50)
    active_layers = [layer for layer in template.layers if layer.is_active and layer.file_path]
    frame_layers = [layer for layer in active_layers if layer.layer_type == CustomTemplateLayerType.FRAME]
    front_layers = [layer for layer in active_layers if layer.layer_type == CustomTemplateLayerType.PHOTO_FRONT]

    if not frame_layers or not front_layers:
        return configured

    max_frame_z = max(int(layer.z_index or 0) for layer in frame_layers)
    min_front_z = min(int(layer.z_index or 0) for layer in front_layers)

    if configured <= max_frame_z < min_front_z:
        gap = max(1, min_front_z - max_frame_z)
        return max_frame_z + max(1, gap // 2)

    return configured


def default_text_slots_for_template() -> list[CustomStickerTemplateTextSlot]:
    return [
        CustomStickerTemplateTextSlot(field_name=CustomTemplateTextField.NAME, x=0.10, y=0.808, width=0.71, font_size=24, font_weight="700", text_align="center", color="#ffffff"),
        CustomStickerTemplateTextSlot(field_name=CustomTemplateTextField.DATE, x=0.205, y=0.854, width=0.18, font_size=16, font_weight="700", text_align="center", color="#ffffff"),
        CustomStickerTemplateTextSlot(field_name=CustomTemplateTextField.HEIGHT, x=0.402, y=0.854, width=0.13, font_size=16, font_weight="700", text_align="center", color="#ffffff"),
        CustomStickerTemplateTextSlot(field_name=CustomTemplateTextField.WEIGHT, x=0.529, y=0.854, width=0.12, font_size=16, font_weight="700", text_align="center", color="#ffffff"),
        CustomStickerTemplateTextSlot(field_name=CustomTemplateTextField.CITY_OR_TEAM, x=0.105, y=0.911, width=0.62, font_size=16, font_weight="700", text_align="center", color="#ffffff"),
    ]


LEGACY_DEFAULT_TEXT_SLOT_SIGNATURES = [
{
    CustomTemplateTextField.NAME: {"x": 0.10, "y": 0.745, "width": 0.55, "font_size": 46.0, "text_align": "left", "color": "#ffffff"},
    CustomTemplateTextField.DATE: {"x": 0.11, "y": 0.83, "width": 0.22, "font_size": 16.0, "text_align": "left", "color": "#243047"},
    CustomTemplateTextField.HEIGHT: {"x": 0.52, "y": 0.83, "width": 0.16, "font_size": 16.0, "text_align": "left", "color": "#243047"},
    CustomTemplateTextField.WEIGHT: {"x": 0.11, "y": 0.92, "width": 0.18, "font_size": 16.0, "text_align": "left", "color": "#243047"},
    CustomTemplateTextField.CITY_OR_TEAM: {"x": 0.52, "y": 0.92, "width": 0.28, "font_size": 16.0, "text_align": "left", "color": "#243047"},
},
{
    CustomTemplateTextField.NAME: {"x": 0.10, "y": 0.735, "width": 0.68, "font_size": 38.0, "text_align": "center", "color": "#ffffff"},
    CustomTemplateTextField.DATE: {"x": 0.12, "y": 0.802, "width": 0.25, "font_size": 18.0, "text_align": "right", "color": "#ffffff"},
    CustomTemplateTextField.HEIGHT: {"x": 0.39, "y": 0.802, "width": 0.18, "font_size": 18.0, "text_align": "center", "color": "#ffffff"},
    CustomTemplateTextField.WEIGHT: {"x": 0.58, "y": 0.802, "width": 0.16, "font_size": 18.0, "text_align": "left", "color": "#ffffff"},
    CustomTemplateTextField.CITY_OR_TEAM: {"x": 0.13, "y": 0.888, "width": 0.63, "font_size": 18.0, "text_align": "center", "color": "#ffffff"},
},
{
    CustomTemplateTextField.NAME: {"x": 0.10, "y": 0.739, "width": 0.68, "font_size": 26.0, "text_align": "center", "color": "#ffffff"},
    CustomTemplateTextField.DATE: {"x": 0.14, "y": 0.804, "width": 0.18, "font_size": 14.0, "text_align": "right", "color": "#ffffff"},
    CustomTemplateTextField.HEIGHT: {"x": 0.36, "y": 0.804, "width": 0.18, "font_size": 14.0, "text_align": "center", "color": "#ffffff"},
    CustomTemplateTextField.WEIGHT: {"x": 0.54, "y": 0.804, "width": 0.14, "font_size": 14.0, "text_align": "left", "color": "#ffffff"},
    CustomTemplateTextField.CITY_OR_TEAM: {"x": 0.14, "y": 0.888, "width": 0.62, "font_size": 14.0, "text_align": "center", "color": "#ffffff"},
},
{
    CustomTemplateTextField.NAME: {"x": 0.10, "y": 0.809, "width": 0.70, "font_size": 15.0, "text_align": "center", "color": "#ffffff"},
    CustomTemplateTextField.DATE: {"x": 0.213, "y": 0.842, "width": 0.18, "font_size": 9.0, "text_align": "center", "color": "#ffffff"},
    CustomTemplateTextField.HEIGHT: {"x": 0.402, "y": 0.842, "width": 0.13, "font_size": 9.0, "text_align": "center", "color": "#ffffff"},
    CustomTemplateTextField.WEIGHT: {"x": 0.529, "y": 0.842, "width": 0.12, "font_size": 9.0, "text_align": "center", "color": "#ffffff"},
    CustomTemplateTextField.CITY_OR_TEAM: {"x": 0.105, "y": 0.899, "width": 0.62, "font_size": 9.0, "text_align": "center", "color": "#ffffff"},
},
{
    CustomTemplateTextField.NAME: {"x": 0.10, "y": 0.806, "width": 0.70, "font_size": 20.0, "text_align": "center", "color": "#ffffff"},
    CustomTemplateTextField.DATE: {"x": 0.213, "y": 0.840, "width": 0.18, "font_size": 15.0, "text_align": "center", "color": "#ffffff"},
    CustomTemplateTextField.HEIGHT: {"x": 0.402, "y": 0.840, "width": 0.13, "font_size": 15.0, "text_align": "center", "color": "#ffffff"},
    CustomTemplateTextField.WEIGHT: {"x": 0.529, "y": 0.840, "width": 0.12, "font_size": 15.0, "text_align": "center", "color": "#ffffff"},
    CustomTemplateTextField.CITY_OR_TEAM: {"x": 0.105, "y": 0.896, "width": 0.62, "font_size": 15.0, "text_align": "center", "color": "#ffffff"},
},
{
    CustomTemplateTextField.NAME: {"x": 0.10, "y": 0.802, "width": 0.70, "font_size": 20.0, "text_align": "center", "color": "#ffffff"},
    CustomTemplateTextField.DATE: {"x": 0.213, "y": 0.846, "width": 0.18, "font_size": 15.0, "text_align": "center", "color": "#ffffff"},
    CustomTemplateTextField.HEIGHT: {"x": 0.402, "y": 0.846, "width": 0.13, "font_size": 15.0, "text_align": "center", "color": "#ffffff"},
    CustomTemplateTextField.WEIGHT: {"x": 0.529, "y": 0.846, "width": 0.12, "font_size": 15.0, "text_align": "center", "color": "#ffffff"},
    CustomTemplateTextField.CITY_OR_TEAM: {"x": 0.105, "y": 0.905, "width": 0.62, "font_size": 15.0, "text_align": "center", "color": "#ffffff"},
},
{
    CustomTemplateTextField.NAME: {"x": 0.10, "y": 0.83, "width": 0.70, "font_size": 30.0, "text_align": "center", "color": "#ffffff"},
    CustomTemplateTextField.DATE: {"x": 0.213, "y": 0.846, "width": 0.18, "font_size": 15.0, "text_align": "center", "color": "#ffffff"},
    CustomTemplateTextField.HEIGHT: {"x": 0.402, "y": 0.846, "width": 0.13, "font_size": 15.0, "text_align": "center", "color": "#ffffff"},
    CustomTemplateTextField.WEIGHT: {"x": 0.529, "y": 0.846, "width": 0.12, "font_size": 15.0, "text_align": "center", "color": "#ffffff"},
    CustomTemplateTextField.CITY_OR_TEAM: {"x": 0.105, "y": 0.905, "width": 0.62, "font_size": 15.0, "text_align": "center", "color": "#ffffff"},
},
]


def _is_legacy_default_text_slot(slot: CustomStickerTemplateTextSlot) -> bool:
    for signature_map in LEGACY_DEFAULT_TEXT_SLOT_SIGNATURES:
        signature = signature_map.get(slot.field_name)
        if signature is None:
            continue
        if (
            round(float(slot.x), 3) == round(signature["x"], 3)
            and round(float(slot.y), 3) == round(signature["y"], 3)
            and round(float(slot.width), 3) == round(signature["width"], 3)
            and round(float(slot.font_size), 1) == round(signature["font_size"], 1)
            and (slot.text_align or "").strip().lower() == signature["text_align"]
            and (slot.color or "").strip().lower() == signature["color"]
        ):
            return True
    return False


def normalize_template_text_slots(template: CustomStickerTemplate) -> None:
    if len(template.text_slots) != 5:
        return
    if not all(_is_legacy_default_text_slot(slot) for slot in template.text_slots):
        return

    defaults = {slot.field_name: slot for slot in default_text_slots_for_template()}
    for slot in template.text_slots:
        default_slot = defaults.get(slot.field_name)
        if default_slot is None:
            continue
        slot.x = default_slot.x
        slot.y = default_slot.y
        slot.width = default_slot.width
        slot.font_size = default_slot.font_size
        slot.font_weight = default_slot.font_weight
        slot.text_align = default_slot.text_align
        slot.color = default_slot.color


def normalize_legacy_custom_template_text_layouts(db: Session) -> int:
    templates = db.execute(
        select(CustomStickerTemplate)
        .options(selectinload(CustomStickerTemplate.text_slots))
        .order_by(CustomStickerTemplate.id.asc())
    ).scalars().all()

    normalized_count = 0
    for template in templates:
        if len(template.text_slots) != 5:
            continue
        if not all(_is_legacy_default_text_slot(slot) for slot in template.text_slots):
            continue
        normalize_template_text_slots(template)
        normalized_count += 1
    return normalized_count


def normalize_legacy_custom_template_photo_visibility(db: Session) -> int:
    templates = db.execute(
        select(CustomStickerTemplate)
        .options(selectinload(CustomStickerTemplate.photo_slot))
        .order_by(CustomStickerTemplate.id.asc())
    ).scalars().all()

    normalized_count = 0
    for template in templates:
        if template.photo_slot is None:
            continue
        slot = template.photo_slot
        if not (
            abs((slot.visible_x or 0.0) - 0.0) < 1e-6
            and abs((slot.visible_y or 0.0) - 0.0) < 1e-6
            and abs((slot.visible_width or 1.0) - 1.0) < 1e-6
            and abs((slot.visible_height or 0.9) - 0.9) < 1e-6
        ):
            continue
        visible_x, visible_y, visible_width, visible_height = photo_visibility_preset_for_template(template)
        slot.visible_x = visible_x
        slot.visible_y = visible_y
        slot.visible_width = visible_width
        slot.visible_height = visible_height
        normalized_count += 1
    return normalized_count


def normalize_legacy_custom_template_zoom_limits(db: Session) -> int:
    templates = db.execute(
        select(CustomStickerTemplate)
        .options(selectinload(CustomStickerTemplate.photo_slot))
        .order_by(CustomStickerTemplate.id.asc())
    ).scalars().all()

    normalized_count = 0
    for template in templates:
        if template.photo_slot is None:
            continue

        slot = template.photo_slot
        if not (
            abs((slot.default_scale or 1.0) - 1.0) < 1e-6
            and abs((slot.min_scale or 0.7) - 0.7) < 1e-6
            and (slot.max_scale or 0) <= 1.55 + 1e-6
        ):
            continue

        slot.max_scale = photo_max_scale_preset_for_template(template)
        normalized_count += 1

    return normalized_count


def import_custom_template_layers(
    template: CustomStickerTemplate,
    *,
    files: list[tuple[str, bytes]],
) -> None:
    session = object_session(template)
    existing_layers_by_type: dict[CustomTemplateLayerType, list[CustomStickerTemplateLayer]] = defaultdict(list)
    for layer in template.layers:
        existing_layers_by_type[layer.layer_type].append(layer)

    overlay_count = len(existing_layers_by_type.get(CustomTemplateLayerType.OVERLAY, []))

    for original_name, upload_bytes in files:
        rule = infer_custom_template_layer_definition(original_name)
        layer_type: CustomTemplateLayerType = rule["layer_type"]
        label = rule["label"]
        z_index = rule["z_index"]
        singleton = bool(rule["singleton"])

        target_layer: CustomStickerTemplateLayer | None = None
        if singleton and existing_layers_by_type.get(layer_type):
            target_layer = existing_layers_by_type[layer_type][0]
            duplicate_layers = existing_layers_by_type[layer_type][1:]
            if duplicate_layers:
                for duplicate_layer in duplicate_layers:
                    delete_custom_template_layer_image(duplicate_layer)
                    if duplicate_layer in template.layers:
                        template.layers.remove(duplicate_layer)
                    if session is not None and duplicate_layer.id is not None:
                        session.delete(duplicate_layer)
                existing_layers_by_type[layer_type] = [target_layer]
        if target_layer is None:
            target_layer = CustomStickerTemplateLayer(
                layer_type=layer_type,
                label=label if singleton else f"{label} {overlay_count + 1}" if layer_type == CustomTemplateLayerType.OVERLAY else label,
                z_index=z_index if layer_type != CustomTemplateLayerType.OVERLAY else z_index + overlay_count,
                is_active=True,
            )
            template.layers.append(target_layer)
            existing_layers_by_type[layer_type].append(target_layer)
            if layer_type == CustomTemplateLayerType.OVERLAY:
                overlay_count += 1
        else:
            target_layer.layer_type = layer_type
            target_layer.label = label if layer_type != CustomTemplateLayerType.OVERLAY else target_layer.label or label
            target_layer.z_index = z_index
            target_layer.is_active = True

        if session is not None and (target_layer.id is None or target_layer.template_id is None):
            session.flush()
        save_custom_template_layer_image(target_layer, upload_bytes=upload_bytes, original_name=original_name)

    if template.photo_slot is None:
        template.photo_slot = default_photo_slot_for_template(template)
    if not template.text_slots:
        template.text_slots.extend(default_text_slots_for_template())


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
    unlocks = db.execute(
        select(CustomStickerUnlock).where(CustomStickerUnlock.sticker_id == sticker.id)
    ).scalars().all()
    for unlock in unlocks:
        unlock.sticker_id = None
    delete_sticker_assets(sticker)
    db.delete(sticker)


def delete_source_detected_sticker_assets(detected_sticker: SourceDetectedSticker) -> None:
    for relative_path in {detected_sticker.crop_path, detected_sticker.preview_path}:
        if not relative_path:
            continue
        file_path = settings.storage_root / relative_path
        if file_path.exists():
            file_path.unlink(missing_ok=True)


def delete_source_detected_sticker_record(db: Session, detected_sticker: SourceDetectedSticker) -> None:
    delete_source_detected_sticker_assets(detected_sticker)
    db.delete(detected_sticker)


def restore_source_detected_sticker_to_pending(detected_sticker: SourceDetectedSticker) -> None:
    detected_sticker.assigned_collection_id = None
    detected_sticker.status = SourceDetectedStickerStatus.PENDENTE


def _delete_relative_storage_file(relative_path: str | None) -> None:
    if not relative_path:
        return
    file_path = settings.storage_root / relative_path
    if file_path.exists() and file_path.is_file():
        file_path.unlink(missing_ok=True)


def _delete_storage_dir(path: Path) -> None:
    if path.exists():
        shutil.rmtree(path, ignore_errors=True)


def delete_page_record(db: Session, page: Page) -> None:
    _delete_relative_storage_file(page.image_path)
    db.delete(page)


def cleanup_orphaned_source_document_artifacts(db: Session) -> None:
    orphaned_source_pages = db.execute(
        select(Page)
        .outerjoin(SourceDocumentPage, SourceDocumentPage.image_path == Page.image_path)
        .where(
            Page.image_path.like("source_document_pages/%"),
            SourceDocumentPage.id.is_(None),
        )
    ).scalars().all()

    handled_sticker_ids: set[int] = set()
    for page in orphaned_source_pages:
        page_stickers = db.execute(select(Sticker).where(Sticker.page_id == page.id)).scalars().all()
        for sticker in page_stickers:
            if sticker.id in handled_sticker_ids:
                continue
            delete_sticker_record(db, sticker)
            handled_sticker_ids.add(sticker.id)
        delete_page_record(db, page)

    orphaned_stickers = db.execute(
        select(Sticker)
        .outerjoin(SourceDocument, SourceDocument.id == Sticker.source_document_id)
        .where(
            or_(
                and_(
                    Sticker.source_document_id.is_not(None),
                    SourceDocument.id.is_(None),
                ),
                and_(
                    Sticker.code.like("doc-%-d%"),
                    Sticker.page_id.is_(None),
                ),
            )
        )
    ).scalars().all()
    for sticker in orphaned_stickers:
        if sticker.id in handled_sticker_ids:
            continue
        delete_sticker_record(db, sticker)
        handled_sticker_ids.add(sticker.id)


def delete_source_document_record(db: Session, document: SourceDocument) -> None:
    hydrated_document = (
        db.execute(
            select(SourceDocument)
            .options(
                selectinload(SourceDocument.album),
                selectinload(SourceDocument.pages).selectinload(SourceDocumentPage.blocks),
                selectinload(SourceDocument.detected_stickers),
            )
            .where(SourceDocument.id == document.id)
        )
        .scalar_one()
    )

    source_page_image_paths = {page.image_path for page in hydrated_document.pages if page.image_path}
    affected_collection_pages = []
    if source_page_image_paths:
        affected_collection_pages = db.execute(
            select(Page).where(Page.image_path.in_(source_page_image_paths))
        ).scalars().all()

    handled_sticker_ids: set[int] = set()
    for page in affected_collection_pages:
        page_stickers = db.execute(select(Sticker).where(Sticker.page_id == page.id)).scalars().all()
        for sticker in page_stickers:
            if sticker.id in handled_sticker_ids:
                continue
            delete_sticker_record(db, sticker)
            handled_sticker_ids.add(sticker.id)
        delete_page_record(db, page)

    direct_document_stickers = db.execute(
        select(Sticker).where(
            or_(
                Sticker.source_document_id == hydrated_document.id,
                Sticker.code.like(f"doc-{hydrated_document.id}-d%"),
            )
        )
    ).scalars().all()
    for sticker in direct_document_stickers:
        if sticker.id in handled_sticker_ids:
            continue
        delete_sticker_record(db, sticker)
        handled_sticker_ids.add(sticker.id)

    _delete_relative_storage_file(hydrated_document.pdf_path)
    for page in hydrated_document.pages:
        _delete_relative_storage_file(page.image_path)
    for detected_sticker in hydrated_document.detected_stickers:
        delete_source_detected_sticker_assets(detected_sticker)
    clear_source_document_rendered_files(hydrated_document)
    db.delete(hydrated_document)


def delete_album_record(db: Session, album: Album) -> None:
    hydrated_album = (
        db.execute(
            select(Album)
            .options(
                selectinload(Album.collections).selectinload(Collection.pages),
                selectinload(Album.collections).selectinload(Collection.stickers),
                selectinload(Album.collections).selectinload(Collection.exports),
                selectinload(Album.collections).selectinload(Collection.print_orders),
                selectinload(Album.custom_templates).selectinload(CustomStickerTemplate.layers),
                selectinload(Album.source_documents).selectinload(SourceDocument.pages),
                selectinload(Album.source_documents).selectinload(SourceDocument.detected_stickers),
                selectinload(Album.print_orders),
            )
            .where(Album.id == album.id)
        )
        .scalar_one()
    )

    order_ids_handled: set[int] = set()
    for order in hydrated_album.print_orders:
        _delete_relative_storage_file(order.export_file_path)
        order_ids_handled.add(order.id)
        db.delete(order)

    for collection in hydrated_album.collections:
        _delete_relative_storage_file(collection.source_pdf_path)
        for export_record in collection.exports:
            _delete_relative_storage_file(export_record.file_path)
        for page in collection.pages:
            _delete_relative_storage_file(page.image_path)
        for sticker in collection.stickers:
            delete_sticker_assets(sticker)
        for order in collection.print_orders:
            if order.id in order_ids_handled:
                continue
            _delete_relative_storage_file(order.export_file_path)
            order_ids_handled.add(order.id)
            db.delete(order)
        clear_collection_rendered_files(collection)
        _delete_storage_dir(settings.storage_root / "originals" / collection.slug)

    for template in hydrated_album.custom_templates:
        generated_stickers = db.execute(select(Sticker).where(Sticker.template_id == template.id)).scalars().all()
        for sticker in generated_stickers:
            sticker.template_id = None
        for layer in list(template.layers):
            delete_custom_template_layer_image(layer)
        _delete_storage_dir(settings.storage_root / "custom_template_layers" / str(template.id))
        db.delete(template)

    for document in hydrated_album.source_documents:
        _delete_relative_storage_file(document.pdf_path)
        for page in document.pages:
            _delete_relative_storage_file(page.image_path)
        for detected_sticker in document.detected_stickers:
            delete_source_detected_sticker_assets(detected_sticker)
        clear_source_document_rendered_files(document)
        db.delete(document)

    unlocks = db.execute(
        select(CustomStickerUnlock).where(CustomStickerUnlock.album_id == hydrated_album.id)
    ).scalars().all()
    for unlock in unlocks:
        db.delete(unlock)

    _delete_storage_dir(settings.storage_root / "exports" / hydrated_album.slug)
    _delete_storage_dir(settings.storage_root / "custom_stickers" / hydrated_album.slug)
    _delete_storage_dir(settings.storage_root / "custom_cutouts" / hydrated_album.slug)

    db.delete(hydrated_album)


def delete_collection_record(db: Session, collection: Collection) -> None:
    hydrated_collection = (
        db.execute(
            select(Collection)
            .options(
                selectinload(Collection.album),
                selectinload(Collection.pages),
                selectinload(Collection.stickers),
                selectinload(Collection.exports),
                selectinload(Collection.print_orders),
                selectinload(Collection.source_blocks),
                selectinload(Collection.source_detected_stickers),
            )
            .where(Collection.id == collection.id)
        )
        .scalar_one()
    )

    for block in hydrated_collection.source_blocks:
        block.collection_id = None
    layout_blocks = db.execute(
        select(PageLayoutTemplateBlock).where(PageLayoutTemplateBlock.collection_id == hydrated_collection.id)
    ).scalars().all()
    for block in layout_blocks:
        block.collection_id = None
    for detected_sticker in hydrated_collection.source_detected_stickers:
        restore_source_detected_sticker_to_pending(detected_sticker)

    _delete_relative_storage_file(hydrated_collection.source_pdf_path)
    for export_record in hydrated_collection.exports:
        _delete_relative_storage_file(export_record.file_path)
    for page in hydrated_collection.pages:
        _delete_relative_storage_file(page.image_path)
    for sticker in hydrated_collection.stickers:
        delete_sticker_record(db, sticker)
    for order in hydrated_collection.print_orders:
        _delete_relative_storage_file(order.export_file_path)
        db.delete(order)

    clear_collection_rendered_files(hydrated_collection)
    _delete_storage_dir(settings.storage_root / "originals" / hydrated_collection.slug)
    db.delete(hydrated_collection)


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


def normalize_collection_stickers_to_reference_grid(db: Session, collection: Collection) -> dict:
    pages = db.execute(
        select(Page)
        .options(selectinload(Page.stickers))
        .where(Page.collection_id == collection.id)
        .order_by(Page.page_number.asc(), Page.id.asc())
    ).scalars().all()
    if not pages:
        raise ValueError("Suba um PDF e cadastre figurinhas antes de normalizar a grade.")

    rendered_page = any((page.image_path or "").startswith("source_document_pages/") for page in pages)
    page_sizes_by_collection = {
        collection.id: {
            page.page_number: _page_dimensions_for_export(page.width, page.height, rendered_page=rendered_page)
            for page in pages
        }
    }

    stickers_by_page: dict[int, list[Sticker]] = {}
    all_stickers: list[Sticker] = []
    for page in pages:
        page_stickers = [
            sticker
            for sticker in page.stickers
            if sticker.source_type == StickerSourceType.PDF
        ]
        page_stickers.sort(
            key=lambda current: (
                round(current.y_ratio, 6),
                round(current.x_ratio, 6),
                current.sort_order,
                current.id,
            )
        )
        if page_stickers:
            stickers_by_page[page.id] = page_stickers
            all_stickers.extend(page_stickers)

    if not all_stickers:
        raise ValueError("Essa colecao ainda nao tem figurinhas em PDF para normalizar.")

    stickers_by_size: dict[tuple[float, float], list[Sticker]] = defaultdict(list)
    for sticker in all_stickers:
        stickers_by_size[_sticker_size_key(sticker, page_sizes_by_collection)].append(sticker)

    dominant_size_key, dominant_group = max(
        stickers_by_size.items(),
        key=lambda item: (len(item[1]), -item[0][1], -item[0][0]),
    )

    stickers_by_reference_page: dict[int, list[Sticker]] = defaultdict(list)
    for sticker in dominant_group:
        stickers_by_reference_page[sticker.page_id].append(sticker)

    pages_by_id = {page.id: page for page in pages}
    reference_page_id, reference_page_stickers = max(
        stickers_by_reference_page.items(),
        key=lambda item: (
            len(item[1]),
            -pages_by_id[item[0]].page_number,
            -pages_by_id[item[0]].id,
        ),
    )
    reference_page = pages_by_id[reference_page_id]
    normalized_width_ratio = float(median([float(sticker.width_ratio) for sticker in dominant_group]))
    normalized_height_ratio = float(median([float(sticker.height_ratio) for sticker in dominant_group]))
    reference_slots = []
    for sticker in sorted(
        reference_page_stickers,
        key=lambda current: (
            round(current.y_ratio, 6),
            round(current.x_ratio, 6),
            current.sort_order,
            current.id,
        ),
    ):
        center_x = float(sticker.x_ratio + (sticker.width_ratio / 2))
        center_y = float(sticker.y_ratio + (sticker.height_ratio / 2))
        x_ratio = min(max(center_x - (normalized_width_ratio / 2), 0.0), 1.0 - normalized_width_ratio)
        y_ratio = min(max(center_y - (normalized_height_ratio / 2), 0.0), 1.0 - normalized_height_ratio)
        reference_slots.append(
            {
                "x_ratio": x_ratio,
                "y_ratio": y_ratio,
                "width_ratio": normalized_width_ratio,
                "height_ratio": normalized_height_ratio,
                "center_x": center_x,
                "center_y": center_y,
            }
        )
    if not reference_slots:
        raise ValueError("Nao foi possivel determinar uma grade de referencia para essa colecao.")

    normalized_count = 0
    changed_page_ids: set[int] = set()

    for page in pages:
        page_stickers = stickers_by_page.get(page.id, [])
        if not page_stickers:
            continue
        if len(page_stickers) > len(reference_slots):
            raise ValueError(f"A pagina {page.page_number} tem mais figurinhas do que a grade de referencia suporta.")

        available_slots = [dict(slot) for slot in reference_slots]
        for sticker in page_stickers:
            sticker_center_x = float(sticker.x_ratio + (sticker.width_ratio / 2))
            sticker_center_y = float(sticker.y_ratio + (sticker.height_ratio / 2))
            slot_index = min(
                range(len(available_slots)),
                key=lambda index: (
                    (available_slots[index]["center_y"] - sticker_center_y) ** 2
                    + (available_slots[index]["center_x"] - sticker_center_x) ** 2,
                    index,
                ),
            )
            slot = available_slots.pop(slot_index)
            changed = any(
                abs(float(getattr(sticker, field)) - float(slot[field])) > 0.000001
                for field in ("x_ratio", "y_ratio", "width_ratio", "height_ratio")
            )
            if not changed:
                continue

            sticker.x_ratio = float(slot["x_ratio"])
            sticker.y_ratio = float(slot["y_ratio"])
            sticker.width_ratio = float(slot["width_ratio"])
            sticker.height_ratio = float(slot["height_ratio"])
            sticker.detected_automatically = False
            crop_sticker_image(sticker)
            normalized_count += 1
            changed_page_ids.add(page.id)

    return {
        "collection_id": collection.id,
        "reference_page_id": reference_page.id,
        "reference_page_number": reference_page.page_number,
        "reference_slot_count": len(reference_slots),
        "page_count": len(stickers_by_page),
        "sticker_count": len(all_stickers),
        "normalized_count": normalized_count,
        "changed_page_count": len(changed_page_ids),
    }


def crop_source_detected_sticker_image(
    detected_sticker: SourceDetectedSticker,
    *,
    page_image: Image.Image,
    document_slug: str,
) -> None:
    width, height = page_image.size
    left = max(0, int(round(detected_sticker.x_ratio * width)))
    top = max(0, int(round(detected_sticker.y_ratio * height)))
    right = min(width, int(round((detected_sticker.x_ratio + detected_sticker.width_ratio) * width)))
    bottom = min(height, int(round((detected_sticker.y_ratio + detected_sticker.height_ratio) * height)))
    if right <= left or bottom <= top:
        raise ValueError("Area de recorte detectada invalida.")

    crop = page_image.crop((left, top, right, bottom))
    detected_dir = settings.storage_root / "source_detected" / document_slug
    detected_dir.mkdir(parents=True, exist_ok=True)
    file_name = f"detected-{detected_sticker.id}.png"
    crop_path = detected_dir / file_name
    crop.save(crop_path, optimize=True)
    relative = str(crop_path.relative_to(settings.storage_root).as_posix())
    detected_sticker.crop_path = relative
    detected_sticker.preview_path = relative


def auto_detect_source_document_stickers(
    db: Session,
    document: SourceDocument,
    *,
    replace_existing: bool = True,
) -> dict:
    current_document = load_source_document_or_fail(db, document.id)
    document_slug = source_document_storage_slug(current_document)
    results: list[dict] = []
    total_detected = 0
    total_replaced = 0

    for source_page in current_document.pages:
        existing_detected = db.execute(
            select(SourceDetectedSticker)
            .where(
                SourceDetectedSticker.page_id == source_page.id,
            )
            .order_by(SourceDetectedSticker.id.asc())
        ).scalars().all()
        replaced_count = len(existing_detected) if replace_existing else 0

        detection = detect_sticker_rectangles(settings.storage_root / source_page.image_path)
        if detection.status != "detected":
            results.append(
                {
                    "page_id": source_page.id,
                    "page_number": source_page.page_number,
                    "status": detection.status,
                    "template": detection.template,
                    "reason": detection.reason,
                    "detected_count": 0,
                    "replaced_count": 0 if detection.status != "detected" else replaced_count,
                }
            )
            continue

        if replace_existing:
            for detected_sticker in existing_detected:
                if detected_sticker.status == SourceDetectedStickerStatus.ATRIBUIDA:
                    linked_sticker = db.execute(
                        select(Sticker).where(
                            Sticker.source_document_id == current_document.id,
                            Sticker.code == f"doc-{current_document.id}-d{detected_sticker.id}",
                        )
                    ).scalar_one_or_none()
                    if linked_sticker:
                        delete_sticker_record(db, linked_sticker)
                delete_source_detected_sticker_record(db, detected_sticker)
            db.flush()

        page_image_path = settings.storage_root / source_page.image_path
        if not page_image_path.exists():
            raise FileNotFoundError("Imagem da pagina do documento fonte nao encontrada.")

        created_detected: list[SourceDetectedSticker] = []
        with Image.open(page_image_path) as page_image:
            for rectangle in detection.rectangles:
                detected_sticker = SourceDetectedSticker(
                    document_id=current_document.id,
                    page_id=source_page.id,
                    status=SourceDetectedStickerStatus.PENDENTE,
                    category=rectangle.category,
                    x_ratio=rectangle.x_ratio,
                    y_ratio=rectangle.y_ratio,
                    width_ratio=rectangle.width_ratio,
                    height_ratio=rectangle.height_ratio,
                    preview_path="",
                    crop_path="",
                )
                db.add(detected_sticker)
                created_detected.append(detected_sticker)

            if created_detected:
                db.flush()
                for detected_sticker in created_detected:
                    crop_source_detected_sticker_image(
                        detected_sticker,
                        page_image=page_image,
                        document_slug=document_slug,
                    )

        detected_count = len(created_detected)
        total_detected += detected_count
        total_replaced += replaced_count
        results.append(
            {
                "page_id": source_page.id,
                "page_number": source_page.page_number,
                "status": detection.status,
                "template": detection.template,
                "reason": detection.reason,
                "detected_count": detected_count,
                "replaced_count": replaced_count,
            }
        )

    current_document.status = (
        SourceDocumentStatus.EM_REVISAO if total_detected or current_document.detected_stickers else SourceDocumentStatus.RASCUNHO
    )
    db.flush()
    return {
        "detected_count": total_detected,
        "replaced_count": total_replaced,
        "page_results": results,
    }


def ensure_collection_page_for_source_document_page(
    db: Session,
    *,
    collection: Collection,
    source_page: SourceDocumentPage,
) -> Page:
    page = db.execute(
        select(Page).where(
            Page.collection_id == collection.id,
            Page.image_path == source_page.image_path,
        )
    ).scalar_one_or_none()
    if page:
        page.width = source_page.width
        page.height = source_page.height
        db.flush()
        return page

    next_page_number = (
        db.execute(select(func.max(Page.page_number)).where(Page.collection_id == collection.id)).scalar_one() or 0
    ) + 1
    page = Page(
        collection=collection,
        page_number=next_page_number,
        image_path=source_page.image_path,
        width=source_page.width,
        height=source_page.height,
    )
    db.add(page)
    db.flush()
    return page


def assign_source_detected_stickers(
    db: Session,
    document: SourceDocument,
    *,
    collection: Collection,
    detected_sticker_ids: list[int],
) -> dict:
    current_document = load_source_document_or_fail(db, document.id)
    if collection.album_id != current_document.album_id:
        raise ValueError("Escolha uma selecao do mesmo album desse documento fonte.")

    detected_stickers = db.execute(
        select(SourceDetectedSticker)
        .options(
            selectinload(SourceDetectedSticker.page).selectinload(SourceDocumentPage.document).selectinload(SourceDocument.album),
            selectinload(SourceDetectedSticker.assigned_collection),
        )
        .where(
            SourceDetectedSticker.document_id == current_document.id,
            SourceDetectedSticker.id.in_(detected_sticker_ids),
        )
        .order_by(SourceDetectedSticker.page_id.asc(), SourceDetectedSticker.id.asc())
    ).scalars().all()

    if not detected_stickers:
        raise ValueError("Nenhuma figurinha detectada valida foi selecionada.")

    target_pages_by_source_page_id: dict[int, Page] = {}
    page_images: dict[int, Image.Image] = {}
    affected_count = 0
    current_max_order = (
        db.execute(select(func.max(Sticker.sort_order)).where(Sticker.collection_id == collection.id)).scalar_one() or 0
    )
    next_sort_order = current_max_order + 1

    try:
        for detected_sticker in detected_stickers:
            if detected_sticker.status != SourceDetectedStickerStatus.PENDENTE:
                continue
            source_page = detected_sticker.page
            if source_page is None:
                continue
            if source_page.id not in target_pages_by_source_page_id:
                target_pages_by_source_page_id[source_page.id] = ensure_collection_page_for_source_document_page(
                    db,
                    collection=collection,
                    source_page=source_page,
                )
            target_page = target_pages_by_source_page_id[source_page.id]
            sticker_name = (
                detected_sticker.ocr_name_suggested
                or f"{collection.name} {source_page.page_number:02d}-{affected_count + 1:02d}"
            )
            sticker = Sticker(
                collection=collection,
                page=target_page,
                source_document_id=current_document.id,
                source_document_page_id=source_page.id,
                source_block_id=None,
                name=sticker_name[:150],
                code=f"doc-{current_document.id}-d{detected_sticker.id}",
                category=detected_sticker.category,
                source_type=StickerSourceType.PDF,
                sort_order=next_sort_order,
                x_ratio=detected_sticker.x_ratio,
                y_ratio=detected_sticker.y_ratio,
                width_ratio=detected_sticker.width_ratio,
                height_ratio=detected_sticker.height_ratio,
                active=True,
                detected_automatically=True,
                preview_path="",
                crop_path="",
                ocr_name_raw=detected_sticker.ocr_name_raw,
                ocr_name_suggested=detected_sticker.ocr_name_suggested,
                ocr_confidence=detected_sticker.ocr_confidence,
                ocr_processed_at=detected_sticker.ocr_processed_at,
            )
            next_sort_order += 1
            db.add(sticker)
            db.flush()

            if source_page.id not in page_images:
                page_image_path = settings.storage_root / source_page.image_path
                if not page_image_path.exists():
                    raise FileNotFoundError("Imagem da pagina do documento fonte nao encontrada.")
                page_images[source_page.id] = Image.open(page_image_path)
            crop_sticker_image(sticker, page_image=page_images[source_page.id])
            if not detected_sticker.ocr_processed_at:
                refresh_sticker_ocr(sticker, update_name=True)

            detected_sticker.status = SourceDetectedStickerStatus.ATRIBUIDA
            detected_sticker.assigned_collection_id = collection.id
            affected_count += 1
    finally:
        for image in page_images.values():
            image.close()

    current_document.status = SourceDocumentStatus.EM_REVISAO
    db.flush()
    return {
        "document_id": current_document.id,
        "affected_count": affected_count,
        "collection_id": collection.id,
        "collection_name": collection.name,
    }


def discard_source_detected_stickers(
    db: Session,
    document: SourceDocument,
    *,
    detected_sticker_ids: list[int],
) -> dict:
    detected_stickers = db.execute(
        select(SourceDetectedSticker).where(
            SourceDetectedSticker.document_id == document.id,
            SourceDetectedSticker.id.in_(detected_sticker_ids),
            SourceDetectedSticker.status == SourceDetectedStickerStatus.PENDENTE,
        )
    ).scalars().all()
    if not detected_stickers:
        raise ValueError("Nenhuma figurinha detectada pendente foi selecionada.")

    for detected_sticker in detected_stickers:
        detected_sticker.status = SourceDetectedStickerStatus.DESCARTADA
    db.flush()
    return {
        "document_id": document.id,
        "affected_count": len(detected_stickers),
        "collection_id": None,
        "collection_name": None,
    }


def unassign_source_detected_stickers(
    db: Session,
    document: SourceDocument,
    *,
    detected_sticker_ids: list[int],
) -> dict:
    detected_stickers = db.execute(
        select(SourceDetectedSticker).where(
            SourceDetectedSticker.document_id == document.id,
            SourceDetectedSticker.id.in_(detected_sticker_ids),
            SourceDetectedSticker.status == SourceDetectedStickerStatus.ATRIBUIDA,
        )
    ).scalars().all()
    if not detected_stickers:
        raise ValueError("Nenhuma figurinha atribuida foi selecionada.")

    affected_count = 0
    for detected_sticker in detected_stickers:
        linked_sticker = db.execute(
            select(Sticker).where(
                Sticker.source_document_id == document.id,
                Sticker.code == f"doc-{document.id}-d{detected_sticker.id}",
            )
        ).scalar_one_or_none()
        if linked_sticker:
            delete_sticker_record(db, linked_sticker)
        restore_source_detected_sticker_to_pending(detected_sticker)
        affected_count += 1

    db.flush()
    return {
        "document_id": document.id,
        "affected_count": affected_count,
        "collection_id": None,
        "collection_name": None,
    }


def auto_detect_source_block_stickers(
    db: Session,
    block: PageSelectionBlock,
    *,
    replace_existing: bool = True,
) -> dict:
    source_page = block.page
    collection = block.collection
    if source_page is None or collection is None:
        raise ValueError("Esse bloco precisa estar vinculado a uma pagina e a uma selecao.")

    if source_page.document.album_id != collection.album_id:
        raise ValueError("O bloco e a selecao precisam pertencer ao mesmo album.")

    target_page = ensure_collection_page_for_source_document_page(
        db,
        collection=collection,
        source_page=source_page,
    )

    existing_stickers = db.execute(
        select(Sticker)
        .options(selectinload(Sticker.collection), selectinload(Sticker.page))
        .where(Sticker.source_block_id == block.id)
        .order_by(Sticker.sort_order.asc(), Sticker.id.asc())
    ).scalars().all()
    replaced_count = len(existing_stickers) if replace_existing else 0

    if replace_existing:
        for sticker in existing_stickers:
            delete_sticker_record(db, sticker)
        db.flush()

    page_image_path = settings.storage_root / source_page.image_path
    if not page_image_path.exists():
        raise FileNotFoundError("Imagem da pagina do documento fonte nao encontrada.")

    with Image.open(page_image_path) as source_image:
        page_width, page_height = source_image.size
        left = max(0, int(round(block.x * page_width)))
        top = max(0, int(round(block.y * page_height)))
        right = min(page_width, int(round((block.x + block.width) * page_width)))
        bottom = min(page_height, int(round((block.y + block.height) * page_height)))
        if right <= left or bottom <= top:
            raise ValueError("A area do bloco e invalida para deteccao.")

        block_crop = source_image.crop((left, top, right, bottom))

        with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as temp_file:
            temp_path = Path(temp_file.name)
        try:
            block_crop.save(temp_path, optimize=True)
            detection = detect_sticker_rectangles(temp_path)
        finally:
            temp_path.unlink(missing_ok=True)

        if detection.status != "detected":
            return {
                "block_id": block.id,
                "page_id": source_page.id,
                "page_number": source_page.page_number,
                "collection_id": collection.id,
                "collection_name": collection.name,
                "status": detection.status,
                "template": detection.template,
                "reason": detection.reason,
                "detected_count": 0,
                "replaced_count": replaced_count,
            }

        current_max_order = db.execute(
            select(func.max(Sticker.sort_order)).where(Sticker.collection_id == collection.id)
        ).scalar_one()
        next_sort_order = (current_max_order or 0) + 1
        created_stickers: list[Sticker] = []

        for index, rectangle in enumerate(detection.rectangles, start=1):
            global_x = round(block.x + (rectangle.x_ratio * block.width), 6)
            global_y = round(block.y + (rectangle.y_ratio * block.height), 6)
            global_width = round(rectangle.width_ratio * block.width, 6)
            global_height = round(rectangle.height_ratio * block.height, 6)
            validate_sticker_bounds(global_x, global_y, global_width, global_height)

            sticker = Sticker(
                collection=collection,
                page=target_page,
                source_document_id=source_page.document_id,
                source_document_page_id=source_page.id,
                source_block_id=block.id,
                name=f"{collection.name} {source_page.page_number:02d}-{index:02d}",
                code=f"bloco-{block.id}-p{source_page.page_number:02d}-{index:02d}",
                category=rectangle.category,
                source_type=StickerSourceType.PDF,
                sort_order=next_sort_order,
                x_ratio=global_x,
                y_ratio=global_y,
                width_ratio=global_width,
                height_ratio=global_height,
                active=True,
                detected_automatically=True,
                preview_path="",
                crop_path="",
            )
            next_sort_order += 1
            db.add(sticker)
            created_stickers.append(sticker)

        if created_stickers:
            db.flush()
            for sticker in created_stickers:
                crop_sticker_image(sticker, page_image=source_image)
            for sticker in created_stickers:
                refresh_sticker_ocr(sticker, update_name=True)

    return {
        "block_id": block.id,
        "page_id": source_page.id,
        "page_number": source_page.page_number,
        "collection_id": collection.id,
        "collection_name": collection.name,
        "status": detection.status,
        "template": detection.template,
        "reason": detection.reason,
        "detected_count": len(detection.rectangles),
        "replaced_count": replaced_count,
    }


def duplicate_blocks_from_previous_source_page(
    db: Session,
    page: SourceDocumentPage,
    *,
    replace_existing: bool = True,
) -> SourceDocumentPage:
    previous_page = db.execute(
        select(SourceDocumentPage)
        .options(
            selectinload(SourceDocumentPage.blocks).selectinload(PageSelectionBlock.collection),
        )
        .where(
            SourceDocumentPage.document_id == page.document_id,
            SourceDocumentPage.page_number == page.page_number - 1,
        )
    ).scalar_one_or_none()
    if previous_page is None:
        raise ValueError("Nao existe pagina anterior nesse documento fonte.")
    if not previous_page.blocks:
        raise ValueError("A pagina anterior ainda nao tem blocos para duplicar.")

    current_page = load_source_document_page_or_fail(db, page.id)

    if replace_existing:
        existing_blocks = list(current_page.blocks)
        for block in existing_blocks:
            for sticker in list(block.source_stickers):
                delete_sticker_record(db, sticker)
            db.delete(block)
        db.flush()

    for source_block in previous_page.blocks:
        duplicated = PageSelectionBlock(
            page_id=current_page.id,
            collection_id=source_block.collection_id,
            label=source_block.label,
            x=source_block.x,
            y=source_block.y,
            width=source_block.width,
            height=source_block.height,
            sort_order=source_block.sort_order,
        )
        db.add(duplicated)
    db.flush()
    return load_source_document_page_or_fail(db, current_page.id)


def duplicate_page_selection_block(
    db: Session,
    block: PageSelectionBlock,
    *,
    offset_ratio: float = 0.015,
) -> PageSelectionBlock:
    max_sort_order = (
        db.execute(
            select(func.max(PageSelectionBlock.sort_order)).where(PageSelectionBlock.page_id == block.page_id)
        ).scalar_one()
        or 0
    )
    max_x = max(0.0, 1.0 - block.width)
    max_y = max(0.0, 1.0 - block.height)
    duplicated = PageSelectionBlock(
        page_id=block.page_id,
        collection_id=block.collection_id,
        label=block.label,
        x=round(min(max_x, block.x + offset_ratio), 6),
        y=round(min(max_y, block.y + offset_ratio), 6),
        width=block.width,
        height=block.height,
        sort_order=max_sort_order + 1,
    )
    db.add(duplicated)
    db.flush()
    return load_page_selection_block_or_fail(db, duplicated.id)


def create_page_layout_template_from_source_page(
    db: Session,
    page: SourceDocumentPage,
    *,
    name: str,
) -> PageLayoutTemplate:
    current_page = load_source_document_page_or_fail(db, page.id)
    if not current_page.blocks:
        raise ValueError("Essa pagina ainda nao tem blocos para salvar como layout mestre.")

    normalized_name = name.strip()
    if len(normalized_name) < 2:
        raise ValueError("Informe um nome para o layout mestre.")

    template = PageLayoutTemplate(
        album_id=current_page.document.album_id,
        name=normalized_name[:150],
    )
    db.add(template)
    db.flush()

    for block in current_page.blocks:
        db.add(
            PageLayoutTemplateBlock(
                template_id=template.id,
                collection_id=block.collection_id,
                label=block.label,
                x=block.x,
                y=block.y,
                width=block.width,
                height=block.height,
                sort_order=block.sort_order,
            )
        )
    db.flush()
    return load_page_layout_template_or_fail(db, template.id)


def apply_page_layout_template_to_source_page(
    db: Session,
    template: PageLayoutTemplate,
    page: SourceDocumentPage,
    *,
    replace_existing: bool = True,
) -> SourceDocumentPage:
    current_page = load_source_document_page_or_fail(db, page.id)
    current_template = load_page_layout_template_or_fail(db, template.id)

    if current_template.album_id != current_page.document.album_id:
        raise ValueError("Esse layout mestre pertence a outro album.")
    if not current_template.blocks:
        raise ValueError("Esse layout mestre ainda nao tem blocos salvos.")

    if replace_existing:
        existing_blocks = list(current_page.blocks)
        for block in existing_blocks:
            for sticker in list(block.source_stickers):
                delete_sticker_record(db, sticker)
            db.delete(block)
        db.flush()

    for template_block in current_template.blocks:
        db.add(
            PageSelectionBlock(
                page_id=current_page.id,
                collection_id=template_block.collection_id,
                label=template_block.label,
                x=template_block.x,
                y=template_block.y,
                width=template_block.width,
                height=template_block.height,
                sort_order=template_block.sort_order,
            )
        )
    db.flush()
    return load_source_document_page_or_fail(db, current_page.id)


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


def load_latest_custom_sticker_unlock(
    db: Session,
    *,
    album_id: int,
    session_token: str,
    unlock_type: CustomStickerUnlockType = CustomStickerUnlockType.MANUAL_PDF,
) -> CustomStickerUnlock | None:
    normalized = session_token.strip()
    if not normalized:
        return None
    return (
        db.execute(
            select(CustomStickerUnlock)
            .where(
                CustomStickerUnlock.album_id == album_id,
                CustomStickerUnlock.session_token == normalized,
                CustomStickerUnlock.unlock_type == unlock_type,
            )
            .order_by(CustomStickerUnlock.updated_at.desc(), CustomStickerUnlock.id.desc())
        )
        .scalars()
        .first()
    )


def load_available_custom_sticker_unlock(
    db: Session,
    *,
    album_id: int,
    session_token: str,
    unlock_type: CustomStickerUnlockType = CustomStickerUnlockType.MANUAL_PDF,
) -> CustomStickerUnlock | None:
    normalized = session_token.strip()
    if not normalized:
        return None
    unlocks = (
        db.execute(
            select(CustomStickerUnlock)
            .where(
                CustomStickerUnlock.album_id == album_id,
                CustomStickerUnlock.session_token == normalized,
                CustomStickerUnlock.unlock_type == unlock_type,
                CustomStickerUnlock.status == CustomStickerUnlockStatus.PAGO,
            )
            .order_by(CustomStickerUnlock.paid_at.desc(), CustomStickerUnlock.updated_at.desc(), CustomStickerUnlock.id.desc())
        )
        .scalars()
        .all()
    )
    for unlock in unlocks:
        if custom_sticker_unlock_has_available_uses(unlock):
            return unlock
    return None


def is_custom_sticker_unlocked(
    db: Session,
    *,
    album_id: int,
    session_token: str,
    unlock_type: CustomStickerUnlockType = CustomStickerUnlockType.MANUAL_PDF,
) -> bool:
    unlock = load_available_custom_sticker_unlock(
        db,
        album_id=album_id,
        session_token=session_token,
        unlock_type=unlock_type,
    )
    return unlock is not None


def _custom_sticker_unlock_use_limit(unlock_type: CustomStickerUnlockType) -> int:
    if unlock_type == CustomStickerUnlockType.AI_CREATE:
        return 2
    return 5


def seed_custom_sticker_unlock_use_counters(unlock: CustomStickerUnlock | None) -> CustomStickerUnlock | None:
    if not unlock:
        return unlock
    expected_total = _custom_sticker_unlock_use_limit(unlock.unlock_type)
    unlock.total_uses = expected_total
    unlock.remaining_uses = expected_total
    return unlock


def ensure_custom_sticker_unlock_use_counters(unlock: CustomStickerUnlock | None) -> CustomStickerUnlock | None:
    if not unlock or unlock.status != CustomStickerUnlockStatus.PAGO:
        return unlock
    expected_total = _custom_sticker_unlock_use_limit(unlock.unlock_type)
    if (unlock.total_uses or 0) <= 0:
        unlock.total_uses = expected_total
    if unlock.remaining_uses is None:
        unlock.remaining_uses = unlock.total_uses
    if unlock.remaining_uses < 0:
        unlock.remaining_uses = 0
    return unlock


def custom_sticker_unlock_has_available_uses(unlock: CustomStickerUnlock | None) -> bool:
    unlock = ensure_custom_sticker_unlock_use_counters(unlock)
    return bool(unlock and unlock.status == CustomStickerUnlockStatus.PAGO and (unlock.remaining_uses or 0) > 0)


def has_paid_custom_sticker_unlock(
    db: Session,
    *,
    album_id: int,
    session_token: str,
    unlock_type: CustomStickerUnlockType = CustomStickerUnlockType.MANUAL_PDF,
) -> bool:
    unlock = load_latest_custom_sticker_unlock(
        db,
        album_id=album_id,
        session_token=session_token,
        unlock_type=unlock_type,
    )
    if unlock and unlock.status == CustomStickerUnlockStatus.PAGO:
        return True
    normalized = session_token.strip()
    if not normalized:
        return False
    paid_unlock = (
        db.execute(
            select(CustomStickerUnlock)
            .where(
                CustomStickerUnlock.album_id == album_id,
                CustomStickerUnlock.session_token == normalized,
                CustomStickerUnlock.unlock_type == unlock_type,
                CustomStickerUnlock.status == CustomStickerUnlockStatus.PAGO,
            )
            .order_by(CustomStickerUnlock.paid_at.desc(), CustomStickerUnlock.updated_at.desc(), CustomStickerUnlock.id.desc())
        )
        .scalars()
        .first()
    )
    return paid_unlock is not None


def _custom_sticker_unlock_settings(
    service_settings: ServiceSettings,
    unlock_type: CustomStickerUnlockType,
) -> tuple[bool, int, str | None]:
    if unlock_type == CustomStickerUnlockType.AI_CREATE:
        return (
            service_settings.custom_ai_unlock_enabled,
            service_settings.custom_ai_unlock_price_cents,
            service_settings.custom_ai_unlock_message,
        )
    return (
        service_settings.custom_sticker_unlock_enabled,
        service_settings.custom_sticker_unlock_price_cents,
        service_settings.custom_sticker_unlock_message,
    )


def pending_custom_sticker_unlock_matches_settings(
    unlock: CustomStickerUnlock | None,
    service_settings: ServiceSettings,
    unlock_type: CustomStickerUnlockType,
) -> bool:
    if not unlock or unlock.status != CustomStickerUnlockStatus.PENDENTE:
        return True
    _, amount_cents, _ = _custom_sticker_unlock_settings(service_settings, unlock_type)
    return unlock.amount_cents == amount_cents


def _mercadopago_client() -> MercadoPagoPixClient:
    return MercadoPagoPixClient(settings.mercadopago_access_token)


def _mercadopago_payer_email(session_token: str, album: Album) -> str:
    safe_session = "".join(char for char in session_token.lower() if char.isalnum())[:24] or uuid.uuid4().hex[:12]
    safe_album = "".join(char for char in album.slug.lower() if char.isalnum())[:18] or "album"
    return f"figurinhas+{safe_album}{safe_session}@figurinhas.tech"


def _map_unlock_status(mp_status: str | None, mp_status_detail: str | None) -> CustomStickerUnlockStatus:
    normalized = (mp_status or "").lower()
    detail = (mp_status_detail or "").lower()
    if normalized == "approved":
        return CustomStickerUnlockStatus.PAGO
    if normalized in {"rejected", "cancelled"}:
        return CustomStickerUnlockStatus.FALHOU
    if normalized == "expired" or "expired" in detail:
        return CustomStickerUnlockStatus.EXPIRADO
    return CustomStickerUnlockStatus.PENDENTE


def sync_custom_sticker_unlock_status(unlock: CustomStickerUnlock) -> CustomStickerUnlock:
    if not unlock.mp_payment_id:
        return unlock
    previous_status = unlock.status
    payment = _mercadopago_client().get_payment(unlock.mp_payment_id)
    unlock.mp_status = payment.status or None
    unlock.mp_status_detail = payment.status_detail or None
    unlock.status = _map_unlock_status(payment.status, payment.status_detail)
    unlock.qr_code_base64 = payment.qr_code_base64 or unlock.qr_code_base64
    unlock.qr_code = payment.qr_code or unlock.qr_code
    unlock.ticket_url = payment.ticket_url or unlock.ticket_url
    unlock.expires_at = payment.expires_at or unlock.expires_at
    if unlock.status == CustomStickerUnlockStatus.PAGO:
        unlock.paid_at = payment.paid_at or unlock.paid_at or datetime.now(UTC)
        if previous_status != CustomStickerUnlockStatus.PAGO:
            seed_custom_sticker_unlock_use_counters(unlock)
        ensure_custom_sticker_unlock_use_counters(unlock)
    return unlock


def get_or_create_custom_sticker_unlock(
    db: Session,
    *,
    album: Album,
    sticker: Sticker | None,
    session_token: str,
    service_settings: ServiceSettings,
    unlock_type: CustomStickerUnlockType = CustomStickerUnlockType.MANUAL_PDF,
) -> CustomStickerUnlock:
    normalized_session = session_token.strip()
    if not normalized_session:
        raise ValueError("Sessao invalida para liberar a Minha Figurinha.")
    if sticker is not None:
        if sticker.source_type != StickerSourceType.GENERATED:
            raise ValueError("A liberacao paga so vale para a Minha Figurinha.")
        if sticker.session_token != normalized_session:
            raise ValueError("Essa Minha Figurinha nao pertence a esta sessao.")

    enabled, amount_cents, _ = _custom_sticker_unlock_settings(service_settings, unlock_type)
    if not enabled:
        if unlock_type == CustomStickerUnlockType.AI_CREATE:
            raise ValueError("A cobranca antes da criacao com IA nao esta ativa no momento.")
        raise ValueError("A cobranca da Minha Figurinha nao esta ativa no momento.")
    if amount_cents <= 0:
        if unlock_type == CustomStickerUnlockType.AI_CREATE:
            raise ValueError("Configure o valor da criacao com IA antes de cobrar.")
        raise ValueError("Configure o valor da liberacao da Minha Figurinha antes de cobrar.")

    active_paid_unlock = load_available_custom_sticker_unlock(
        db,
        album_id=album.id,
        session_token=normalized_session,
        unlock_type=unlock_type,
    )
    if active_paid_unlock:
        return active_paid_unlock

    current = load_latest_custom_sticker_unlock(
        db,
        album_id=album.id,
        session_token=normalized_session,
        unlock_type=unlock_type,
    )
    if current and current.status == CustomStickerUnlockStatus.PENDENTE:
        current = sync_custom_sticker_unlock_status(current)
        if current.status == CustomStickerUnlockStatus.PENDENTE and pending_custom_sticker_unlock_matches_settings(
            current,
            service_settings,
            unlock_type,
        ):
            return current
        if current.status == CustomStickerUnlockStatus.PENDENTE:
            current.status = CustomStickerUnlockStatus.EXPIRADO
            current.mp_status_detail = "price_changed"
    if current and current.status == CustomStickerUnlockStatus.PAGO:
        ensure_custom_sticker_unlock_use_counters(current)
        if custom_sticker_unlock_has_available_uses(current):
            return current

    payment = _mercadopago_client().create_pix_payment(
        amount_cents=amount_cents,
        description=(
            f"Criacao com IA - {album.name}"
            if unlock_type == CustomStickerUnlockType.AI_CREATE
            else f"Liberacao da Minha Figurinha - {album.name}"
        ),
        payer_email=_mercadopago_payer_email(normalized_session, album),
        external_reference=(
            f"fig-{unlock_type.value.lower()}-{album.slug}-{normalized_session[:24]}-{uuid.uuid4().hex[:8]}"
        ),
    )

    unlock = CustomStickerUnlock(
        album_id=album.id,
        sticker_id=sticker.id if sticker is not None else None,
        session_token=normalized_session,
        unlock_type=unlock_type,
        amount_cents=amount_cents,
        total_uses=_custom_sticker_unlock_use_limit(unlock_type),
        remaining_uses=_custom_sticker_unlock_use_limit(unlock_type),
        status=_map_unlock_status(payment.status, payment.status_detail),
        mp_payment_id=payment.payment_id or None,
        mp_external_reference=payment.external_reference or None,
        mp_status=payment.status or None,
        mp_status_detail=payment.status_detail or None,
        qr_code_base64=payment.qr_code_base64,
        qr_code=payment.qr_code,
        ticket_url=payment.ticket_url,
        expires_at=payment.expires_at,
        paid_at=payment.paid_at,
    )
    if unlock.status == CustomStickerUnlockStatus.PAGO:
        seed_custom_sticker_unlock_use_counters(unlock)
    else:
        unlock.total_uses = _custom_sticker_unlock_use_limit(unlock_type)
        unlock.remaining_uses = _custom_sticker_unlock_use_limit(unlock_type)
    ensure_custom_sticker_unlock_use_counters(unlock)
    db.add(unlock)
    db.flush()
    return unlock


def consume_custom_sticker_unlock_use(
    db: Session,
    *,
    album_id: int,
    session_token: str,
    unlock_type: CustomStickerUnlockType,
) -> CustomStickerUnlock:
    unlock = load_available_custom_sticker_unlock(
        db,
        album_id=album_id,
        session_token=session_token,
        unlock_type=unlock_type,
    )
    if not custom_sticker_unlock_has_available_uses(unlock):
        if unlock_type == CustomStickerUnlockType.AI_CREATE:
            raise ValueError("Seu saldo da criacao com IA acabou. Pague novamente para gerar outra figurinha.")
        raise ValueError("Seu saldo da Minha Figurinha acabou. Pague novamente para liberar outro PDF.")
    unlock.remaining_uses = max((unlock.remaining_uses or 0) - 1, 0)
    db.flush()
    return unlock


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
    template_id: int | None,
    requested_composition_mode: CustomTemplateCompositionMode | None,
    name: str,
    profile_type: CustomProfileType,
    category_type: CustomCategoryType,
    position_type: CustomPositionType,
    birth_date_text: str | None,
    height_text: str | None,
    weight_text: str | None,
    city_or_team: str | None,
    uploaded_photo_bytes: bytes,
    prepared_portrait_bytes: bytes | None = None,
    photo_offset_x: float | None = None,
    photo_offset_y: float | None = None,
    photo_scale: float | None = None,
    photo_rotation: float | None = None,
    progress_callback: Callable[[int, str], None] | None = None,
) -> Sticker:
    def report(progress: int, message: str) -> None:
        if progress_callback:
            progress_callback(progress, message)

    session_token = session_token.strip()
    if not session_token:
        raise ValueError("Sessao invalida para criar a figurinha personalizada.")
    profile_type = normalize_custom_profile_type(profile_type)

    report(8, "Validando o modelo...")
    service_settings = get_or_create_service_settings(db)
    template_sticker = resolve_generated_template_sticker(db, album)
    selected_template = resolve_custom_template_for_generation(
        db,
        album_id=album.id,
        template_id=template_id,
        profile_type=profile_type,
        category_type=category_type,
        position_type=position_type,
    )
    if template_id and selected_template is None:
        raise ValueError("O modelo escolhido nao pertence a esse album, perfil ou posicao.")
    if (
        requested_composition_mode == CustomTemplateCompositionMode.AI_OPTIONAL
        and service_settings.custom_generation_mode != CustomTemplateCompositionMode.AI_OPTIONAL
    ):
        raise ValueError("A criacao por IA nao esta ativa no momento.")

    resolved_composition_mode = (
        requested_composition_mode
        or (selected_template.composition_mode if selected_template else service_settings.custom_generation_mode)
    )
    if (
        resolved_composition_mode == CustomTemplateCompositionMode.AI_OPTIONAL
        and service_settings.custom_ai_unlock_enabled
        and not is_custom_sticker_unlocked(
            db,
            album_id=album.id,
            session_token=session_token,
            unlock_type=CustomStickerUnlockType.AI_CREATE,
        )
    ):
        raise ValueError("Pague para liberar a criacao com IA antes de continuar.")
    if resolved_composition_mode == CustomTemplateCompositionMode.LAYERS:
        if not custom_template_supports_layer_composition(selected_template):
            if template_id:
                raise ValueError("O modelo selecionado ainda nao esta pronto para montagem manual.")
            selected_template = resolve_custom_template_for_generation(
                db,
                album_id=album.id,
                template_id=None,
                profile_type=profile_type,
                category_type=category_type,
                position_type=position_type,
                require_layer_ready=True,
            )
        if not custom_template_supports_layer_composition(selected_template):
            raise ValueError("Ainda nao ha um modelo manual pronto para esse perfil e posicao.")
    report(22, "Preparando o modelo...")
    collection, page = ensure_generated_collection_page(db, album, template_sticker)
    delete_generated_stickers_for_session(db, album.id, session_token)

    width_px: int | None = None
    height_px: int | None = None
    export_width_pt: float | None = None
    export_height_pt: float | None = None

    if template_sticker.collection.source_pdf_path:
        source_pdf_path = settings.storage_root / template_sticker.collection.source_pdf_path
        with fitz.open(source_pdf_path) as document:
            page_rect = document.load_page(template_sticker.page.page_number - 1).rect
            export_width_pt = float(page_rect.width * template_sticker.width_ratio)
            export_height_pt = float(page_rect.height * template_sticker.height_ratio)

        scale = max(settings.export_render_scale, 6.0)
        width_px = max(int(round(export_width_pt * scale)), 680)
        height_px = max(int(round(export_height_pt * scale)), 920)
    else:
        rendered_page = (template_sticker.page.image_path or "").startswith("source_document_pages/")
        page_width_pt, page_height_pt = _page_dimensions_for_export(
            template_sticker.page.width,
            template_sticker.page.height,
            rendered_page=rendered_page,
        )
        scale = max(settings.export_render_scale, 6.0)
        export_width_pt = float(page_width_pt * template_sticker.width_ratio)
        export_height_pt = float(page_height_pt * template_sticker.height_ratio)
        width_px = max(int(round(export_width_pt * scale)), 680)
        height_px = max(int(round(export_height_pt * scale)), 920)

    render = generate_custom_sticker_render(
        settings,
        uploaded_photo_bytes=uploaded_photo_bytes,
        prepared_portrait_bytes=prepared_portrait_bytes,
        name=name.strip(),
        profile_type=profile_type.value,
        composition_mode=resolved_composition_mode.value,
        template_layers=(
            [
                {
                    "layer_type": layer.layer_type.value,
                    "label": layer.label,
                    "file_path": str((settings.storage_root / layer.file_path).resolve()) if layer.file_path else "",
                    "z_index": layer.z_index,
                    "is_active": layer.is_active,
                }
                for layer in selected_template.layers
            ]
            if selected_template
            else None
        ),
        photo_slot=(
            {
                "x": selected_template.photo_slot.x,
                "y": selected_template.photo_slot.y,
                "width": selected_template.photo_slot.width,
                "height": selected_template.photo_slot.height,
                "default_scale": selected_template.photo_slot.default_scale,
                "min_scale": selected_template.photo_slot.min_scale,
                "max_scale": selected_template.photo_slot.max_scale,
                "portrait_z_index": resolve_effective_portrait_z_index(selected_template),
                "anchor_x": selected_template.photo_slot.anchor_x,
                "anchor_y": selected_template.photo_slot.anchor_y,
                "visible_x": selected_template.photo_slot.visible_x,
                "visible_y": selected_template.photo_slot.visible_y,
                "visible_width": selected_template.photo_slot.visible_width,
                "visible_height": selected_template.photo_slot.visible_height,
            }
            if selected_template and selected_template.photo_slot
            else None
        ),
        text_slots=(
            [
                {
                    "field_name": slot.field_name.value,
                    "x": slot.x,
                    "y": slot.y,
                    "width": slot.width,
                    "font_size": slot.font_size,
                    "font_weight": slot.font_weight,
                    "text_align": slot.text_align,
                    "color": slot.color,
                }
                for slot in selected_template.text_slots
            ]
            if selected_template
            else None
        ),
        birth_date_text=(birth_date_text or "").strip() or None,
        height_text=(height_text or "").strip() or None,
        weight_text=(weight_text or "").strip() or None,
        city_or_team=(city_or_team or "").strip() or None,
        target_width_px=width_px,
        target_height_px=height_px,
        photo_offset_x=photo_offset_x,
        photo_offset_y=photo_offset_y,
        photo_scale=photo_scale,
        photo_rotation=photo_rotation,
        base_template_path=(
            get_custom_base_file_path(service_settings, profile_type)
            if resolved_composition_mode == CustomTemplateCompositionMode.AI_OPTIONAL
            else resolve_template_preview_base_path(
                service_settings,
                template=selected_template,
                profile_type=profile_type,
            )
        ),
        prompt_template=service_settings.custom_prompt_template,
        progress_callback=progress_callback,
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
    report(96, "Salvando no album...")
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
        template=selected_template,
        session_token=session_token,
        profile_type=profile_type,
        custom_category_type=category_type,
        custom_position_type=position_type,
        composition_mode_used=resolved_composition_mode,
        birth_date_text=(birth_date_text or "").strip() or None,
        height_text=(height_text or "").strip() or None,
        weight_text=(weight_text or "").strip() or None,
        city_or_team=(city_or_team or "").strip() or None,
        uploaded_photo_path=str(upload_path.relative_to(settings.storage_root).as_posix()),
        generated_portrait_path=str(portrait_path.relative_to(settings.storage_root).as_posix()),
        photo_offset_x=photo_offset_x,
        photo_offset_y=photo_offset_y,
        photo_scale=photo_scale,
        photo_rotation=photo_rotation,
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
    if (
        resolved_composition_mode == CustomTemplateCompositionMode.AI_OPTIONAL
        and service_settings.custom_ai_unlock_enabled
    ):
        consume_custom_sticker_unlock_use(
            db,
            album_id=album.id,
            session_token=session_token,
            unlock_type=CustomStickerUnlockType.AI_CREATE,
        )
    return sticker
def _resolve_export_extra_documents(
    album: Album,
    extra_selections: list[dict] | None,
    db: Session,
) -> tuple[list[dict], list[dict], dict[str, int]]:
    if not extra_selections:
        return [], [], {"page_count_cache_hits": 0, "page_count_cache_misses": 0}

    normalized_quantities: dict[int, int] = defaultdict(int)
    interleaved_collection_ids: set[int] = set()
    for item in extra_selections:
        collection_id = int(item.get("collection_id") or 0)
        quantity = int(item.get("quantity") or 0)
        apply_to_all_sheets = bool(item.get("apply_to_all_sheets"))
        if collection_id <= 0:
            continue
        if apply_to_all_sheets:
            interleaved_collection_ids.add(collection_id)
            continue
        if quantity <= 0:
            continue
        normalized_quantities[collection_id] += quantity

    if not normalized_quantities and not interleaved_collection_ids:
        return [], []

    collections = db.execute(
        select(Collection).where(
            Collection.id.in_(sorted(set(normalized_quantities.keys()) | interleaved_collection_ids)),
            Collection.album_id == album.id,
        )
    ).scalars().all()
    collections_by_id = {collection.id: collection for collection in collections}

    append_documents: list[dict] = []
    interleaved_documents: list[dict] = []
    page_count_cache_hits = 0
    page_count_cache_misses = 0

    def supports_interleaved_back(collection: Collection) -> bool:
        slug = (collection.slug or "").strip().lower()
        name = (collection.name or "").strip().upper()
        return slug == "verso" or name == "VERSO"

    for collection_id, requested_quantity in normalized_quantities.items():
        collection = collections_by_id.get(collection_id)
        if not collection:
            raise ValueError("Nao foi possivel localizar um dos extras selecionados para esse album.")

        export_mode = (
            collection.export_mode
            if isinstance(collection.export_mode, CollectionExportMode)
            else CollectionExportMode((collection.export_mode or CollectionExportMode.GRID.value))
        )
        if export_mode != CollectionExportMode.APPEND_FULL_PDF:
            raise ValueError(f"A colecao {collection.name} nao esta configurada como extra de PDF.")
        if not collection.source_pdf_path:
            raise ValueError(f"A colecao {collection.name} ainda nao possui PDF completo para anexar.")

        source_pdf_path = settings.storage_root / collection.source_pdf_path
        if not source_pdf_path.exists():
            raise FileNotFoundError(f"PDF completo da colecao {collection.name} nao encontrado.")

        max_quantity = max(0, int(collection.max_quantity_per_order or 0))
        quantity = requested_quantity if max_quantity <= 0 else min(requested_quantity, max_quantity)
        if quantity <= 0:
            continue

        page_count_signature = _extra_pdf_page_count_signature(collection, source_pdf_path)
        cached_page_count = _get_cached_extra_pdf_page_count(collection, page_count_signature)
        if cached_page_count is not None:
            page_count_cache_hits += 1
            page_count = cached_page_count
        else:
            page_count_cache_misses += 1
            with fitz.open(source_pdf_path) as document:
                page_count = int(document.page_count)
            _store_cached_extra_pdf_page_count(collection, page_count_signature, page_count)
        if page_count <= 0:
            raise ValueError(f"O PDF completo da colecao {collection.name} nao possui paginas validas.")

        append_documents.append(
            {
                "collection_id": collection.id,
                "collection_name": collection.name,
                "file_path": source_pdf_path,
                "page_count": page_count,
                "quantity": quantity,
            }
        )

    for collection_id in sorted(interleaved_collection_ids):
        collection = collections_by_id.get(collection_id)
        if not collection:
            raise ValueError("Nao foi possivel localizar um dos extras selecionados para esse album.")
        if not supports_interleaved_back(collection):
            raise ValueError(f"A colecao {collection.name} nao pode ser usada como verso intercalado.")
        export_mode = (
            collection.export_mode
            if isinstance(collection.export_mode, CollectionExportMode)
            else CollectionExportMode((collection.export_mode or CollectionExportMode.GRID.value))
        )
        if export_mode != CollectionExportMode.APPEND_FULL_PDF:
            raise ValueError(f"A colecao {collection.name} nao esta configurada como extra de PDF.")
        if not collection.source_pdf_path:
            raise ValueError(f"A colecao {collection.name} ainda nao possui PDF completo para usar como verso.")

        source_pdf_path = settings.storage_root / collection.source_pdf_path
        if not source_pdf_path.exists():
            raise FileNotFoundError(f"PDF completo da colecao {collection.name} nao encontrado.")

        page_count_signature = _extra_pdf_page_count_signature(collection, source_pdf_path)
        cached_page_count = _get_cached_extra_pdf_page_count(collection, page_count_signature)
        if cached_page_count is not None:
            page_count_cache_hits += 1
            page_count = cached_page_count
        else:
            page_count_cache_misses += 1
            with fitz.open(source_pdf_path) as document:
                page_count = int(document.page_count)
            _store_cached_extra_pdf_page_count(collection, page_count_signature, page_count)
        if page_count <= 0:
            raise ValueError(f"O PDF completo da colecao {collection.name} nao possui paginas validas.")

        interleaved_documents.append(
            {
                "collection_id": collection.id,
                "collection_name": collection.name,
                "file_path": source_pdf_path,
                "page_count": page_count,
                "interleave_first_page_only": True,
            }
        )

    return append_documents, interleaved_documents, {
        "page_count_cache_hits": page_count_cache_hits,
        "page_count_cache_misses": page_count_cache_misses,
    }


def prepare_export_plan(
    album: Album,
    stickers: list[Sticker],
    db: Session,
    extra_selections: list[dict] | None = None,
) -> dict:
    plan_started_at = time.perf_counter()
    stage_timings_ms: dict[str, int] = {}

    def mark_stage(stage_name: str, started_at: float) -> None:
        stage_timings_ms[stage_name] = round((time.perf_counter() - started_at) * 1000)

    stage_started_at = time.perf_counter()
    append_documents, interleaved_documents, extra_document_stats = _resolve_export_extra_documents(
        album,
        extra_selections,
        db,
    )
    mark_stage("extras", stage_started_at)
    if not stickers and not append_documents:
        raise ValueError("Selecione pelo menos uma figurinha ou extra para exportar.")

    selected_collection_ids = sorted({sticker.collection_id for sticker in stickers})
    collections = []
    if selected_collection_ids:
        stage_started_at = time.perf_counter()
        collections = db.execute(
            select(Collection)
            .options(selectinload(Collection.pages))
            .where(Collection.id.in_(selected_collection_ids))
        ).scalars().all()
        mark_stage("selected_collections", stage_started_at)
    collections_by_id = {collection.id: collection for collection in collections}
    stage_started_at = time.perf_counter()
    template_collections = db.execute(
        select(Collection)
        .options(selectinload(Collection.pages))
        .where(
            Collection.album_id == album.id,
            Collection.is_system.is_(False),
            Collection.status == CollectionStatus.PUBLICADA,
        )
    ).scalars().all()
    mark_stage("template_collections", stage_started_at)

    source_pdf_paths: dict[int, Path] = {}
    page_sizes_by_collection: dict[int, dict[int, tuple[float, float]]] = {}
    stage_started_at = time.perf_counter()
    source_document_layout_signature = _source_document_layout_signature(album.id, db)
    cached_source_document_layouts = _get_cached_source_document_layouts(album.id, source_document_layout_signature)
    if cached_source_document_layouts is not None:
        source_document_layout_cache_hit = True
        template_layouts: dict[tuple[float, float], dict] = cached_source_document_layouts
    else:
        source_document_layout_cache_hit = False
        template_layouts = _build_source_document_export_layouts(album, db)
        _store_cached_source_document_layouts(album.id, source_document_layout_signature, template_layouts)
    mark_stage("source_document_layouts", stage_started_at)
    template_layout_cache_hits = 0
    template_layout_cache_misses = 0
    page_size_cache_hits = 0
    page_size_cache_misses = 0

    def resolve_page_sizes(collection: Collection) -> dict[int, tuple[float, float]]:
        nonlocal page_size_cache_hits, page_size_cache_misses
        source_pdf_path: Path | None = None
        if collection.source_pdf_path:
            source_pdf_path = settings.storage_root / collection.source_pdf_path
            if not source_pdf_path.exists():
                raise FileNotFoundError(f"PDF de origem da colecao {collection.name} nao encontrado.")
            source_pdf_paths[collection.id] = source_pdf_path

        page_sizes_signature = _collection_page_sizes_signature(collection, source_pdf_path)
        cached_page_sizes = _get_cached_collection_page_sizes(collection, page_sizes_signature)
        if cached_page_sizes is not None:
            page_size_cache_hits += 1
            return cached_page_sizes

        page_size_cache_misses += 1
        if source_pdf_path is not None:
            with fitz.open(source_pdf_path) as document:
                page_sizes = {
                    page_index + 1: (
                        float(document.load_page(page_index).rect.width),
                        float(document.load_page(page_index).rect.height),
                    )
                    for page_index in range(document.page_count)
                }
            _store_cached_collection_page_sizes(collection, page_sizes_signature, page_sizes)
            return page_sizes
        rendered_page = any((page.image_path or "").startswith("source_document_pages/") for page in collection.pages)
        page_sizes = {
            page.page_number: _page_dimensions_for_export(page.width, page.height, rendered_page=rendered_page)
            for page in collection.pages
        }
        _store_cached_collection_page_sizes(collection, page_sizes_signature, page_sizes)
        return page_sizes

    stage_started_at = time.perf_counter()
    for collection in collections:
        if collection.album_id != album.id:
            raise ValueError("Nao e possivel misturar figurinhas de albuns diferentes.")
        page_sizes_by_collection[collection.id] = resolve_page_sizes(collection)
    mark_stage("selected_page_sizes", stage_started_at)

    stage_started_at = time.perf_counter()
    template_collection_ids = [collection.id for collection in template_collections]
    template_sticker_aggregates: dict[int, dict[str, int | datetime | None]] = {}
    if template_collection_ids:
        template_sticker_aggregates = {
            collection_id: {
                "count": sticker_count,
                "latest_updated_at": latest_updated_at,
            }
            for collection_id, sticker_count, latest_updated_at in db.execute(
                select(
                    Sticker.collection_id,
                    func.count(Sticker.id),
                    func.max(Sticker.updated_at),
                )
                .where(
                    Sticker.collection_id.in_(template_collection_ids),
                    Sticker.active.is_(True),
                    Sticker.source_type == StickerSourceType.PDF,
                )
                .group_by(Sticker.collection_id)
            ).all()
        }
    for collection in template_collections:
        aggregate = template_sticker_aggregates.get(collection.id, {})
        layout_signature = _template_collection_layout_signature(
            collection,
            int(aggregate.get("count") or 0),
            aggregate.get("latest_updated_at"),
        )
        cached_layouts = _get_cached_template_export_layouts(collection, layout_signature)
        if cached_layouts is not None:
            template_layout_cache_hits += 1
            for size_key, layout in cached_layouts.items():
                template_layouts.setdefault(size_key, layout)
            continue

        template_layout_cache_misses += 1
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

        collection_layouts = _build_template_export_layouts(template_stickers, page_sizes)
        _store_cached_template_export_layouts(collection, layout_signature, collection_layouts)
        for size_key, layout in collection_layouts.items():
            template_layouts.setdefault(size_key, layout)
    mark_stage("template_layouts", stage_started_at)

    if not template_layouts:
        raise ValueError("Nao foi encontrada uma grade valida de exportacao para esse album.")

    stage_started_at = time.perf_counter()
    for sticker in stickers:
        if sticker.source_type != StickerSourceType.PDF:
            continue
        if _sticker_asset_path_for_export(sticker):
            continue
        if sticker.collection_id not in source_pdf_paths:
            raise ValueError(f"A colecao {sticker.collection.name} nao possui PDF de origem para exportacao.")
    mark_stage("validate_selected_stickers", stage_started_at)

    stage_started_at = time.perf_counter()
    selected_groups: dict[tuple[float, float], list[Sticker]] = defaultdict(list)
    for sticker in stickers:
        selected_groups[_sticker_size_key(sticker, page_sizes_by_collection)].append(sticker)
    mark_stage("group_selected_stickers", stage_started_at)

    stage_started_at = time.perf_counter()
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
    mark_stage("build_batches", stage_started_at)

    append_page_count = sum(int(item["page_count"]) * int(item["quantity"]) for item in append_documents)
    interleaved_page_count = len(batches) * len(interleaved_documents)
    total_duration_ms = round((time.perf_counter() - plan_started_at) * 1000)
    _log_export_plan_performance(
        "prepare_export_plan_completed",
        album=album.slug,
        stickers=len(stickers),
        extras=len(extra_selections or []),
        selected_collections=len(selected_collection_ids),
        template_collections=len(template_collections),
        size_groups=len(selected_groups),
        batches=len(batches),
        append_docs=len(append_documents),
        interleaved_docs=len(interleaved_documents),
        total_ms=total_duration_ms,
        extras_ms=stage_timings_ms.get("extras", 0),
        selected_collections_ms=stage_timings_ms.get("selected_collections", 0),
        template_collections_ms=stage_timings_ms.get("template_collections", 0),
        source_document_layouts_ms=stage_timings_ms.get("source_document_layouts", 0),
        source_document_layout_cache_hit=int(source_document_layout_cache_hit),
        selected_page_sizes_ms=stage_timings_ms.get("selected_page_sizes", 0),
        page_size_cache_hits=page_size_cache_hits,
        page_size_cache_misses=page_size_cache_misses,
        template_layouts_ms=stage_timings_ms.get("template_layouts", 0),
        template_layout_cache_hits=template_layout_cache_hits,
        template_layout_cache_misses=template_layout_cache_misses,
        extra_page_count_cache_hits=int(extra_document_stats.get("page_count_cache_hits", 0)),
        extra_page_count_cache_misses=int(extra_document_stats.get("page_count_cache_misses", 0)),
        validate_selected_stickers_ms=stage_timings_ms.get("validate_selected_stickers", 0),
        group_selected_stickers_ms=stage_timings_ms.get("group_selected_stickers", 0),
        build_batches_ms=stage_timings_ms.get("build_batches", 0),
    )

    return {
        "source_pdf_paths": source_pdf_paths,
        "page_sizes_by_collection": page_sizes_by_collection,
        "batches": batches,
        "append_documents": append_documents,
        "interleaved_documents": interleaved_documents,
        "append_page_count": append_page_count,
        "interleaved_page_count": interleaved_page_count,
        "sheet_count": len(batches) + append_page_count + interleaved_page_count,
    }


def build_export_pdf(
    album: Album,
    stickers: list[Sticker],
    db: Session,
    plan: dict | None = None,
    extra_selections: list[dict] | None = None,
    progress_callback: Callable[[int, str], None] | None = None,
) -> Export:
    def report(progress: int, message: str) -> None:
        if progress_callback:
            progress_callback(progress, message)

    report(8, "Separando suas figurinhas...")
    export_dir = settings.storage_root / "exports" / album.slug
    export_dir.mkdir(parents=True, exist_ok=True)
    export_key = f"{datetime.utcnow():%Y%m%d-%H%M%S}-{uuid.uuid4().hex[:8]}"
    export_path = export_dir / f"{album.slug}-{export_key}.pdf"

    plan = plan or prepare_export_plan(album, stickers, db, extra_selections=extra_selections)
    page_sizes_by_collection = plan["page_sizes_by_collection"]
    batches = plan["batches"]
    append_documents = plan.get("append_documents", [])
    interleaved_documents = plan.get("interleaved_documents", [])
    initial_page_size = batches[0]["page_size"] if batches else (595.2756, 841.8898)

    documents: dict[int, fitz.Document] = {}
    extra_documents: dict[str, fitz.Document] = {}
    try:
        pdf = canvas.Canvas(str(export_path), pagesize=initial_page_size)
        pdf.setTitle(f"{album.name} - figurinhas selecionadas")

        is_first_page = True
        total_pages = max(plan.get("sheet_count", len(batches)), 1)
        current_page_number = 0
        for batch_index, batch in enumerate(batches, start=1):
            current_page_number += 1
            report(
                20 + int(((current_page_number - 1) / total_pages) * 58),
                f"Montando pagina {current_page_number} de {total_pages}...",
            )
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
                bleed_x = min(0.6, slot["width_pt"] * 0.01)
                bleed_y = min(0.6, slot["height_pt"] * 0.01)
                clip_path = pdf.beginPath()
                clip_path.rect(x_position, y_position, slot["width_pt"], slot["height_pt"])
                pdf.saveState()
                pdf.clipPath(clip_path, stroke=0, fill=0)
                pdf.drawImage(
                    ImageReader(io.BytesIO(image_bytes)),
                    x_position - bleed_x,
                    y_position - bleed_y,
                    width=slot["width_pt"] + (bleed_x * 2),
                    height=slot["height_pt"] + (bleed_y * 2),
                    preserveAspectRatio=False,
                    mask="auto",
                )
                pdf.restoreState()

            _draw_export_cut_reference_lines(pdf, batch["placements"], page_height)
            is_first_page = False

            for interleaved_document in interleaved_documents:
                document_key = str(interleaved_document["file_path"])
                document = extra_documents.get(document_key)
                if document is None:
                    document = fitz.open(interleaved_document["file_path"])
                    extra_documents[document_key] = document

                current_page_number += 1
                report(
                    20 + int(((current_page_number - 1) / total_pages) * 58),
                    f"Aplicando verso {interleaved_document['collection_name']} ({current_page_number} de {total_pages})...",
                )
                page = document.load_page(0)
                back_width = float(page.rect.width)
                back_height = float(page.rect.height)
                pdf.showPage()
                pdf.setPageSize((back_width, back_height))
                pixmap = page.get_pixmap(matrix=fitz.Matrix(2, 2), alpha=False)
                pdf.drawImage(
                    ImageReader(io.BytesIO(pixmap.tobytes("png"))),
                    0,
                    0,
                    width=back_width,
                    height=back_height,
                    preserveAspectRatio=False,
                    mask="auto",
                )

        for extra_document in append_documents:
            document_key = str(extra_document["file_path"])
            document = extra_documents.get(document_key)
            if document is None:
                document = fitz.open(extra_document["file_path"])
                extra_documents[document_key] = document

            for repetition_index in range(int(extra_document["quantity"])):
                for page_index in range(int(extra_document["page_count"])):
                    current_page_number += 1
                    report(
                        20 + int(((current_page_number - 1) / total_pages) * 58),
                        f"Anexando {extra_document['collection_name']} ({current_page_number} de {total_pages})...",
                    )
                    page = document.load_page(page_index)
                    page_width = float(page.rect.width)
                    page_height = float(page.rect.height)
                    if not is_first_page:
                        pdf.showPage()
                    pdf.setPageSize((page_width, page_height))
                    pixmap = page.get_pixmap(matrix=fitz.Matrix(2, 2), alpha=False)
                    pdf.drawImage(
                        ImageReader(io.BytesIO(pixmap.tobytes("png"))),
                        0,
                        0,
                        width=page_width,
                        height=page_height,
                        preserveAspectRatio=False,
                        mask="auto",
                    )
                    is_first_page = False

        report(88, "Gerando o PDF...")
        pdf.save()
    finally:
        for document in documents.values():
            document.close()
        for document in extra_documents.values():
            document.close()

    report(98, "Finalizando download...")
    if stickers:
        primary_collection = next(
            (sticker.collection for sticker in stickers if not sticker.collection.is_system),
            stickers[0].collection,
        )
    else:
        primary_collection = None
        for item in extra_selections or []:
            collection_id = int(item.get("collection_id") or 0)
            quantity = int(item.get("quantity") or 0)
            apply_to_all_sheets = bool(item.get("apply_to_all_sheets"))
            if collection_id > 0 and (quantity > 0 or apply_to_all_sheets):
                primary_collection = db.get(Collection, collection_id)
                if primary_collection is not None:
                    break
        if primary_collection is None:
            raise ValueError("Nao foi possivel identificar a colecao principal desse export.")
    export_record = Export(
        collection=primary_collection,
        file_path=str(export_path.relative_to(settings.storage_root).as_posix()),
        item_count=len(stickers),
        sheet_count=int(plan.get("sheet_count", 0) or 0) or None,
        extra_page_count=int(plan.get("append_page_count", 0) or 0) + int(plan.get("interleaved_page_count", 0) or 0),
    )
    db.add(export_record)
    db.flush()
    return export_record


def _sticker_asset_path_for_export(sticker: Sticker) -> Path | None:
    for relative_path in (sticker.crop_path, sticker.preview_path):
        if not relative_path:
            continue
        candidate = settings.storage_root / relative_path
        if candidate.exists():
            return candidate
    return None


def _draw_export_cut_reference_lines(pdf: canvas.Canvas, placements: list[tuple[dict, Sticker]], page_height: float) -> None:
    if not placements:
        return

    slots = [slot for slot, _ in placements]
    widths = [slot["width_pt"] for slot in slots]
    heights = [slot["height_pt"] for slot in slots]
    median_width = float(median(widths))
    median_height = float(median(heights))
    tolerance_x = max(0.5, median_width * 0.02)
    tolerance_y = max(0.5, median_height * 0.02)

    x_edges = _cluster_slot_axis(
        [slot["x_pt"] for slot in slots] + [slot["x_pt"] + slot["width_pt"] for slot in slots],
        tolerance_x,
    )
    y_edges = _cluster_slot_axis(
        [slot["y_pt"] for slot in slots] + [slot["y_pt"] + slot["height_pt"] for slot in slots],
        tolerance_y,
    )
    if len(x_edges) < 2 or len(y_edges) < 2:
        return

    left_edge = min(x_edges)
    right_edge = max(x_edges)
    top_edge = min(y_edges)
    bottom_edge = max(y_edges)

    pdf.saveState()
    pdf.setStrokeColor(HexColor("#34373a"))
    try:
        pdf.setStrokeAlpha(0.6)
    except AttributeError:
        pass
    pdf.setLineWidth(0.5)
    pdf.setLineJoin(1)
    pdf.setLineCap(1)

    vertical_start = page_height - bottom_edge
    vertical_end = page_height - top_edge
    for x_edge in x_edges:
        pdf.line(x_edge, vertical_start, x_edge, vertical_end)

    for y_edge in y_edges:
        canvas_y = page_height - y_edge
        pdf.line(left_edge, canvas_y, right_edge, canvas_y)

    pdf.restoreState()


def build_order_quote(album: Album, stickers: list[Sticker], db: Session, service_settings: ServiceSettings) -> dict:
    return build_order_quote_with_extras(album, stickers, [], db, service_settings)


def build_order_quote_with_extras(
    album: Album,
    stickers: list[Sticker],
    extra_selections: list[dict],
    db: Session,
    service_settings: ServiceSettings,
) -> dict:
    plan = prepare_export_plan(album, stickers, db, extra_selections=extra_selections)
    item_count = len(stickers)
    sheet_count = plan["sheet_count"]
    extra_page_count = int(plan.get("append_page_count", 0) or 0) + int(plan.get("interleaved_page_count", 0) or 0)
    selected_extra_count = sum(int(item.get("quantity") or 0) for item in extra_selections)
    selected_extra_count += int(plan.get("interleaved_page_count", 0) or 0)
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
        "extra_page_count": extra_page_count,
        "selected_extra_count": selected_extra_count,
        "pix_key": service_settings.pix_key,
        "pix_holder": service_settings.pix_holder,
        "pickup_note": service_settings.pickup_note,
    }


def _page_dimensions_for_export(width: float, height: float, *, rendered_page: bool) -> tuple[float, float]:
    if rendered_page:
        return float(width) / settings.render_scale, float(height) / settings.render_scale
    return float(width), float(height)


def _source_document_page_dimensions_for_export(page: SourceDocumentPage) -> tuple[float, float]:
    return _page_dimensions_for_export(page.width, page.height, rendered_page=True)


def _source_detected_sticker_box_points(
    detected_sticker: SourceDetectedSticker,
    page: SourceDocumentPage,
) -> tuple[float, float, float, float]:
    page_width, page_height = _source_document_page_dimensions_for_export(page)
    return (
        page_width * detected_sticker.x_ratio,
        page_height * detected_sticker.y_ratio,
        page_width * detected_sticker.width_ratio,
        page_height * detected_sticker.height_ratio,
    )


def _source_detected_sticker_size_key(
    detected_sticker: SourceDetectedSticker,
    page: SourceDocumentPage,
) -> tuple[float, float]:
    _, _, width_pt, height_pt = _source_detected_sticker_box_points(detected_sticker, page)
    return round(width_pt), round(height_pt)


def _cluster_slot_axis(values: list[float], tolerance: float) -> list[float]:
    if not values:
        return []

    sorted_values = sorted(values)
    clusters: list[list[float]] = [[sorted_values[0]]]
    for value in sorted_values[1:]:
        current_cluster = clusters[-1]
        current_center = median(current_cluster)
        if abs(value - current_center) <= tolerance:
            current_cluster.append(value)
        else:
            clusters.append([value])

    return [float(median(cluster)) for cluster in clusters]


def _normalize_export_slots(slots: list[dict]) -> list[dict]:
    if len(slots) < 4:
        return slots

    widths = [slot["width_pt"] for slot in slots]
    heights = [slot["height_pt"] for slot in slots]
    median_width = float(median(widths))
    median_height = float(median(heights))
    tolerance_x = max(0.75, median_width * 0.18)
    tolerance_y = max(0.75, median_height * 0.18)
    x_clusters = _cluster_slot_axis([slot["x_pt"] for slot in slots], tolerance_x)
    y_clusters = _cluster_slot_axis([slot["y_pt"] for slot in slots], tolerance_y)
    if not x_clusters or not y_clusters:
        return slots

    x_origin = min(x_clusters)
    y_origin = min(y_clusters)
    normalized_x_clusters = [x_origin + (index * median_width) for index in range(len(x_clusters))]
    normalized_y_clusters = [y_origin + (index * median_height) for index in range(len(y_clusters))]

    normalized_slots = []
    seen_slot_keys: set[tuple[float, float, float, float]] = set()
    for slot in slots:
        x_index = min(range(len(x_clusters)), key=lambda current: abs(x_clusters[current] - slot["x_pt"]))
        y_index = min(range(len(y_clusters)), key=lambda current: abs(y_clusters[current] - slot["y_pt"]))
        snapped_x = normalized_x_clusters[x_index]
        snapped_y = normalized_y_clusters[y_index]
        normalized_slot = {
            "x_pt": round(snapped_x, 3),
            "y_pt": round(snapped_y, 3),
            "width_pt": round(median_width, 3),
            "height_pt": round(median_height, 3),
        }
        slot_key = (
            normalized_slot["x_pt"],
            normalized_slot["y_pt"],
            normalized_slot["width_pt"],
            normalized_slot["height_pt"],
        )
        if slot_key in seen_slot_keys:
            continue
        seen_slot_keys.add(slot_key)
        normalized_slots.append(normalized_slot)
    return normalized_slots


def create_print_order(
    db: Session,
    album: Album,
    stickers: list[Sticker],
    extra_selections: list[dict],
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

    quote = build_order_quote_with_extras(album, stickers, extra_selections, db, service_settings)
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


def _build_source_document_export_layouts(album: Album, db: Session) -> dict[tuple[float, float], dict]:
    pages = db.execute(
        select(SourceDocumentPage)
        .join(SourceDocument, SourceDocumentPage.document_id == SourceDocument.id)
        .options(selectinload(SourceDocumentPage.detected_stickers))
        .where(SourceDocument.album_id == album.id)
    ).scalars().all()

    by_size: dict[tuple[float, float], list[tuple[SourceDocumentPage, SourceDetectedSticker]]] = defaultdict(list)
    for page in pages:
        valid_detected = [
            detected
            for detected in page.detected_stickers
            if detected.status != SourceDetectedStickerStatus.DESCARTADA
        ]
        for detected in valid_detected:
            by_size[_source_detected_sticker_size_key(detected, page)].append((page, detected))

    templates: dict[tuple[float, float], dict] = {}
    for size_key, entries in by_size.items():
        by_page: dict[int, list[SourceDetectedSticker]] = defaultdict(list)
        pages_by_id: dict[int, SourceDocumentPage] = {}
        for page, detected in entries:
            by_page[page.id].append(detected)
            pages_by_id[page.id] = page

        template_page_id, template_group = max(
            by_page.items(),
            key=lambda item: (
                len(item[1]),
                -pages_by_id[item[0]].page_number,
                -pages_by_id[item[0]].id,
            ),
        )
        template_page = pages_by_id[template_page_id]
        page_width, page_height = _source_document_page_dimensions_for_export(template_page)
        slots = []
        for detected in sorted(
            template_group,
            key=lambda current: (
                round(current.y_ratio, 6),
                round(current.x_ratio, 6),
                current.id,
            ),
        ):
            x_pt, y_pt, width_pt, height_pt = _source_detected_sticker_box_points(detected, template_page)
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
            "page_number": template_page.page_number,
            "slots": _normalize_export_slots(slots),
        }

    return templates


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
            "slots": _normalize_export_slots(slots),
        }

    return templates


def _timestamp_cache_part(value: datetime | None) -> str:
    if value is None:
        return "none"
    return value.isoformat(timespec="seconds")


def _path_cache_stamp(path: Path | None) -> tuple[int, int]:
    if path is None or not path.exists():
        return (0, 0)
    stat = path.stat()
    return (int(getattr(stat, "st_mtime_ns", 0)), int(stat.st_size))


def _collection_pages_cache_signature(collection: Collection) -> tuple:
    return tuple(
        (
            int(page.page_number),
            int(page.width),
            int(page.height),
            (page.image_path or "").strip(),
        )
        for page in sorted(collection.pages, key=lambda current: (current.page_number, current.id))
    )


def _collection_page_sizes_signature(collection: Collection, source_pdf_path: Path | None) -> tuple:
    return (
        int(collection.id),
        _timestamp_cache_part(collection.updated_at),
        (collection.source_pdf_path or "").strip(),
        _path_cache_stamp(source_pdf_path),
        _collection_pages_cache_signature(collection),
    )


def _get_cached_collection_page_sizes(collection: Collection, signature: tuple) -> dict[int, tuple[float, float]] | None:
    with _collection_page_sizes_cache_lock:
        cached = _collection_page_sizes_cache.get(collection.id)
        if not cached or cached.get("signature") != signature:
            return None
        return cached.get("page_sizes")


def _store_cached_collection_page_sizes(
    collection: Collection,
    signature: tuple,
    page_sizes: dict[int, tuple[float, float]],
) -> None:
    with _collection_page_sizes_cache_lock:
        _collection_page_sizes_cache[collection.id] = {
            "signature": signature,
            "page_sizes": page_sizes,
        }


def _source_document_layout_signature(album_id: int, db: Session) -> tuple:
    rows = db.execute(
        select(
            SourceDocument.id,
            SourceDocument.pdf_path,
            SourceDocument.page_count,
            SourceDocument.status,
            SourceDocument.updated_at,
            SourceDocumentPage.id,
            SourceDocumentPage.page_number,
            SourceDocumentPage.image_path,
            SourceDocumentPage.width,
            SourceDocumentPage.height,
            func.count(SourceDetectedSticker.id),
            func.max(SourceDetectedSticker.updated_at),
        )
        .join(SourceDocumentPage, SourceDocumentPage.document_id == SourceDocument.id)
        .outerjoin(
            SourceDetectedSticker,
            and_(
                SourceDetectedSticker.page_id == SourceDocumentPage.id,
                SourceDetectedSticker.status != SourceDetectedStickerStatus.DESCARTADA,
            ),
        )
        .where(SourceDocument.album_id == album_id)
        .group_by(
            SourceDocument.id,
            SourceDocument.pdf_path,
            SourceDocument.page_count,
            SourceDocument.status,
            SourceDocument.updated_at,
            SourceDocumentPage.id,
            SourceDocumentPage.page_number,
            SourceDocumentPage.image_path,
            SourceDocumentPage.width,
            SourceDocumentPage.height,
        )
        .order_by(SourceDocument.id.asc(), SourceDocumentPage.page_number.asc(), SourceDocumentPage.id.asc())
    ).all()
    return tuple(
        (
            int(document_id),
            (pdf_path or "").strip(),
            int(page_count or 0),
            str(status.value if hasattr(status, "value") else status),
            _timestamp_cache_part(updated_at),
            int(page_id),
            int(page_number),
            (image_path or "").strip(),
            int(width or 0),
            int(height or 0),
            int(detected_count or 0),
            _timestamp_cache_part(latest_detected_updated_at),
        )
        for (
            document_id,
            pdf_path,
            page_count,
            status,
            updated_at,
            page_id,
            page_number,
            image_path,
            width,
            height,
            detected_count,
            latest_detected_updated_at,
        ) in rows
    )


def _get_cached_source_document_layouts(album_id: int, signature: tuple) -> dict[tuple[float, float], dict] | None:
    with _source_document_layout_cache_lock:
        cached = _source_document_layout_cache.get(album_id)
        if not cached or cached.get("signature") != signature:
            return None
        return cached.get("layouts")


def _store_cached_source_document_layouts(
    album_id: int,
    signature: tuple,
    layouts: dict[tuple[float, float], dict],
) -> None:
    with _source_document_layout_cache_lock:
        _source_document_layout_cache[album_id] = {
            "signature": signature,
            "layouts": layouts,
        }


def _extra_pdf_page_count_signature(collection: Collection, source_pdf_path: Path) -> tuple:
    return (
        int(collection.id),
        _timestamp_cache_part(collection.updated_at),
        (collection.source_pdf_path or "").strip(),
        _path_cache_stamp(source_pdf_path),
    )


def _get_cached_extra_pdf_page_count(collection: Collection, signature: tuple) -> int | None:
    with _extra_pdf_page_count_cache_lock:
        cached = _extra_pdf_page_count_cache.get(collection.id)
        if not cached or cached.get("signature") != signature:
            return None
        return cached.get("page_count")


def _store_cached_extra_pdf_page_count(collection: Collection, signature: tuple, page_count: int) -> None:
    with _extra_pdf_page_count_cache_lock:
        _extra_pdf_page_count_cache[collection.id] = {
            "signature": signature,
            "page_count": int(page_count),
        }


def _template_collection_layout_signature(
    collection: Collection,
    sticker_count: int,
    latest_sticker_update: datetime | None,
) -> tuple:
    return (
        int(collection.id),
        _timestamp_cache_part(collection.updated_at),
        (collection.source_pdf_path or "").strip(),
        int(collection.status == CollectionStatus.PUBLICADA),
        int(collection.sort_order or 0),
        _collection_pages_cache_signature(collection),
        int(sticker_count),
        _timestamp_cache_part(latest_sticker_update),
    )


def _get_cached_template_export_layouts(collection: Collection, signature: tuple) -> dict[tuple[float, float], dict] | None:
    with _template_export_layout_cache_lock:
        cached = _template_export_layout_cache.get(collection.id)
        if not cached or cached.get("signature") != signature:
            return None
        return cached.get("layouts")


def _store_cached_template_export_layouts(
    collection: Collection,
    signature: tuple,
    layouts: dict[tuple[float, float], dict],
) -> None:
    with _template_export_layout_cache_lock:
        _template_export_layout_cache[collection.id] = {
            "signature": signature,
            "layouts": layouts,
        }


def _render_sticker_export_image(
    documents: dict[int, fitz.Document],
    source_pdf_paths: dict[int, Path],
    sticker: Sticker,
    page_sizes_by_collection: dict[int, dict[int, tuple[float, float]]],
) -> bytes:
    sticker_file = _sticker_asset_path_for_export(sticker)
    if sticker.source_type == StickerSourceType.GENERATED or sticker_file is not None:
        if not sticker_file:
            raise FileNotFoundError(f"Arquivo da figurinha {sticker.name} nao encontrado.")
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


def load_source_document_or_fail(db: Session, document_id: int) -> SourceDocument:
    document = db.execute(
        select(SourceDocument)
        .options(
            selectinload(SourceDocument.album),
            selectinload(SourceDocument.pages).selectinload(SourceDocumentPage.blocks).selectinload(PageSelectionBlock.collection),
            selectinload(SourceDocument.pages).selectinload(SourceDocumentPage.detected_stickers).selectinload(SourceDetectedSticker.assigned_collection),
            selectinload(SourceDocument.detected_stickers).selectinload(SourceDetectedSticker.assigned_collection),
        )
        .where(SourceDocument.id == document_id)
    ).scalar_one_or_none()
    if not document:
        raise LookupError("Documento fonte nao encontrado.")
    return document


def load_source_document_page_or_fail(db: Session, page_id: int) -> SourceDocumentPage:
    page = db.execute(
        select(SourceDocumentPage)
        .options(
            selectinload(SourceDocumentPage.document).selectinload(SourceDocument.album),
            selectinload(SourceDocumentPage.blocks).selectinload(PageSelectionBlock.collection),
            selectinload(SourceDocumentPage.blocks).selectinload(PageSelectionBlock.source_stickers),
            selectinload(SourceDocumentPage.detected_stickers).selectinload(SourceDetectedSticker.assigned_collection),
        )
        .where(SourceDocumentPage.id == page_id)
    ).scalar_one_or_none()
    if not page:
        raise LookupError("Pagina do documento fonte nao encontrada.")
    return page


def load_source_detected_sticker_or_fail(db: Session, detected_sticker_id: int) -> SourceDetectedSticker:
    detected_sticker = db.execute(
        select(SourceDetectedSticker)
        .options(
            selectinload(SourceDetectedSticker.document).selectinload(SourceDocument.album),
            selectinload(SourceDetectedSticker.page),
            selectinload(SourceDetectedSticker.assigned_collection),
        )
        .where(SourceDetectedSticker.id == detected_sticker_id)
    ).scalar_one_or_none()
    if not detected_sticker:
        raise LookupError("Figurinha detectada nao encontrada.")
    return detected_sticker


def load_page_layout_template_or_fail(db: Session, template_id: int) -> PageLayoutTemplate:
    template = db.execute(
        select(PageLayoutTemplate)
        .options(
            selectinload(PageLayoutTemplate.album),
            selectinload(PageLayoutTemplate.blocks).selectinload(PageLayoutTemplateBlock.collection),
        )
        .where(PageLayoutTemplate.id == template_id)
    ).scalar_one_or_none()
    if not template:
        raise LookupError("Layout mestre nao encontrado.")
    return template


def load_page_selection_block_or_fail(db: Session, block_id: int) -> PageSelectionBlock:
    block = db.execute(
        select(PageSelectionBlock)
        .options(
            selectinload(PageSelectionBlock.page).selectinload(SourceDocumentPage.document).selectinload(SourceDocument.album),
            selectinload(PageSelectionBlock.collection),
        )
        .where(PageSelectionBlock.id == block_id)
    ).scalar_one_or_none()
    if not block:
        raise LookupError("Bloco da selecao nao encontrado.")
    return block


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


def collection_to_response(collection: Collection, stats: dict[str, int], *, include_sensitive: bool = True) -> dict:
    preview_image_path = None
    if collection.pages:
        first_page = min(collection.pages, key=lambda page: (page.page_number, page.id))
        preview_image_path = first_page.image_path or None
    return {
        "id": collection.id,
        "album_id": collection.album_id,
        "album_name": collection.album.name if collection.album else None,
        "album_slug": collection.album.slug if collection.album else None,
        "name": collection.name,
        "slug": collection.slug,
        "description": collection.description,
        "sort_order": collection.sort_order,
        "collection_type": collection.collection_type,
        "export_mode": collection.export_mode,
        "allow_quantity_choice": collection.allow_quantity_choice,
        "default_quantity": collection.default_quantity,
        "max_quantity_per_order": collection.max_quantity_per_order,
        "display_group_order": collection.display_group_order,
        "display_item_order": collection.display_item_order,
        "status": collection.status,
        "source_pdf_path": collection.source_pdf_path if include_sensitive else None,
        "preview_image_path": preview_image_path,
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


def page_selection_block_to_response(block: PageSelectionBlock) -> dict:
    return {
        "id": block.id,
        "page_id": block.page_id,
        "collection_id": block.collection_id,
        "collection_name": block.collection.name if block.collection else None,
        "label": block.label,
        "x": block.x,
        "y": block.y,
        "width": block.width,
        "height": block.height,
        "sort_order": block.sort_order,
        "created_at": block.created_at,
        "updated_at": block.updated_at,
    }


def source_detected_status_counts(
    detected_stickers: list[SourceDetectedSticker],
) -> dict[SourceDetectedStickerStatus, int]:
    counts: dict[SourceDetectedStickerStatus, int] = defaultdict(int)
    for detected_sticker in detected_stickers:
        counts[detected_sticker.status] += 1
    return counts


def source_detected_sticker_to_response(detected_sticker: SourceDetectedSticker) -> dict:
    return {
        "id": detected_sticker.id,
        "document_id": detected_sticker.document_id,
        "page_id": detected_sticker.page_id,
        "assigned_collection_id": detected_sticker.assigned_collection_id,
        "assigned_collection_name": detected_sticker.assigned_collection.name if detected_sticker.assigned_collection else None,
        "status": detected_sticker.status,
        "category": detected_sticker.category,
        "x_ratio": detected_sticker.x_ratio,
        "y_ratio": detected_sticker.y_ratio,
        "width_ratio": detected_sticker.width_ratio,
        "height_ratio": detected_sticker.height_ratio,
        "preview_path": detected_sticker.preview_path,
        "crop_path": detected_sticker.crop_path,
        "ocr_name_raw": detected_sticker.ocr_name_raw,
        "ocr_name_suggested": detected_sticker.ocr_name_suggested,
        "ocr_confidence": detected_sticker.ocr_confidence,
        "ocr_processed_at": detected_sticker.ocr_processed_at,
        "created_at": detected_sticker.created_at,
        "updated_at": detected_sticker.updated_at,
    }


def source_document_page_to_response(page: SourceDocumentPage) -> dict:
    counts = source_detected_status_counts(page.detected_stickers)
    return {
        "id": page.id,
        "document_id": page.document_id,
        "page_number": page.page_number,
        "image_path": page.image_path,
        "width": page.width,
        "height": page.height,
        "detected_count": len(page.detected_stickers),
        "pending_detected_count": counts.get(SourceDetectedStickerStatus.PENDENTE, 0),
        "assigned_detected_count": counts.get(SourceDetectedStickerStatus.ATRIBUIDA, 0),
        "discarded_detected_count": counts.get(SourceDetectedStickerStatus.DESCARTADA, 0),
        "blocks": [page_selection_block_to_response(block) for block in page.blocks],
    }


def page_layout_template_block_to_response(block: PageLayoutTemplateBlock) -> dict:
    return {
        "id": block.id,
        "template_id": block.template_id,
        "collection_id": block.collection_id,
        "collection_name": block.collection.name if block.collection else None,
        "label": block.label,
        "x": block.x,
        "y": block.y,
        "width": block.width,
        "height": block.height,
        "sort_order": block.sort_order,
        "created_at": block.created_at,
        "updated_at": block.updated_at,
    }


def page_layout_template_to_response(template: PageLayoutTemplate) -> dict:
    return {
        "id": template.id,
        "album_id": template.album_id,
        "album_name": template.album.name if template.album else None,
        "name": template.name,
        "block_count": len(template.blocks),
        "created_at": template.created_at,
        "updated_at": template.updated_at,
        "blocks": [page_layout_template_block_to_response(block) for block in template.blocks],
    }


def source_document_to_summary_response(document: SourceDocument) -> dict:
    counts = source_detected_status_counts(document.detected_stickers)
    return {
        "id": document.id,
        "album_id": document.album_id,
        "album_name": document.album.name if document.album else None,
        "album_slug": document.album.slug if document.album else None,
        "title": document.title,
        "pdf_path": document.pdf_path,
        "page_count": document.page_count,
        "status": document.status,
        "block_count": sum(len(page.blocks) for page in document.pages),
        "detected_count": len(document.detected_stickers),
        "pending_detected_count": counts.get(SourceDetectedStickerStatus.PENDENTE, 0),
        "assigned_detected_count": counts.get(SourceDetectedStickerStatus.ATRIBUIDA, 0),
        "discarded_detected_count": counts.get(SourceDetectedStickerStatus.DESCARTADA, 0),
        "created_at": document.created_at,
        "updated_at": document.updated_at,
    }


def source_document_to_detail_response(document: SourceDocument) -> dict:
    payload = source_document_to_summary_response(document)
    payload["pages"] = [source_document_page_to_response(page) for page in document.pages]
    return payload


def sticker_to_response(sticker: Sticker, *, include_sensitive: bool = True) -> dict:
    return {
        "id": sticker.id,
        "collection_id": sticker.collection_id,
        "page_id": sticker.page_id,
        "template_id": sticker.template_id,
        "source_document_id": sticker.source_document_id,
        "source_document_page_id": sticker.source_document_page_id,
        "source_block_id": sticker.source_block_id,
        "name": sticker.name,
        "code": sticker.code,
        "category": sticker.category,
        "source_type": sticker.source_type,
        "profile_type": normalize_custom_profile_type(sticker.profile_type),
        "custom_category_type": sticker.custom_category_type,
        "custom_position_type": sticker.custom_position_type,
        "composition_mode_used": sticker.composition_mode_used,
        "birth_date_text": sticker.birth_date_text,
        "height_text": sticker.height_text,
        "weight_text": sticker.weight_text,
        "city_or_team": sticker.city_or_team,
        "photo_offset_x": sticker.photo_offset_x,
        "photo_offset_y": sticker.photo_offset_y,
        "photo_scale": sticker.photo_scale,
        "photo_rotation": sticker.photo_rotation,
        "sort_order": sticker.sort_order,
        "x_ratio": sticker.x_ratio,
        "y_ratio": sticker.y_ratio,
        "width_ratio": sticker.width_ratio,
        "height_ratio": sticker.height_ratio,
        "preview_path": sticker.preview_path,
        "crop_path": sticker.crop_path if include_sensitive else None,
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


def service_settings_to_response(service_settings: ServiceSettings, *, include_sensitive: bool = True) -> dict:
    donation_qr_code = build_static_pix_payload(service_settings.pix_key, service_settings.pix_holder)
    response = {
        "service_enabled": service_settings.service_enabled,
        "donation_enabled": service_settings.donation_enabled,
        "custom_generation_mode": service_settings.custom_generation_mode,
        "custom_sticker_unlock_enabled": service_settings.custom_sticker_unlock_enabled,
        "custom_sticker_unlock_price_cents": service_settings.custom_sticker_unlock_price_cents,
        "custom_sticker_unlock_message": service_settings.custom_sticker_unlock_message,
        "custom_ai_unlock_enabled": service_settings.custom_ai_unlock_enabled,
        "custom_ai_unlock_price_cents": service_settings.custom_ai_unlock_price_cents,
        "custom_ai_unlock_message": service_settings.custom_ai_unlock_message,
        "pack_size": service_settings.pack_size,
        "print_price_cents": service_settings.print_price_cents,
        "pack_price_cents": service_settings.pack_price_cents,
        "pix_key": service_settings.pix_key,
        "pix_holder": service_settings.pix_holder,
        "donation_message": service_settings.donation_message,
        "pickup_note": service_settings.pickup_note,
        "donation_qr_code": donation_qr_code,
        "donation_qr_code_base64": build_static_pix_qr_base64(donation_qr_code),
        # Public flow uses these base previews to show the available AI model.
        "custom_base_homem_path": service_settings.custom_base_homem_path,
        "custom_base_mulher_path": service_settings.custom_base_mulher_path,
        "custom_base_crianca_path": (
            service_settings.custom_base_menino_path or service_settings.custom_base_menina_path
        ),
    }
    if include_sensitive:
        response.update(
            {
                "custom_prompt_template": service_settings.custom_prompt_template or DEFAULT_CUSTOM_STICKER_PROMPT_TEMPLATE,
                "custom_base_menino_path": service_settings.custom_base_menino_path,
                "custom_base_menina_path": service_settings.custom_base_menina_path,
            }
        )
    return response


def custom_template_layer_inventory(template: CustomStickerTemplate | None) -> dict[CustomTemplateLayerType, int]:
    counts: dict[CustomTemplateLayerType, int] = defaultdict(int)
    if template is None:
        return counts
    for layer in template.layers:
        if layer.is_active and layer.file_path:
            counts[layer.layer_type] += 1
    return counts


def custom_template_manual_status(template: CustomStickerTemplate | None) -> dict:
    inventory = custom_template_layer_inventory(template)
    foreground_count = sum(inventory.get(layer_type, 0) for layer_type in CUSTOM_TEMPLATE_REQUIRED_FOREGROUND_LAYER_TYPES)
    text_slot_count = len(template.text_slots) if template else 0
    has_photo_slot = template is not None and template.photo_slot is not None

    checks = [
        {
            "key": "photo_slot",
            "label": "Area da foto",
            "ready": has_photo_slot,
            "detail": (
                "A foto vai encaixar no espaco configurado do modelo."
                if has_photo_slot
                else "Defina onde a foto recortada entra no modelo."
            ),
        },
        {
            "key": "background",
            "label": "Fundo",
            "ready": inventory.get(CustomTemplateLayerType.BACKGROUND, 0) > 0,
            "detail": (
                f"{inventory.get(CustomTemplateLayerType.BACKGROUND, 0)} camada(s) de fundo encontrada(s)."
                if inventory.get(CustomTemplateLayerType.BACKGROUND, 0) > 0
                else "Importe uma imagem de fundo para o modelo."
            ),
        },
        {
            "key": "info_panel",
            "label": "Faixa de informacoes",
            "ready": inventory.get(CustomTemplateLayerType.INFO_PANEL, 0) > 0,
            "detail": (
                f"{inventory.get(CustomTemplateLayerType.INFO_PANEL, 0)} faixa(s) de informacoes encontrada(s)."
                if inventory.get(CustomTemplateLayerType.INFO_PANEL, 0) > 0
                else "Importe a faixa onde ficam nome, data, altura, peso e cidade/time."
            ),
        },
        {
            "key": "foreground",
            "label": "Moldura ou camada frontal",
            "ready": foreground_count > 0,
            "detail": (
                f"{foreground_count} camada(s) frontal(is) pronta(s)."
                if foreground_count > 0
                else "Importe pelo menos uma moldura, camisa frontal, overlay ou brilho."
            ),
        },
        {
            "key": "text_slots",
            "label": "Campos de texto",
            "ready": text_slot_count > 0,
            "detail": (
                f"{text_slot_count} slot(s) de texto configurado(s)."
                if text_slot_count > 0
                else "Adicione ao menos um slot de texto para os dados da figurinha."
            ),
        },
    ]

    missing_labels = [check["label"] for check in checks if not check["ready"]]
    layer_inventory = [
        {
            "layer_type": layer_type,
            "label": CUSTOM_TEMPLATE_LAYER_LABELS[layer_type],
            "count": inventory.get(layer_type, 0),
        }
        for layer_type in (
            CustomTemplateLayerType.BACKGROUND,
            CustomTemplateLayerType.FRAME,
            CustomTemplateLayerType.PHOTO_FRONT,
            CustomTemplateLayerType.INFO_PANEL,
            CustomTemplateLayerType.OVERLAY,
            CustomTemplateLayerType.SHINE,
        )
    ]

    return {
        "ready": not missing_labels,
        "missing_count": len(missing_labels),
        "missing_labels": missing_labels,
        "checks": checks,
        "layer_inventory": layer_inventory,
    }


def custom_template_to_summary_response(template: CustomStickerTemplate) -> dict:
    manual_status = custom_template_manual_status(template)
    manual_ready = manual_status["ready"]
    return {
        "id": template.id,
        "album_id": template.album_id,
        "name": template.name,
        "profile_type": normalize_custom_profile_type(template.profile_type),
        "category_type": template.category_type,
        "position_type": template.position_type,
        "composition_mode": template.composition_mode,
        "sort_order": template.sort_order,
        "is_active": template.is_active,
        "layer_count": len([layer for layer in template.layers if layer.is_active and layer.file_path]),
        "preview_path": custom_template_preview_path(template),
        "has_photo_slot": template.photo_slot is not None,
        "manual_ready": manual_ready,
        "manual_status": manual_status,
        "text_slot_count": len(template.text_slots),
        "created_at": template.created_at,
        "updated_at": template.updated_at,
    }


def custom_template_to_detail_response(template: CustomStickerTemplate) -> dict:
    manual_status = custom_template_manual_status(template)
    manual_ready = manual_status["ready"]
    return {
        "id": template.id,
        "album_id": template.album_id,
        "name": template.name,
        "profile_type": normalize_custom_profile_type(template.profile_type),
        "category_type": template.category_type,
        "position_type": template.position_type,
        "composition_mode": template.composition_mode,
        "sort_order": template.sort_order,
        "is_active": template.is_active,
        "preview_path": custom_template_preview_path(template),
        "manual_ready": manual_ready,
        "manual_status": manual_status,
        "created_at": template.created_at,
        "updated_at": template.updated_at,
        "layers": [
            {
                "id": layer.id,
                "layer_type": layer.layer_type,
                "label": layer.label,
                "file_path": layer.file_path,
                "z_index": layer.z_index,
                "is_active": layer.is_active,
            }
            for layer in template.layers
        ],
        "photo_slot": (
            {
                "id": template.photo_slot.id,
                "x": template.photo_slot.x,
                "y": template.photo_slot.y,
                "width": template.photo_slot.width,
                "height": template.photo_slot.height,
                "default_scale": template.photo_slot.default_scale,
                "min_scale": template.photo_slot.min_scale,
                "max_scale": template.photo_slot.max_scale,
                "portrait_z_index": resolve_effective_portrait_z_index(template),
                "anchor_x": template.photo_slot.anchor_x,
                "anchor_y": template.photo_slot.anchor_y,
                "visible_x": template.photo_slot.visible_x,
                "visible_y": template.photo_slot.visible_y,
                "visible_width": template.photo_slot.visible_width,
                "visible_height": template.photo_slot.visible_height,
            }
            if template.photo_slot
            else None
        ),
        "text_slots": [
            {
                "id": slot.id,
                "field_name": slot.field_name,
                "x": slot.x,
                "y": slot.y,
                "width": slot.width,
                "font_size": slot.font_size,
                "font_weight": slot.font_weight,
                "text_align": slot.text_align,
                "color": slot.color,
            }
            for slot in template.text_slots
        ],
    }


def custom_template_to_public_option(template: CustomStickerTemplate) -> dict:
    manual_status = custom_template_manual_status(template)
    manual_ready = manual_status["ready"]
    return {
        "id": template.id,
        "album_id": template.album_id,
        "name": template.name,
        "profile_type": normalize_custom_profile_type(template.profile_type),
        "category_type": template.category_type,
        "position_type": template.position_type,
        "composition_mode": template.composition_mode,
        "preview_path": custom_template_preview_path(template),
        "sort_order": template.sort_order,
        "layer_count": len([layer for layer in template.layers if layer.is_active and layer.file_path]),
        "has_photo_slot": template.photo_slot is not None,
        "manual_ready": manual_ready,
        "manual_status": manual_status,
        "layers": [
            {
                "id": layer.id,
                "layer_type": layer.layer_type,
                "label": layer.label,
                "file_path": layer.file_path,
                "z_index": layer.z_index,
                "is_active": layer.is_active,
            }
            for layer in template.layers
        ],
        "photo_slot": (
            {
                "id": template.photo_slot.id,
                "x": template.photo_slot.x,
                "y": template.photo_slot.y,
                "width": template.photo_slot.width,
                "height": template.photo_slot.height,
                "default_scale": template.photo_slot.default_scale,
                "min_scale": template.photo_slot.min_scale,
                "max_scale": template.photo_slot.max_scale,
                "portrait_z_index": resolve_effective_portrait_z_index(template),
                "anchor_x": template.photo_slot.anchor_x,
                "anchor_y": template.photo_slot.anchor_y,
                "visible_x": template.photo_slot.visible_x,
                "visible_y": template.photo_slot.visible_y,
                "visible_width": template.photo_slot.visible_width,
                "visible_height": template.photo_slot.visible_height,
            }
            if template.photo_slot
            else None
        ),
        "text_slots": [
            {
                "id": slot.id,
                "field_name": slot.field_name,
                "x": slot.x,
                "y": slot.y,
                "width": slot.width,
                "font_size": slot.font_size,
                "font_weight": slot.font_weight,
                "text_align": slot.text_align,
                "color": slot.color,
            }
            for slot in template.text_slots
        ],
    }


def load_active_custom_templates(db: Session, *, album_id: int | None = None) -> list[CustomStickerTemplate]:
    statement = (
        select(CustomStickerTemplate)
        .options(
            selectinload(CustomStickerTemplate.layers),
            selectinload(CustomStickerTemplate.photo_slot),
            selectinload(CustomStickerTemplate.text_slots),
        )
        .where(CustomStickerTemplate.is_active.is_(True))
        .order_by(
            CustomStickerTemplate.sort_order.asc(),
            CustomStickerTemplate.profile_type.asc(),
            CustomStickerTemplate.position_type.asc(),
            CustomStickerTemplate.id.asc(),
        )
    )
    if album_id is not None:
        statement = statement.where(CustomStickerTemplate.album_id == album_id)
    return db.execute(statement).scalars().all()


def resolve_custom_template_for_generation(
    db: Session,
    *,
    album_id: int,
    template_id: int | None,
    profile_type: CustomProfileType,
    category_type: CustomCategoryType,
    position_type: CustomPositionType,
    require_layer_ready: bool = False,
) -> CustomStickerTemplate | None:
    profile_values = custom_profile_type_values_for_match(profile_type)
    statement = select(CustomStickerTemplate).options(
        selectinload(CustomStickerTemplate.layers),
        selectinload(CustomStickerTemplate.photo_slot),
        selectinload(CustomStickerTemplate.text_slots),
    )
    if template_id:
        statement = statement.where(
            CustomStickerTemplate.id == template_id,
            CustomStickerTemplate.album_id == album_id,
            CustomStickerTemplate.is_active.is_(True),
            CustomStickerTemplate.profile_type.in_(profile_values),
            CustomStickerTemplate.category_type == category_type,
            CustomStickerTemplate.position_type == position_type,
        )
    else:
        statement = statement.where(
            CustomStickerTemplate.is_active.is_(True),
            CustomStickerTemplate.album_id == album_id,
            CustomStickerTemplate.profile_type.in_(profile_values),
            CustomStickerTemplate.category_type == category_type,
            CustomStickerTemplate.position_type == position_type,
        ).order_by(CustomStickerTemplate.sort_order.asc(), CustomStickerTemplate.id.asc())
    templates = db.execute(statement).scalars().all()
    if not require_layer_ready:
        return templates[0] if templates else None
    return next((template for template in templates if custom_template_supports_layer_composition(template)), None)


def custom_template_supports_layer_composition(template: CustomStickerTemplate | None) -> bool:
    return custom_template_manual_status(template)["ready"]


def resolve_template_preview_base_path(
    service_settings: ServiceSettings,
    *,
    template: CustomStickerTemplate | None,
    profile_type: CustomProfileType,
) -> Path | None:
    if template:
        preview_path = custom_template_preview_path(template)
        if preview_path:
            layer_path = settings.storage_root / preview_path
            if layer_path.exists():
                return layer_path
    return get_custom_base_file_path(service_settings, profile_type)


def custom_template_preview_path(template: CustomStickerTemplate) -> str | None:
    template_layers = sorted(
        [layer for layer in template.layers if layer.is_active and layer.file_path],
        key=lambda layer: layer.z_index,
    )
    for preferred_type in (
        CustomTemplateLayerType.BACKGROUND,
        CustomTemplateLayerType.FRAME,
        CustomTemplateLayerType.OVERLAY,
        CustomTemplateLayerType.INFO_PANEL,
        CustomTemplateLayerType.PHOTO_FRONT,
        CustomTemplateLayerType.SHINE,
    ):
        selected = next((layer for layer in template_layers if layer.layer_type == preferred_type), None)
        if selected:
            return selected.file_path
    return template_layers[0].file_path if template_layers else None


def custom_sticker_unlock_to_response(unlock: CustomStickerUnlock, service_settings: ServiceSettings | None = None) -> dict:
    payment_required = True
    if service_settings and not _custom_sticker_unlock_settings(service_settings, unlock.unlock_type)[0]:
        payment_required = False
    ensure_custom_sticker_unlock_use_counters(unlock)
    remaining_uses = max(int(unlock.remaining_uses or 0), 0)
    total_uses = max(int(unlock.total_uses or 0), 0)
    return {
        "id": unlock.id,
        "album_id": unlock.album_id,
        "sticker_id": unlock.sticker_id,
        "unlock_type": unlock.unlock_type,
        "status": unlock.status.value,
        "amount_cents": unlock.amount_cents,
        "payment_required": payment_required,
        "access_granted": custom_sticker_unlock_has_available_uses(unlock),
        "total_uses": total_uses,
        "remaining_uses": remaining_uses,
        "uses_consumed": max(total_uses - remaining_uses, 0),
        "qr_code_base64": unlock.qr_code_base64,
        "qr_code": unlock.qr_code,
        "ticket_url": unlock.ticket_url,
        "expires_at": unlock.expires_at,
        "paid_at": unlock.paid_at,
        "created_at": unlock.created_at,
        "updated_at": unlock.updated_at,
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
