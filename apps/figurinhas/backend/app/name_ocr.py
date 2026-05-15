from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path

from PIL import Image, ImageOps

try:
    import pytesseract
    from pytesseract import Output
except ImportError:  # pragma: no cover - dependency is expected in container/runtime
    pytesseract = None
    Output = None


LOWERCASE_CONNECTORS = {"da", "de", "do", "das", "dos", "e"}
OCR_LANGS = "por+eng"
OCR_CONFIG = "--oem 3 --psm 7"


@dataclass(slots=True)
class OCRNameResult:
    raw_text: str | None
    suggested_name: str | None
    confidence: float | None


def detect_sticker_name(image_path: Path) -> OCRNameResult:
    if pytesseract is None or Output is None:
        return OCRNameResult(raw_text=None, suggested_name=None, confidence=None)

    try:
        with Image.open(image_path) as image:
            crop = image.convert("RGB")
    except FileNotFoundError:
        return OCRNameResult(raw_text=None, suggested_name=None, confidence=None)

    band = _extract_name_band(crop)
    best_raw = None
    best_confidence = None

    for variant in _build_ocr_variants(band):
        raw_text, confidence = _run_ocr(variant)
        if not raw_text:
            continue
        if best_raw is None or (confidence or 0.0) > (best_confidence or 0.0):
            best_raw = raw_text
            best_confidence = confidence

    if not best_raw:
        return OCRNameResult(raw_text=None, suggested_name=None, confidence=None)

    suggested = _normalize_player_name(best_raw)
    return OCRNameResult(raw_text=best_raw, suggested_name=suggested, confidence=best_confidence)


def _extract_name_band(image: Image.Image) -> Image.Image:
    width, height = image.size
    top = max(0, int(round(height * 0.68)))
    bottom = min(height, int(round(height * 0.95)))
    return image.crop((0, top, width, bottom))


def _build_ocr_variants(image: Image.Image) -> list[Image.Image]:
    grayscale = ImageOps.grayscale(image)
    autocontrast = ImageOps.autocontrast(grayscale)
    enlarged = autocontrast.resize((autocontrast.width * 3, autocontrast.height * 3), Image.Resampling.LANCZOS)

    threshold_dark = enlarged.point(lambda value: 255 if value > 150 else 0, mode="1").convert("L")
    threshold_light = ImageOps.invert(
        enlarged.point(lambda value: 255 if value > 105 else 0, mode="1").convert("L")
    )

    return [
        enlarged,
        threshold_dark,
        threshold_light,
    ]


def _run_ocr(image: Image.Image) -> tuple[str | None, float | None]:
    try:
        data = pytesseract.image_to_data(image, lang=OCR_LANGS, config=OCR_CONFIG, output_type=Output.DICT)
    except (pytesseract.TesseractNotFoundError, RuntimeError):
        return None, None

    tokens: list[str] = []
    confidences: list[float] = []
    for text, confidence in zip(data.get("text", []), data.get("conf", []), strict=False):
        token = _sanitize_ocr_token(text)
        if not token:
            continue
        try:
            numeric_conf = float(confidence)
        except (TypeError, ValueError):
            numeric_conf = -1
        tokens.append(token)
        if numeric_conf >= 0:
            confidences.append(numeric_conf)

    if not tokens:
        return None, None

    raw_text = " ".join(tokens).strip()
    confidence = round(sum(confidences) / len(confidences), 2) if confidences else None
    return raw_text or None, confidence


def _sanitize_ocr_token(text: str | None) -> str:
    if not text:
        return ""
    normalized = text.strip()
    if not normalized:
        return ""

    normalized = normalized.replace("|", "I")
    normalized = re.sub(r"(?<=[A-Za-zÀ-ÿ])0(?=[A-Za-zÀ-ÿ])", "O", normalized)
    normalized = re.sub(r"(?<=[A-Za-zÀ-ÿ])1(?=[A-Za-zÀ-ÿ])", "I", normalized)
    normalized = re.sub(r"[^A-Za-zÀ-ÿ' -]+", "", normalized)
    normalized = re.sub(r"\s+", " ", normalized).strip(" -")
    return normalized


def _normalize_player_name(value: str) -> str | None:
    cleaned = re.sub(r"\s+", " ", value).strip(" -")
    if not cleaned:
        return None

    words: list[str] = []
    for index, word in enumerate(cleaned.split(" ")):
        lower = word.lower()
        if index > 0 and lower in LOWERCASE_CONNECTORS:
            words.append(lower)
            continue
        words.append(_smart_title(word))

    normalized = " ".join(words).strip()
    return normalized or None


def _smart_title(word: str) -> str:
    if not word:
        return word
    if word.isupper() and len(word) <= 3:
        return word
    return word[:1].upper() + word[1:].lower()
