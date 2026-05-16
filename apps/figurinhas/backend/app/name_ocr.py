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
INVALID_NAME_TOKENS = {"PANINI", "FIFA", "BRA", "BRAS", "BRASIL", "FC", "ENG"}
OCR_LANGS = "por+eng"
OCR_CONFIG = "--oem 3"
FAST_ACCEPT_CONFIDENCE = 83
GOOD_ACCEPT_CONFIDENCE = 72


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
    best_valid_result: tuple[str, str, float | None, float] | None = None
    best_raw = None
    best_confidence = None

    variants = _build_ocr_variants(band)
    primary_plan = (
        (variants[0], (7, 6)),
        (variants[1], (7,)),
    )
    fallback_plan = (
        (variants[0], (11,)),
        (variants[2], (7, 11)),
    )

    for variant, psms in primary_plan:
        for psm in psms:
            raw_text, confidence = _run_ocr(variant, psm=psm)
            if not raw_text:
                continue

            if best_raw is None or (confidence or 0.0) > (best_confidence or 0.0):
                best_raw = raw_text
                best_confidence = confidence

            suggested = _normalize_player_name(raw_text)
            if not suggested:
                continue

            score = _candidate_score(suggested, confidence)
            if best_valid_result is None or score > best_valid_result[3]:
                best_valid_result = (raw_text, suggested, confidence, score)
                if _is_fast_accept_candidate(confidence):
                    return OCRNameResult(raw_text=raw_text, suggested_name=suggested, confidence=confidence)

    if best_valid_result is not None and _is_good_enough_candidate(best_valid_result[2]):
        raw_text, suggested, confidence, _ = best_valid_result
        return OCRNameResult(raw_text=raw_text, suggested_name=suggested, confidence=confidence)

    for variant, psms in fallback_plan:
        for psm in psms:
            raw_text, confidence = _run_ocr(variant, psm=psm)
            if not raw_text:
                continue

            if best_raw is None or (confidence or 0.0) > (best_confidence or 0.0):
                best_raw = raw_text
                best_confidence = confidence

            suggested = _normalize_player_name(raw_text)
            if not suggested:
                continue

            score = _candidate_score(suggested, confidence)
            if best_valid_result is None or score > best_valid_result[3]:
                best_valid_result = (raw_text, suggested, confidence, score)

    if best_valid_result is not None:
        raw_text, suggested, confidence, _ = best_valid_result
        return OCRNameResult(raw_text=raw_text, suggested_name=suggested, confidence=confidence)

    if not best_raw:
        return OCRNameResult(raw_text=None, suggested_name=None, confidence=None)

    return OCRNameResult(raw_text=best_raw, suggested_name=None, confidence=best_confidence)


def _candidate_score(suggested_name: str, confidence: float | None) -> float:
    alpha_length = len(re.sub(r"[^A-Za-zÀ-ÿ]", "", suggested_name))
    words = len([word for word in suggested_name.split(" ") if word])
    score = float(confidence or 0.0)
    score += min(alpha_length, 18)
    if words >= 2:
        score += 8
    if words > 4:
        score -= 12
    return score


def _is_fast_accept_candidate(confidence: float | None) -> bool:
    return confidence is not None and confidence >= FAST_ACCEPT_CONFIDENCE


def _is_good_enough_candidate(confidence: float | None) -> bool:
    return confidence is not None and confidence >= GOOD_ACCEPT_CONFIDENCE


def _extract_name_band(image: Image.Image) -> Image.Image:
    width, height = image.size
    left = max(0, int(round(width * 0.04)))
    right = min(width, int(round(width * 0.76)))
    top = max(0, int(round(height * 0.78)))
    bottom = min(height, int(round(height * 0.87)))
    return image.crop((left, top, right, bottom))


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


def _run_ocr(image: Image.Image, psm: int) -> tuple[str | None, float | None]:
    try:
        data = pytesseract.image_to_data(
            image,
            lang=OCR_LANGS,
            config=f"{OCR_CONFIG} --psm {psm}",
            output_type=Output.DICT,
        )
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

    raw_words = [word for word in cleaned.split(" ") if word]
    while len(raw_words) > 1 and len(re.sub(r"[^A-Za-zÀ-ÿ]", "", raw_words[-1])) <= 1:
        raw_words.pop()

    if not raw_words:
        return None

    cleaned = " ".join(raw_words)
    uppercase_tokens = {token.upper() for token in cleaned.replace("-", " ").split(" ") if token}
    letters_only = re.sub(r"[^A-Za-zÀ-ÿ]", "", cleaned)
    if len(letters_only) < 4:
        return None
    if any(token in INVALID_NAME_TOKENS for token in uppercase_tokens):
        return None
    if len(re.sub(r"[^A-Za-zÀ-ÿ]", "", raw_words[0])) <= 1:
        return None
    short_token_count = sum(1 for word in raw_words if len(re.sub(r"[^A-Za-zÀ-ÿ]", "", word)) <= 2)
    if len(raw_words) >= 3 and short_token_count >= 2:
        return None

    words: list[str] = []
    for index, word in enumerate(raw_words):
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
