from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import numpy as np
from PIL import Image

from .models import StickerCategory


BBOX_WHITE_THRESHOLD = 200
CELL_WHITE_THRESHOLD = 245
MIN_CELL_CONTENT_DENSITY = 0.12


@dataclass
class DetectedStickerRect:
    row_index: int
    column_index: int
    x_ratio: float
    y_ratio: float
    width_ratio: float
    height_ratio: float
    category: StickerCategory


@dataclass
class PageDetectionResult:
    status: str
    template: str | None
    reason: str | None
    rectangles: list[DetectedStickerRect]


def _content_bbox(mask: np.ndarray) -> tuple[int, int, int, int] | None:
    ys, xs = np.where(mask)
    if len(xs) == 0 or len(ys) == 0:
        return None
    return int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1


def _guess_template(content_width: int, content_height: int) -> tuple[str, int, int] | None:
    ratio = content_height / max(content_width, 1)
    if 1.15 <= ratio <= 1.45:
        return ("grade-4x4", 4, 4)
    if 0.55 <= ratio <= 0.80:
        return ("grade-4x2", 4, 2)
    return None


def _guess_category(density: float) -> StickerCategory:
    if density < 0.22:
        return StickerCategory.ESPECIAL
    return StickerCategory.JOGADOR


def detect_sticker_rectangles(page_image_path: Path) -> PageDetectionResult:
    with Image.open(page_image_path) as image:
        grayscale = np.array(image.convert("L"))
        page_width, page_height = image.size

    bbox_mask = grayscale < BBOX_WHITE_THRESHOLD
    density_mask = grayscale < CELL_WHITE_THRESHOLD
    bbox = _content_bbox(bbox_mask)
    if bbox is None:
        return PageDetectionResult(
            status="skipped",
            template=None,
            reason="A pagina parece vazia ou sem contraste suficiente.",
            rectangles=[],
        )

    x0, y0, x1, y1 = bbox
    content_width = x1 - x0
    content_height = y1 - y0
    template = _guess_template(content_width, content_height)
    if template is None:
        return PageDetectionResult(
            status="skipped",
            template=None,
            reason="O layout dessa pagina ainda nao bate com os templates automaticos.",
            rectangles=[],
        )

    template_name, columns, rows = template
    rectangles: list[DetectedStickerRect] = []
    cell_width = content_width / columns
    cell_height = content_height / rows

    horizontal_padding = max(4, int(round(cell_width * 0.01)))
    vertical_padding = max(4, int(round(cell_height * 0.01)))

    for row_index in range(rows):
        row_start = int(round(y0 + row_index * cell_height))
        row_end = int(round(y0 + (row_index + 1) * cell_height))
        for column_index in range(columns):
            col_start = int(round(x0 + column_index * cell_width))
            col_end = int(round(x0 + (column_index + 1) * cell_width))

            inner_left = min(col_end, col_start + horizontal_padding)
            inner_right = max(col_start, col_end - horizontal_padding)
            inner_top = min(row_end, row_start + vertical_padding)
            inner_bottom = max(row_start, row_end - vertical_padding)
            cell_mask = density_mask[inner_top:inner_bottom, inner_left:inner_right]
            density = float(cell_mask.mean()) if cell_mask.size else 0.0
            if density < MIN_CELL_CONTENT_DENSITY:
                continue

            rectangles.append(
                DetectedStickerRect(
                    row_index=row_index + 1,
                    column_index=column_index + 1,
                    x_ratio=round(col_start / page_width, 6),
                    y_ratio=round(row_start / page_height, 6),
                    width_ratio=round((col_end - col_start) / page_width, 6),
                    height_ratio=round((row_end - row_start) / page_height, 6),
                    category=_guess_category(density),
                )
            )

    if not rectangles:
        return PageDetectionResult(
            status="skipped",
            template=template_name,
            reason="A grade foi encontrada, mas nenhuma celula parecia conter uma figurinha valida.",
            rectangles=[],
        )

    return PageDetectionResult(
        status="detected",
        template=template_name,
        reason=None,
        rectangles=rectangles,
    )
