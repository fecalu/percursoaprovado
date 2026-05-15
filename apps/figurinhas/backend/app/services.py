from __future__ import annotations

import io
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
from .models import Collection, CollectionStatus, Export, Page, Sticker
from .name_ocr import detect_sticker_name


settings = get_settings()


def slugify(value: str) -> str:
    normalized = "".join(char.lower() if char.isalnum() else "-" for char in value.strip())
    collapsed = "-".join(part for part in normalized.split("-") if part)
    return collapsed[:150] or "colecao"


def ensure_collection_slug_unique(db: Session, slug: str, excluding_id: int | None = None) -> None:
    statement = select(Collection).where(Collection.slug == slug)
    if excluding_id is not None:
        statement = statement.where(Collection.id != excluding_id)
    exists = db.execute(statement).scalar_one_or_none()
    if exists:
        raise ValueError("Ja existe uma colecao com esse slug.")


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


def crop_sticker_image(sticker: Sticker) -> None:
    collection_slug = sticker.collection.slug
    page_image_path = settings.storage_root / sticker.page.image_path
    if not page_image_path.exists():
        raise FileNotFoundError("Imagem da pagina nao encontrada.")

    with Image.open(page_image_path) as page_image:
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


def delete_sticker_assets(sticker: Sticker) -> None:
    for relative_path in {sticker.crop_path, sticker.preview_path}:
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
            db.flush()
            crop_sticker_image(sticker)
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


def build_export_pdf(collection: Collection, stickers: list[Sticker], db: Session) -> Export:
    export_dir = settings.storage_root / "exports" / collection.slug
    export_dir.mkdir(parents=True, exist_ok=True)
    export_key = f"{datetime.utcnow():%Y%m%d-%H%M%S}-{uuid.uuid4().hex[:8]}"
    export_path = export_dir / f"{collection.slug}-{export_key}.pdf"

    if not collection.source_pdf_path:
        raise ValueError("A colecao nao possui PDF de origem para exportacao.")

    source_pdf_path = settings.storage_root / collection.source_pdf_path
    if not source_pdf_path.exists():
        raise FileNotFoundError("PDF de origem da colecao nao encontrado.")

    template_stickers = db.execute(
        select(Sticker)
        .options(selectinload(Sticker.page))
        .where(Sticker.collection_id == collection.id, Sticker.active.is_(True))
        .order_by(Sticker.sort_order.asc(), Sticker.id.asc())
    ).scalars().all()

    with fitz.open(source_pdf_path) as document:
        page_sizes = {
            page_index + 1: (document.load_page(page_index).rect.width, document.load_page(page_index).rect.height)
            for page_index in range(document.page_count)
        }
        template_layouts = _build_template_export_layouts(template_stickers, page_sizes)

        selected_groups: dict[tuple[float, float], list[Sticker]] = {}
        for sticker in stickers:
            group_key = _sticker_size_key(sticker, page_sizes)
            selected_groups.setdefault(group_key, []).append(sticker)

        first_layout = next(iter(template_layouts.values()), None)
        initial_page_size = first_layout["page_size"] if first_layout else next(iter(page_sizes.values()), (595.2756, 841.8898))
        pdf = canvas.Canvas(str(export_path), pagesize=initial_page_size)
        pdf.setTitle(f"{collection.name} - figurinhas selecionadas")

        is_first_page = True
        for group_key, group_stickers in selected_groups.items():
            layout = template_layouts.get(group_key)
            if not layout or not layout["slots"]:
                raise ValueError("Nao foi possivel montar um template de exportacao para esse conjunto de figurinhas.")

            page_width, page_height = layout["page_size"]
            slots = layout["slots"]
            slots_per_page = len(slots)
            if slots_per_page <= 0:
                raise ValueError("Template de exportacao invalido para a colecao.")

            for offset in range(0, len(group_stickers), slots_per_page):
                batch = group_stickers[offset : offset + slots_per_page]
                if not is_first_page:
                    pdf.showPage()
                pdf.setPageSize((page_width, page_height))

                for slot, sticker in zip(slots, batch, strict=False):
                    image_bytes = _render_sticker_export_image(document, sticker, page_sizes)
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

    export_record = Export(
        collection=collection,
        file_path=str(export_path.relative_to(settings.storage_root).as_posix()),
        item_count=len(stickers),
    )
    db.add(export_record)
    db.flush()
    return export_record


def _sticker_page_box_points(
    sticker: Sticker,
    page_sizes: dict[int, tuple[float, float]],
) -> tuple[float, float, float, float, float, float]:
    page_width, page_height = page_sizes[sticker.page.page_number]
    x_pt = page_width * sticker.x_ratio
    y_pt = page_height * sticker.y_ratio
    width_pt = page_width * sticker.width_ratio
    height_pt = page_height * sticker.height_ratio
    return x_pt, y_pt, width_pt, height_pt, page_width, page_height


def _sticker_size_key(sticker: Sticker, page_sizes: dict[int, tuple[float, float]]) -> tuple[float, float]:
    _, _, width_pt, height_pt, _, _ = _sticker_page_box_points(sticker, page_sizes)
    return round(width_pt), round(height_pt)


def _build_template_export_layouts(
    stickers: list[Sticker],
    page_sizes: dict[int, tuple[float, float]],
) -> dict[tuple[float, float], dict]:
    by_size: dict[tuple[float, float], list[Sticker]] = defaultdict(list)
    for sticker in stickers:
        by_size[_sticker_size_key(sticker, page_sizes)].append(sticker)

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
            x_pt, y_pt, width_pt, height_pt, _, _ = _sticker_page_box_points(sticker, page_sizes)
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
    document: fitz.Document,
    sticker: Sticker,
    page_sizes: dict[int, tuple[float, float]],
) -> bytes:
    page = document.load_page(sticker.page.page_number - 1)
    x_pt, y_pt, width_pt, height_pt, _, _ = _sticker_page_box_points(sticker, page_sizes)
    clip = fitz.Rect(x_pt, y_pt, x_pt + width_pt, y_pt + height_pt)
    pixmap = page.get_pixmap(matrix=fitz.Matrix(settings.export_render_scale, settings.export_render_scale), clip=clip, alpha=False)
    return pixmap.tobytes("png")


def load_collection_or_fail(db: Session, collection_id: int) -> Collection:
    collection = db.get(Collection, collection_id)
    if not collection:
        raise LookupError("Colecao nao encontrada.")
    return collection


def load_collection_by_slug_or_fail(db: Session, slug: str, public_only: bool = False) -> Collection:
    statement = select(Collection).where(Collection.slug == slug)
    if public_only:
        statement = statement.where(Collection.status == CollectionStatus.PUBLICADA)
    collection = db.execute(statement).scalar_one_or_none()
    if not collection:
        raise LookupError("Colecao nao encontrada.")
    return collection


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


def collection_to_response(collection: Collection, stats: dict[str, int]) -> dict:
    return {
        "id": collection.id,
        "name": collection.name,
        "slug": collection.slug,
        "description": collection.description,
        "status": collection.status,
        "source_pdf_path": collection.source_pdf_path,
        "created_at": collection.created_at,
        "updated_at": collection.updated_at,
        "sticker_count": stats.get("stickers", 0),
        "page_count": stats.get("pages", 0),
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
