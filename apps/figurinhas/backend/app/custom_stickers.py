from __future__ import annotations

import base64
import io
from dataclasses import dataclass
from pathlib import Path
from typing import Callable

import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont, ImageOps
from openai import APIConnectionError, APIStatusError, AuthenticationError, OpenAI, RateLimitError
try:
    import cv2
except Exception:  # pragma: no cover
    cv2 = None
try:
    from rembg import remove as rembg_remove
except Exception:  # pragma: no cover
    rembg_remove = None


PROFILE_LABELS = {
    "HOMEM": "Homem",
    "MULHER": "Mulher",
    "CRIANCA": "Crianca",
    "MENINO": "Crianca",
    "MENINA": "Crianca",
}

PROFILE_THEMES = {
    "HOMEM": ("#0f2748", "#1f7a4d", "#cde7d7"),
    "MULHER": ("#5b1f55", "#d54f8a", "#f5c5da"),
    "CRIANCA": ("#134f7c", "#22a2d6", "#cceaf6"),
    "MENINO": ("#134f7c", "#22a2d6", "#cceaf6"),
    "MENINA": ("#134f7c", "#22a2d6", "#cceaf6"),
}

CUSTOM_FONT_SEARCH = {
    True: [
        Path(__file__).resolve().parent / "fonts" / "ebrimabd.ttf",
        Path("C:/Windows/Fonts/ebrimabd.ttf"),
        Path("/usr/share/fonts/truetype/msttcorefonts/Ebrima Bold.ttf"),
        Path("/usr/share/fonts/truetype/msttcorefonts/ebrimabd.ttf"),
        Path("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"),
    ],
    False: [
        Path(__file__).resolve().parent / "fonts" / "ebrima.ttf",
        Path("C:/Windows/Fonts/ebrima.ttf"),
        Path("/usr/share/fonts/truetype/msttcorefonts/Ebrima.ttf"),
        Path("/usr/share/fonts/truetype/msttcorefonts/ebrima.ttf"),
        Path("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"),
    ],
}

DEFAULT_CUSTOM_STICKER_PROMPT_TEMPLATE = (
    "Keep the official sticker very close to the first image, preserving the background, base, frame, information band, framing and overall sticker structure. "
    "{base_hint}Adjust only the person so the result looks natural, using the second image as the real reference for the face and identity. "
    "You may adapt the shirt, neck, shoulders and torso integration only as much as necessary to keep natural anatomy between head and body. "
    "The head must stay at a realistic size and proportion in relation to the body. "
    "Do not create a big head, small head, stretched head, misaligned head or pasted-face effect. "
    "Keep the person's real facial features and identity from the second image. "
    "{details_hint}{city_hint}Do not alter the background, base, frame, information band or overall sticker design. Return one complete finished sticker image only."
)


@dataclass
class CustomStickerRender:
    portrait_bytes: bytes
    final_bytes: bytes


@dataclass
class ManualCutoutAssets:
    cutout_bytes: bytes
    portrait_bytes: bytes
    cutout_preview_bytes: bytes
    portrait_preview_bytes: bytes
    preview_mime_type: str


class _SafePromptValues(dict):
    def __missing__(self, key):  # pragma: no cover - defensive fallback
        return ""


def generate_custom_sticker_render(
    settings,
    *,
    uploaded_photo_bytes: bytes,
    prepared_portrait_bytes: bytes | None = None,
    base_template_path: Path | None = None,
    composition_mode: str | None = None,
    template_layers: list[dict] | None = None,
    photo_slot: dict | None = None,
    text_slots: list[dict] | None = None,
    prompt_template: str | None = None,
    name: str,
    profile_type: str,
    birth_date_text: str | None,
    height_text: str | None,
    weight_text: str | None,
    city_or_team: str | None,
    target_width_px: int,
    target_height_px: int,
    photo_offset_x: float | None = None,
    photo_offset_y: float | None = None,
    photo_scale: float | None = None,
    photo_rotation: float | None = None,
    progress_callback: Callable[[int, str], None] | None = None,
) -> CustomStickerRender:
    def report(progress: int, message: str) -> None:
        if progress_callback:
            progress_callback(progress, message)

    active_template_layers = [layer for layer in (template_layers or []) if layer.get("file_path") and layer.get("is_active", True)]
    use_layer_composition = composition_mode == "LAYERS" and bool(active_template_layers) and bool(photo_slot)
    uploaded_photo = None
    base_template = None
    openai_sticker_image = None
    ai_error_message = None
    openai_reference_photo = None
    report(8, "Validando o modelo...")
    if not use_layer_composition:
        uploaded_photo = _open_uploaded_photo(uploaded_photo_bytes)
        base_template = _open_base_template(base_template_path, target_size=(target_width_px, target_height_px))
    elif not prepared_portrait_bytes:
        uploaded_photo = _open_uploaded_photo(uploaded_photo_bytes)

    if not use_layer_composition and base_template is not None and settings.openai_api_key and uploaded_photo is not None:
        try:
            if prepared_portrait_bytes:
                report(18, "Preparando o retrato...")
                with Image.open(io.BytesIO(prepared_portrait_bytes)) as prepared_image:
                    openai_reference_photo = ImageOps.exif_transpose(prepared_image).convert("RGBA")
            else:
                report(18, "Removendo fundo...")
                cutout_image = _remove_photo_background(uploaded_photo)
                report(24, "Preparando o retrato...")
                openai_reference_photo = _build_portrait_cutout(uploaded_photo, cutout_image)
            report(26, "Preparando a base...")
            openai_sticker_image = _generate_sticker_with_openai(
                settings,
                uploaded_photo=openai_reference_photo or uploaded_photo,
                base_template=base_template,
                prompt_template=prompt_template,
                name=name,
                profile_type=profile_type,
                birth_date_text=birth_date_text,
                height_text=height_text,
                weight_text=weight_text,
                city_or_team=city_or_team,
                target_width_px=target_width_px,
                target_height_px=target_height_px,
            )
            report(74, "Criando sua figurinha com IA...")
        except Exception as exc:
            ai_error_message = _humanize_openai_error(exc)
        if openai_sticker_image is None:
            ai_error_message = ai_error_message or "Nao foi possivel gerar a figurinha com IA usando a base selecionada. Tente novamente."
    elif not use_layer_composition and base_template is not None:
        ai_error_message = "Configure uma chave da OpenAI para gerar a figurinha com IA usando a base oficial."

    if composition_mode == "AI_OPTIONAL" and openai_sticker_image is None:
        raise ValueError(ai_error_message or "Nao foi possivel gerar a figurinha com IA usando a base selecionada. Tente novamente.")

    if use_layer_composition:
        if prepared_portrait_bytes:
            report(34, "Aplicando o retrato preparado...")
            with Image.open(io.BytesIO(prepared_portrait_bytes)) as prepared_image:
                portrait_image = ImageOps.exif_transpose(prepared_image).convert("RGBA")
        else:
            if uploaded_photo is None:
                uploaded_photo = _open_uploaded_photo(uploaded_photo_bytes)
            report(28, "Removendo fundo...")
            cutout_image = _remove_photo_background(uploaded_photo)
            report(56, "Preparando o retrato...")
            portrait_image = _build_portrait_cutout(uploaded_photo, cutout_image)
        report(82, "Montando sua figurinha...")
        final_image = _compose_sticker_card_from_layers(
            portrait_image=portrait_image,
            template_layers=active_template_layers,
            photo_slot=photo_slot or {},
            text_slots=text_slots or [],
            name=name,
            birth_date_text=birth_date_text,
            height_text=height_text,
            weight_text=weight_text,
            city_or_team=city_or_team,
            width_px=target_width_px,
            height_px=target_height_px,
            photo_offset_x=photo_offset_x,
            photo_offset_y=photo_offset_y,
            photo_scale=photo_scale,
            photo_rotation=photo_rotation,
        )
    elif openai_sticker_image is not None:
        report(88, "Finalizando o resultado...")
        final_image = _resize_to_exact(openai_sticker_image, (target_width_px, target_height_px))
        portrait_image = final_image
    else:
        report(34, "Preparando a base...")
        portrait_image = _generate_portrait_with_fallback(
            settings,
            uploaded_photo=uploaded_photo,
            base_template=base_template,
            prompt_template=prompt_template,
            name=name,
            profile_type=profile_type,
            birth_date_text=birth_date_text,
            height_text=height_text,
            weight_text=weight_text,
            city_or_team=city_or_team,
            target_width_px=max(int(target_width_px * 0.86), 720),
            target_height_px=max(int(target_height_px * 0.62), 960),
        )
        report(78, "Montando sua figurinha...")
        final_image = _compose_sticker_card(
            portrait_image,
            base_template=base_template,
            name=name,
            profile_type=profile_type,
            birth_date_text=birth_date_text,
            height_text=height_text,
            weight_text=weight_text,
            city_or_team=city_or_team,
            width_px=target_width_px,
            height_px=target_height_px,
        )
        if ai_error_message:
            print(f"[figurinhas] Minha Figurinha usando fallback local: {ai_error_message}")

    report(94, "Preparando os arquivos finais...")
    portrait_buffer = io.BytesIO()
    portrait_image.save(portrait_buffer, format="PNG", optimize=True)

    final_buffer = io.BytesIO()
    final_image.save(final_buffer, format="PNG", optimize=True)
    return CustomStickerRender(
        portrait_bytes=portrait_buffer.getvalue(),
        final_bytes=final_buffer.getvalue(),
    )


def _open_uploaded_photo(uploaded_photo_bytes: bytes) -> Image.Image:
    with Image.open(io.BytesIO(uploaded_photo_bytes)) as raw_image:
        return ImageOps.exif_transpose(raw_image).convert("RGB")


def _open_base_template(base_template_path: Path | None, *, target_size: tuple[int, int]) -> Image.Image | None:
    if base_template_path is None or not base_template_path.exists():
        return None
    with Image.open(base_template_path) as raw_image:
        base_template = ImageOps.exif_transpose(raw_image).convert("RGBA")
    return _fit_cover(base_template, target_size).convert("RGBA")


def _generate_portrait_with_fallback(
    settings,
    *,
    uploaded_photo: Image.Image,
    base_template: Image.Image | None,
    prompt_template: str | None,
    name: str,
    profile_type: str,
    birth_date_text: str | None,
    height_text: str | None,
    weight_text: str | None,
    city_or_team: str | None,
    target_width_px: int,
    target_height_px: int,
) -> Image.Image:
    return _build_stylized_fallback(uploaded_photo, profile_type, (target_width_px, target_height_px))


def _remove_photo_background(uploaded_photo: Image.Image) -> Image.Image:
    if rembg_remove is None:
        return uploaded_photo.convert("RGBA")

    buffer = io.BytesIO()
    uploaded_photo.convert("RGBA").save(buffer, format="PNG", optimize=True)
    result_bytes = rembg_remove(buffer.getvalue())
    with Image.open(io.BytesIO(result_bytes)) as raw_image:
        return ImageOps.exif_transpose(raw_image).convert("RGBA")


def _detect_face_box(uploaded_photo: Image.Image) -> tuple[int, int, int, int] | None:
    if cv2 is None:  # pragma: no cover - dependency fallback
        return None

    rgb_image = uploaded_photo.convert("RGB")
    working_image = rgb_image
    longest_side = max(rgb_image.width, rgb_image.height)
    if longest_side > 1280:
        scale = 1280 / longest_side
        working_image = rgb_image.resize(
            (max(1, int(round(rgb_image.width * scale))), max(1, int(round(rgb_image.height * scale)))),
            Image.Resampling.LANCZOS,
        )

    image_array = np.array(working_image)
    if image_array.size == 0:
        return None

    gray = cv2.cvtColor(image_array, cv2.COLOR_RGB2GRAY)
    cascade_path = getattr(getattr(cv2, "data", None), "haarcascades", "")
    if not cascade_path:
        return None
    classifier = cv2.CascadeClassifier(str(Path(cascade_path) / "haarcascade_frontalface_default.xml"))
    if classifier.empty():  # pragma: no cover - defensive
        return None

    min_side = max(40, min(gray.shape[:2]) // 9)
    detected = classifier.detectMultiScale(
        gray,
        scaleFactor=1.08,
        minNeighbors=5,
        minSize=(min_side, min_side),
    )
    if len(detected) == 0:
        return None

    x, y, width, height = max(detected, key=lambda item: item[2] * item[3])
    scale_back_x = rgb_image.width / max(working_image.width, 1)
    scale_back_y = rgb_image.height / max(working_image.height, 1)
    return (
        int(round(x * scale_back_x)),
        int(round(y * scale_back_y)),
        int(round(width * scale_back_x)),
        int(round(height * scale_back_y)),
    )


def _estimate_head_box_from_cutout(cutout_image: Image.Image) -> tuple[int, int, int, int] | None:
    alpha = cutout_image.getchannel("A")
    subject_bbox = alpha.getbbox()
    if subject_bbox is None:
        return None

    left, top, right, bottom = subject_bbox
    subject_width = max(right - left, 1)
    subject_height = max(bottom - top, 1)
    upper_bound = top + max(int(subject_height * 0.48), 1)
    upper_region = alpha.crop((left, top, right, upper_bound))
    upper_bbox = upper_region.getbbox()
    if upper_bbox is not None:
        head_left = left + upper_bbox[0]
        head_top = top + upper_bbox[1]
        head_right = left + upper_bbox[2]
        head_bottom = top + upper_bbox[3]
        return (
            head_left,
            head_top,
            max(head_right - head_left, 1),
            max(head_bottom - head_top, 1),
        )

    estimated_width = max(int(subject_width * 0.56), 1)
    estimated_height = max(int(subject_height * 0.32), 1)
    estimated_left = left + max((subject_width - estimated_width) // 2, 0)
    return estimated_left, top, estimated_width, estimated_height


def _expand_subject_box_to_portrait(
    image_size: tuple[int, int],
    subject_box: tuple[int, int, int, int],
    *,
    face_detected: bool,
) -> tuple[int, int, int, int]:
    image_width, image_height = image_size
    x, y, width, height = subject_box
    # Bias the portrait crop upward so high zoom keeps more hair/forehead
    # while still trimming excess shoulders and torso.
    side_padding = 0.62 if face_detected else 0.5
    top_padding = 1.32 if face_detected else 0.58
    bottom_padding = 0.24 if face_detected else 0.48

    left = max(int(round(x - width * side_padding)), 0)
    top = max(int(round(y - height * top_padding)), 0)
    right = min(int(round(x + width + width * side_padding)), image_width)
    bottom = min(int(round(y + height + height * bottom_padding)), image_height)

    if right <= left:
        right = min(left + max(width, 1), image_width)
    if bottom <= top:
        bottom = min(top + max(height, 1), image_height)
    return left, top, right, bottom


def _pad_cutout_image(image: Image.Image, *, padding_ratio: float = 0.12) -> Image.Image:
    padding_x = max(int(round(image.width * padding_ratio)), 6)
    padding_y = max(int(round(image.height * padding_ratio)), 6)
    canvas = Image.new("RGBA", (image.width + padding_x * 2, image.height + padding_y * 2), (0, 0, 0, 0))
    canvas.alpha_composite(image.convert("RGBA"), (padding_x, padding_y))
    return canvas


def _build_portrait_cutout(uploaded_photo: Image.Image, cutout_image: Image.Image) -> Image.Image:
    face_box = _detect_face_box(uploaded_photo)
    if face_box is not None:
        crop_box = _expand_subject_box_to_portrait(cutout_image.size, face_box, face_detected=True)
    else:
        estimated_head_box = _estimate_head_box_from_cutout(cutout_image)
        if estimated_head_box is None:
            return cutout_image.convert("RGBA")
        crop_box = _expand_subject_box_to_portrait(cutout_image.size, estimated_head_box, face_detected=False)

    portrait = cutout_image.crop(crop_box).convert("RGBA")
    return _pad_cutout_image(portrait)


def _encode_preview_image(image: Image.Image, *, max_longest_side: int = 1200) -> tuple[bytes, str]:
    preview = image.convert("RGBA")
    longest_side = max(preview.width, preview.height)
    if longest_side > max_longest_side:
        scale = max_longest_side / longest_side
        preview = preview.resize(
            (max(1, int(round(preview.width * scale))), max(1, int(round(preview.height * scale)))),
            Image.Resampling.LANCZOS,
        )

    buffer = io.BytesIO()
    try:
        preview.save(buffer, format="WEBP", quality=90, method=6)
        return buffer.getvalue(), "image/webp"
    except Exception:  # pragma: no cover - Pillow/codec fallback
        buffer = io.BytesIO()
        preview.save(buffer, format="PNG", optimize=True)
        return buffer.getvalue(), "image/png"


def build_manual_cutout_assets(
    uploaded_photo_bytes: bytes,
    *,
    progress_callback: Callable[[int, str], None] | None = None,
) -> ManualCutoutAssets:
    def report(progress: int, message: str) -> None:
        if progress_callback:
            progress_callback(progress, message)

    report(12, "Recebendo a foto...")
    uploaded_photo = _open_uploaded_photo(uploaded_photo_bytes)
    report(32, "Removendo fundo...")
    cutout_image = _remove_photo_background(uploaded_photo)
    report(58, "Preparando o retrato...")
    portrait_image = _build_portrait_cutout(uploaded_photo, cutout_image)
    report(82, "Gerando o preview...")
    portrait_preview_bytes, preview_mime_type = _encode_preview_image(portrait_image, max_longest_side=1200)
    cutout_preview_bytes, _ = _encode_preview_image(cutout_image, max_longest_side=1200)

    report(94, "Finalizando o encaixe...")
    cutout_buffer = io.BytesIO()
    cutout_image.save(cutout_buffer, format="PNG", optimize=True)
    portrait_buffer = io.BytesIO()
    portrait_image.save(portrait_buffer, format="PNG", optimize=True)
    return ManualCutoutAssets(
        cutout_bytes=cutout_buffer.getvalue(),
        portrait_bytes=portrait_buffer.getvalue(),
        cutout_preview_bytes=cutout_preview_bytes,
        portrait_preview_bytes=portrait_preview_bytes,
        preview_mime_type=preview_mime_type,
    )


def remove_photo_background_bytes(uploaded_photo_bytes: bytes) -> bytes:
    return build_manual_cutout_assets(uploaded_photo_bytes).cutout_bytes


def _generate_sticker_with_openai(
    settings,
    *,
    uploaded_photo: Image.Image,
    base_template: Image.Image,
    prompt_template: str | None,
    name: str,
    profile_type: str,
    birth_date_text: str | None,
    height_text: str | None,
    weight_text: str | None,
    city_or_team: str | None,
    target_width_px: int,
    target_height_px: int,
) -> Image.Image | None:
    client = OpenAI(api_key=settings.openai_api_key)
    prompt = _build_openai_prompt(
        prompt_template=prompt_template,
        name=name,
        profile_type=profile_type,
        birth_date_text=birth_date_text,
        height_text=height_text,
        weight_text=weight_text,
        city_or_team=city_or_team,
        has_base_template=True,
    )
    response = client.images.edit(
        model=settings.openai_image_model,
        image=[
            _image_to_upload_file(base_template, "base.png"),
            _image_to_upload_file(uploaded_photo, "photo.png"),
        ],
        prompt=prompt,
        size=_normalize_openai_size(target_width_px, target_height_px),
        quality=settings.openai_image_quality,
    )
    if response.data and response.data[0].b64_json:
        return Image.open(io.BytesIO(base64.b64decode(response.data[0].b64_json))).convert("RGB")
    return None


def _humanize_openai_error(exc: Exception) -> str:
    message = str(exc)
    normalized = message.lower()
    if isinstance(exc, AuthenticationError):
        return "A chave da OpenAI configurada nao conseguiu autorizar a geracao dessa figurinha."
    if isinstance(exc, RateLimitError):
        return "A chave da OpenAI atingiu o limite de uso para gerar imagens agora. Tente outra chave ou aguarde."
    if isinstance(exc, APIConnectionError):
        return "A OpenAI nao respondeu a tempo para gerar a figurinha. Tente novamente em instantes."
    if isinstance(exc, APIStatusError):
        status_code = getattr(exc, "status_code", None)
        if status_code == 429:
            return "A chave da OpenAI atingiu o limite de uso para gerar imagens agora. Tente outra chave ou aguarde."
        if status_code == 400:
            if "billing" in normalized or "hard limit" in normalized:
                return "A chave da OpenAI foi aceita, mas a conta atingiu o limite de cobranca para gerar imagens."
            return "A OpenAI recusou essa geracao de imagem. Revise a foto, a base ou o prompt configurado."
    if "billing" in normalized or "hard limit" in normalized:
        return "A chave da OpenAI foi aceita, mas a conta atingiu o limite de cobranca para gerar imagens."
    if "quota" in normalized or "429" in normalized:
        return "A chave da OpenAI atingiu o limite de uso para gerar imagens agora. Tente outra chave ou aguarde."
    if "api key" in normalized or "invalid" in normalized or "permission" in normalized or "unauthorized" in normalized:
        return "A chave da OpenAI configurada nao conseguiu autorizar a geracao dessa figurinha."
    if "deadline" in normalized or "timed out" in normalized or "timeout" in normalized:
        return "A OpenAI demorou demais para responder. Tente novamente em instantes."
    if "safety" in normalized or "blocked" in normalized:
        return "A OpenAI bloqueou essa geracao por politica de seguranca. Tente outra foto."
    if message.strip():
        return f"Nao foi possivel gerar a figurinha com IA: {message}"
    return "Nao foi possivel gerar a figurinha com IA usando a base selecionada. Tente novamente."


def _build_openai_prompt(
    *,
    prompt_template: str | None,
    name: str,
    profile_type: str,
    birth_date_text: str | None,
    height_text: str | None,
    weight_text: str | None,
    city_or_team: str | None,
    has_base_template: bool,
) -> str:
    profile_label = PROFILE_LABELS.get(profile_type, "Pessoa")
    city_hint = f" If the sticker has a field for city or team, use exactly '{city_or_team}'." if city_or_team else ""
    base_hint = (
        " Use the first image as the official finished sticker base. Keep the same frame, shirt, background, layout, "
        "colors, badges, shadows and collectible card design, and replace only the person in that sticker with the "
        "real person from the second image."
        if has_base_template
        else ""
    )
    details_parts = []
    details_parts.append(f"name {name}")
    if birth_date_text:
        details_parts.append(f"date {birth_date_text}")
    if height_text:
        details_parts.append(f"height {height_text}")
    if weight_text:
        details_parts.append(f"weight {weight_text}")
    if city_or_team:
        details_parts.append(f"city or team {city_or_team}")
    details_hint = (
        "If the sticker shows editable identity details, use these exact values in the correct fields: "
        + ", ".join(details_parts)
        + ". "
        if details_parts
        else ""
    )
    template = (prompt_template or "").strip() or DEFAULT_CUSTOM_STICKER_PROMPT_TEMPLATE
    values = _SafePromptValues(
        {
            "name": name,
            "profile_label": profile_label,
            "profile_label_lower": profile_label.lower(),
            "birth_date_text": birth_date_text or "",
            "height_text": height_text or "",
            "weight_text": weight_text or "",
            "city_or_team": city_or_team or "",
            "city_hint": city_hint,
            "base_hint": f"{base_hint} " if base_hint else "",
            "details_hint": details_hint,
        }
    )
    return " ".join(template.format_map(values).split())


def _image_to_upload_file(image: Image.Image, file_name: str) -> io.BytesIO:
    buffer = io.BytesIO()
    image.convert("RGB").save(buffer, format="PNG", optimize=True)
    buffer.seek(0)
    buffer.name = file_name
    return buffer


def _normalize_openai_size(target_width_px: int, target_height_px: int) -> str:
    width = max(16, int(round(target_width_px / 16)) * 16)
    height = max(16, int(round(target_height_px / 16)) * 16)

    max_edge = max(width, height)
    if max_edge > 3840:
        scale = 3840 / max_edge
        width = max(16, int(round((width * scale) / 16)) * 16)
        height = max(16, int(round((height * scale) / 16)) * 16)

    ratio = max(width, height) / max(min(width, height), 1)
    if ratio > 3:
        if width > height:
            height = max(16, int(round((width / 3) / 16)) * 16)
        else:
            width = max(16, int(round((height / 3) / 16)) * 16)

    min_pixels = 655_360
    total_pixels = width * height
    if total_pixels < min_pixels:
        scale = (min_pixels / max(total_pixels, 1)) ** 0.5
        width = max(16, int(round((width * scale) / 16)) * 16)
        height = max(16, int(round((height * scale) / 16)) * 16)

    width = min(width, 3840)
    height = min(height, 3840)
    return f"{width}x{height}"


def _build_stylized_fallback(
    uploaded_photo: Image.Image,
    profile_type: str,
    target_size: tuple[int, int],
) -> Image.Image:
    portrait = _fit_cover(uploaded_photo, target_size)
    portrait = portrait.filter(ImageFilter.GaussianBlur(radius=0.4))
    background = _vertical_gradient(target_size, *PROFILE_THEMES.get(profile_type, PROFILE_THEMES["HOMEM"])[:2])
    accent = Image.new("RGBA", target_size, (0, 0, 0, 0))
    accent_draw = ImageDraw.Draw(accent)
    accent_draw.ellipse(
        (
            target_size[0] * 0.08,
            target_size[1] * 0.04,
            target_size[0] * 0.92,
            target_size[1] * 0.9,
        ),
        fill=(255, 255, 255, 36),
    )
    portrait = Image.blend(background.convert("RGB"), portrait, 0.7)
    portrait_rgba = portrait.convert("RGBA")
    portrait_rgba.alpha_composite(accent)
    return portrait_rgba.convert("RGB")


def _compose_sticker_card(
    portrait_image: Image.Image,
    *,
    base_template: Image.Image | None,
    name: str,
    profile_type: str,
    birth_date_text: str | None,
    height_text: str | None,
    weight_text: str | None,
    city_or_team: str | None,
    width_px: int,
    height_px: int,
) -> Image.Image:
    if base_template is not None:
        return _compose_sticker_card_from_base(
            base_template,
            portrait_image,
            name=name,
            profile_type=profile_type,
            birth_date_text=birth_date_text,
            height_text=height_text,
            weight_text=weight_text,
            city_or_team=city_or_team,
            width_px=width_px,
            height_px=height_px,
        )

    primary, secondary, soft = PROFILE_THEMES.get(profile_type, PROFILE_THEMES["HOMEM"])
    canvas = _vertical_gradient((width_px, height_px), primary, secondary)
    draw = ImageDraw.Draw(canvas)

    outer_margin = max(int(width_px * 0.035), 24)
    inner_margin = max(int(width_px * 0.05), 30)
    radius = max(int(width_px * 0.06), 28)

    card_area = (outer_margin, outer_margin, width_px - outer_margin, height_px - outer_margin)
    card_shadow = Image.new("RGBA", (width_px, height_px), (0, 0, 0, 0))
    shadow_draw = ImageDraw.Draw(card_shadow)
    shadow_draw.rounded_rectangle(
        (
            card_area[0] + 8,
            card_area[1] + 14,
            card_area[2] + 8,
            card_area[3] + 14,
        ),
        radius=radius,
        fill=(7, 15, 29, 68),
    )
    card_shadow = card_shadow.filter(ImageFilter.GaussianBlur(radius=12))
    canvas = Image.alpha_composite(canvas.convert("RGBA"), card_shadow).convert("RGB")
    draw = ImageDraw.Draw(canvas)

    draw.rounded_rectangle(card_area, radius=radius, fill=(249, 251, 255), outline=soft, width=max(width_px // 180, 3))

    header_height = int(height_px * 0.08)
    draw.rounded_rectangle(
        (card_area[0], card_area[1], card_area[2], card_area[1] + header_height),
        radius=radius,
        fill=primary,
    )
    draw.rectangle(
        (card_area[0], card_area[1] + header_height - radius, card_area[2], card_area[1] + header_height),
        fill=primary,
    )

    header_font = _load_font(max(int(width_px * 0.05), 26), bold=True)
    draw.text(
        (card_area[0] + inner_margin, card_area[1] + header_height * 0.24),
        "MINHA FIGURINHA",
        fill=(255, 255, 255),
        font=header_font,
    )

    portrait_top = card_area[1] + header_height + max(int(height_px * 0.025), 18)
    portrait_height = int((card_area[3] - card_area[1]) * 0.55)
    portrait_box = (
        card_area[0] + inner_margin,
        portrait_top,
        card_area[2] - inner_margin,
        portrait_top + portrait_height,
    )
    portrait_frame = Image.new("RGBA", (width_px, height_px), (0, 0, 0, 0))
    frame_draw = ImageDraw.Draw(portrait_frame)
    frame_draw.rounded_rectangle(
        portrait_box,
        radius=max(int(width_px * 0.05), 22),
        fill=(230, 236, 244, 255),
        outline=soft,
        width=max(width_px // 210, 2),
    )
    portrait_mask = Image.new("L", (portrait_box[2] - portrait_box[0], portrait_box[3] - portrait_box[1]), 0)
    ImageDraw.Draw(portrait_mask).rounded_rectangle(
        (0, 0, portrait_mask.width, portrait_mask.height),
        radius=max(int(width_px * 0.05), 22),
        fill=255,
    )
    fitted_portrait = _fit_cover(portrait_image, (portrait_mask.width, portrait_mask.height)).convert("RGBA")
    portrait_frame.paste(fitted_portrait, (portrait_box[0], portrait_box[1]), portrait_mask)
    canvas = Image.alpha_composite(canvas.convert("RGBA"), portrait_frame).convert("RGB")
    draw = ImageDraw.Draw(canvas)

    badge_y = portrait_box[3] + max(int(height_px * 0.022), 16)
    name_font = _load_font(max(int(width_px * 0.082), 34), bold=True)
    meta_font = _load_font(max(int(width_px * 0.042), 20), bold=False)
    meta_label_font = _load_font(max(int(width_px * 0.034), 16), bold=True)

    profile_label = PROFILE_LABELS.get(profile_type, "Perfil")
    badge_text_width = int(meta_font.getbbox(profile_label)[2] - meta_font.getbbox(profile_label)[0]) + inner_margin
    badge_box = (
        card_area[0] + inner_margin,
        badge_y,
        card_area[0] + inner_margin + badge_text_width,
        badge_y + max(int(height_px * 0.06), 34),
    )
    draw.rounded_rectangle(badge_box, radius=max(int(width_px * 0.03), 18), fill=soft)
    draw.text((badge_box[0] + inner_margin * 0.35, badge_box[1] + inner_margin * 0.12), profile_label, fill=primary, font=meta_font)

    name_top = badge_box[3] + max(int(height_px * 0.018), 14)
    draw.text((card_area[0] + inner_margin, name_top), name.upper(), fill=primary, font=name_font)

    info_top = name_top + int(name_font.size * 1.35)
    info_gap = max(int(height_px * 0.018), 14)
    info_height = max(int(height_px * 0.085), 54)
    column_gap = max(int(width_px * 0.03), 18)
    info_width = ((card_area[2] - card_area[0]) - inner_margin * 2 - column_gap) / 2

    info_items = [
        ("Data", birth_date_text or "--"),
        ("Altura", height_text or "--"),
        ("Peso", weight_text or "--"),
        ("Cidade ou time", city_or_team or "--"),
    ]

    for index, (label, value) in enumerate(info_items):
        column = index % 2
        row = index // 2
        left = card_area[0] + inner_margin + column * (info_width + column_gap)
        top = info_top + row * (info_height + info_gap)
        right = left + info_width
        bottom = top + info_height
        draw.rounded_rectangle((left, top, right, bottom), radius=max(int(width_px * 0.028), 16), fill=(241, 246, 250))
        draw.text((left + inner_margin * 0.34, top + inner_margin * 0.18), label, fill=secondary, font=meta_label_font)
        draw.text((left + inner_margin * 0.34, top + inner_margin * 0.75), value, fill=primary, font=meta_font)

    footer_text = "Adicione esta figurinha ao mesmo PDF das selecoes"
    footer_font = _load_font(max(int(width_px * 0.028), 14), bold=True)
    footer_box = footer_font.getbbox(footer_text)
    footer_width = footer_box[2] - footer_box[0]
    footer_y = card_area[3] - max(int(height_px * 0.06), 38)
    draw.text(
        (card_area[2] - inner_margin - footer_width, footer_y),
        footer_text,
        fill=(88, 102, 124),
        font=footer_font,
    )

    return canvas


def _compose_sticker_card_from_base(
    base_template: Image.Image,
    portrait_image: Image.Image,
    *,
    name: str,
    profile_type: str,
    birth_date_text: str | None,
    height_text: str | None,
    weight_text: str | None,
    city_or_team: str | None,
    width_px: int,
    height_px: int,
) -> Image.Image:
    primary, secondary, soft = PROFILE_THEMES.get(profile_type, PROFILE_THEMES["HOMEM"])
    canvas = _fit_cover(base_template, (width_px, height_px)).convert("RGBA")

    portrait_box = (
        int(width_px * 0.11),
        int(height_px * 0.12),
        int(width_px * 0.89),
        int(height_px * 0.64),
    )
    portrait_shadow = Image.new("RGBA", (width_px, height_px), (0, 0, 0, 0))
    shadow_draw = ImageDraw.Draw(portrait_shadow)
    shadow_draw.rounded_rectangle(
        (
            portrait_box[0] + max(width_px // 160, 4),
            portrait_box[1] + max(height_px // 120, 8),
            portrait_box[2] + max(width_px // 160, 4),
            portrait_box[3] + max(height_px // 120, 8),
        ),
        radius=max(int(width_px * 0.045), 20),
        fill=(7, 15, 29, 72),
    )
    portrait_shadow = portrait_shadow.filter(ImageFilter.GaussianBlur(radius=14))
    canvas = Image.alpha_composite(canvas, portrait_shadow)

    portrait_mask = Image.new("L", (portrait_box[2] - portrait_box[0], portrait_box[3] - portrait_box[1]), 0)
    ImageDraw.Draw(portrait_mask).rounded_rectangle(
        (0, 0, portrait_mask.width, portrait_mask.height),
        radius=max(int(width_px * 0.045), 20),
        fill=255,
    )
    fitted_portrait = _fit_cover(portrait_image, (portrait_mask.width, portrait_mask.height)).convert("RGBA")
    canvas.paste(fitted_portrait, (portrait_box[0], portrait_box[1]), portrait_mask)

    draw = ImageDraw.Draw(canvas)
    name_font = _load_font(max(int(width_px * 0.074), 30), bold=True)
    meta_font = _load_font(max(int(width_px * 0.035), 17), bold=False)
    meta_label_font = _load_font(max(int(width_px * 0.028), 14), bold=True)
    badge_font = _load_font(max(int(width_px * 0.032), 16), bold=True)

    badge_text = PROFILE_LABELS.get(profile_type, "Perfil")
    badge_width = int(badge_font.getbbox(badge_text)[2] - badge_font.getbbox(badge_text)[0]) + max(int(width_px * 0.09), 52)
    badge_box = (
        int(width_px * 0.11),
        int(height_px * 0.665),
        int(width_px * 0.11) + badge_width,
        int(height_px * 0.665) + max(int(height_px * 0.05), 32),
    )
    draw.rounded_rectangle(badge_box, radius=max(int(width_px * 0.026), 16), fill=(255, 255, 255, 225))
    draw.text(
        (badge_box[0] + max(int(width_px * 0.025), 16), badge_box[1] + max(int(height_px * 0.009), 8)),
        badge_text,
        fill=primary,
        font=badge_font,
    )

    name_top = badge_box[3] + max(int(height_px * 0.012), 10)
    _draw_text_with_shadow(
        draw,
        (int(width_px * 0.11), name_top),
        name.upper(),
        font=name_font,
        fill=(255, 255, 255),
        shadow_fill=(7, 15, 29, 160),
        shadow_offset=(0, max(height_px // 420, 2)),
    )

    info_items = [
        ("Data", birth_date_text or "--"),
        ("Altura", height_text or "--"),
        ("Peso", weight_text or "--"),
        ("Cidade ou time", city_or_team or "--"),
    ]
    info_top = int(height_px * 0.785)
    info_height = max(int(height_px * 0.078), 54)
    info_gap = max(int(width_px * 0.022), 14)
    info_left = int(width_px * 0.11)
    info_width = int((width_px * 0.78 - info_gap) / 2)

    for index, (label, value) in enumerate(info_items):
        column = index % 2
        row = index // 2
        left = info_left + column * (info_width + info_gap)
        top = info_top + row * (info_height + max(int(height_px * 0.018), 12))
        right = left + info_width
        bottom = top + info_height
        draw.rounded_rectangle(
            (left, top, right, bottom),
            radius=max(int(width_px * 0.025), 15),
            fill=(255, 255, 255, 214),
            outline=(255, 255, 255, 150),
            width=max(width_px // 260, 2),
        )
        draw.text((left + max(int(width_px * 0.022), 14), top + max(int(height_px * 0.01), 8)), label, fill=secondary, font=meta_label_font)
        draw.text((left + max(int(width_px * 0.022), 14), top + max(int(height_px * 0.038), 28)), value, fill=primary, font=meta_font)

    return canvas.convert("RGB")


def _compose_sticker_card_from_layers(
    *,
    portrait_image: Image.Image,
    template_layers: list[dict],
    photo_slot: dict,
    text_slots: list[dict],
    name: str,
    birth_date_text: str | None,
    height_text: str | None,
    weight_text: str | None,
    city_or_team: str | None,
    width_px: int,
    height_px: int,
    photo_offset_x: float | None = None,
    photo_offset_y: float | None = None,
    photo_scale: float | None = None,
    photo_rotation: float | None = None,
) -> Image.Image:
    canvas = Image.new("RGBA", (width_px, height_px), (0, 0, 0, 0))
    sorted_layers = sorted(template_layers, key=lambda item: int(item.get("z_index", 0)))
    portrait_z_index = int(photo_slot.get("portrait_z_index", 50))
    portrait_drawn = False

    for layer in sorted_layers:
        layer_z_index = int(layer.get("z_index", 0))
        if not portrait_drawn and layer_z_index > portrait_z_index:
            _paste_portrait_into_slot(
                canvas,
                portrait_image=portrait_image,
                photo_slot=photo_slot,
                width_px=width_px,
                height_px=height_px,
                photo_offset_x=photo_offset_x,
                photo_offset_y=photo_offset_y,
                photo_scale=photo_scale,
                photo_rotation=photo_rotation,
            )
            portrait_drawn = True
        layer_image = _open_template_layer(layer.get("file_path"), (width_px, height_px))
        if layer_image is not None:
            canvas.alpha_composite(layer_image)

    if not portrait_drawn:
        _paste_portrait_into_slot(
            canvas,
            portrait_image=portrait_image,
            photo_slot=photo_slot,
            width_px=width_px,
            height_px=height_px,
            photo_offset_x=photo_offset_x,
            photo_offset_y=photo_offset_y,
            photo_scale=photo_scale,
            photo_rotation=photo_rotation,
        )

    draw = ImageDraw.Draw(canvas)
    _draw_template_text_slots(
        draw,
        text_slots=text_slots,
        values=_build_layer_text_values(
            name=name,
            birth_date_text=birth_date_text,
            height_text=height_text,
            weight_text=weight_text,
            city_or_team=city_or_team,
        ),
        width_px=width_px,
        height_px=height_px,
    )
    return canvas.convert("RGB")


def _fit_cover(image: Image.Image, target_size: tuple[int, int]) -> Image.Image:
    target_width, target_height = target_size
    if target_width <= 0 or target_height <= 0:
        raise ValueError("Tamanho de destino invalido para a imagem.")
    source = image.copy().convert("RGB")
    source_ratio = source.width / source.height if source.height else 1
    target_ratio = target_width / target_height

    if source_ratio > target_ratio:
        scaled_height = target_height
        scaled_width = int(round(target_height * source_ratio))
    else:
        scaled_width = target_width
        scaled_height = int(round(target_width / source_ratio))

    resized = source.resize((scaled_width, scaled_height), Image.Resampling.LANCZOS)
    left = max((scaled_width - target_width) // 2, 0)
    top = max((scaled_height - target_height) // 2, 0)
    return resized.crop((left, top, left + target_width, top + target_height))


def _fit_cover_rgba(image: Image.Image, target_size: tuple[int, int]) -> Image.Image:
    target_width, target_height = target_size
    source = image.copy().convert("RGBA")
    source_ratio = source.width / source.height if source.height else 1
    target_ratio = target_width / target_height

    if source_ratio > target_ratio:
        scaled_height = target_height
        scaled_width = int(round(target_height * source_ratio))
    else:
        scaled_width = target_width
        scaled_height = int(round(target_width / source_ratio))

    resized = source.resize((scaled_width, scaled_height), Image.Resampling.LANCZOS)
    left = max((scaled_width - target_width) // 2, 0)
    top = max((scaled_height - target_height) // 2, 0)
    return resized.crop((left, top, left + target_width, top + target_height))


def _fit_contain_rgba(image: Image.Image, target_size: tuple[int, int], *, scale: float = 1.0) -> Image.Image:
    target_width, target_height = target_size
    source = image.copy().convert("RGBA")
    ratio = min(target_width / max(source.width, 1), target_height / max(source.height, 1))
    ratio = max(ratio * scale, 0.01)
    resized_width = max(1, int(round(source.width * ratio)))
    resized_height = max(1, int(round(source.height * ratio)))
    return source.resize((resized_width, resized_height), Image.Resampling.LANCZOS)


def _open_template_layer(file_path: str | None, target_size: tuple[int, int]) -> Image.Image | None:
    if not file_path:
        return None
    absolute_path = Path(file_path)
    if not absolute_path.exists():
        return None
    with Image.open(absolute_path) as raw_image:
        return _fit_cover_rgba(ImageOps.exif_transpose(raw_image).convert("RGBA"), target_size)


def _paste_portrait_into_slot(
    canvas: Image.Image,
    *,
    portrait_image: Image.Image,
    photo_slot: dict,
    width_px: int,
    height_px: int,
    photo_offset_x: float | None = None,
    photo_offset_y: float | None = None,
    photo_scale: float | None = None,
    photo_rotation: float | None = None,
) -> None:
    slot_x = int(float(photo_slot.get("x", 0)) * width_px)
    slot_y = int(float(photo_slot.get("y", 0)) * height_px)
    slot_width = max(1, int(float(photo_slot.get("width", 1)) * width_px))
    slot_height = max(1, int(float(photo_slot.get("height", 1)) * height_px))
    base_scale = float(photo_slot.get("default_scale", 1))
    min_scale = float(photo_slot.get("min_scale", 0.1))
    max_scale = float(photo_slot.get("max_scale", 8))
    requested_scale = float(photo_scale if photo_scale is not None else base_scale)
    scale = max(min_scale, min(max_scale, requested_scale))
    anchor_x = float(photo_slot.get("anchor_x", 0.5))
    anchor_y = float(photo_slot.get("anchor_y", 0.5))
    visible_x = min(max(float(photo_slot.get("visible_x", 0)), 0), 1)
    visible_y = min(max(float(photo_slot.get("visible_y", 0)), 0), 1)
    visible_width = min(max(float(photo_slot.get("visible_width", 1)), 0.01), 1)
    visible_height = min(max(float(photo_slot.get("visible_height", 0.9)), 0.01), 1)
    offset_x = float(photo_offset_x or 0)
    offset_y = float(photo_offset_y or 0)
    rotation = float(photo_rotation or 0)

    visible_left = slot_x + int(round(slot_width * visible_x))
    visible_top = slot_y + int(round(slot_height * visible_y))
    visible_right = slot_x + int(round(slot_width * min(visible_x + visible_width, 1)))
    visible_bottom = slot_y + int(round(slot_height * min(visible_y + visible_height, 1)))
    visible_right = max(visible_right, visible_left + 1)
    visible_bottom = max(visible_bottom, visible_top + 1)
    visible_width_px = max(1, visible_right - visible_left)
    visible_height_px = max(1, visible_bottom - visible_top)

    fitted = _fit_contain_rgba(portrait_image, (visible_width_px, visible_height_px), scale=scale)
    if abs(rotation) > 0.01:
        fitted = fitted.rotate(rotation, resample=Image.Resampling.BICUBIC, expand=True)
    paste_x = visible_left + int((visible_width_px - fitted.width) * anchor_x) + int(round(offset_x * visible_width_px))
    paste_y = visible_top + int((visible_height_px - fitted.height) * anchor_y) + int(round(offset_y * visible_height_px))

    portrait_layer = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    portrait_layer.alpha_composite(fitted, (paste_x, paste_y))

    visibility_mask = Image.new("L", canvas.size, 0)
    ImageDraw.Draw(visibility_mask).rectangle((visible_left, visible_top, visible_right, visible_bottom), fill=255)
    portrait_alpha = portrait_layer.getchannel("A")
    portrait_layer.putalpha(ImageChops.multiply(portrait_alpha, visibility_mask))
    canvas.alpha_composite(portrait_layer)


def _resize_to_exact(image: Image.Image, target_size: tuple[int, int]) -> Image.Image:
    return image.copy().convert("RGB").resize(target_size, Image.Resampling.LANCZOS)


def _vertical_gradient(size: tuple[int, int], start_hex: str, end_hex: str) -> Image.Image:
    width, height = size
    start = tuple(int(start_hex[i : i + 2], 16) for i in (1, 3, 5))
    end = tuple(int(end_hex[i : i + 2], 16) for i in (1, 3, 5))
    image = Image.new("RGB", size, start)
    draw = ImageDraw.Draw(image)
    for y in range(height):
        blend = y / max(height - 1, 1)
        color = tuple(int(start[index] + (end[index] - start[index]) * blend) for index in range(3))
        draw.line((0, y, width, y), fill=color)
    return image


def _load_font(size: int, *, bold: bool) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    for font_path in CUSTOM_FONT_SEARCH[bold]:
        try:
            if font_path.exists():
                return ImageFont.truetype(str(font_path), size=size)
        except OSError:
            continue
    return ImageFont.load_default()


def _draw_text_with_shadow(
    draw: ImageDraw.ImageDraw,
    position: tuple[int, int],
    text: str,
    *,
    font: ImageFont.FreeTypeFont | ImageFont.ImageFont,
    fill,
    shadow_fill,
    shadow_offset: tuple[int, int] = (0, 2),
) -> None:
    draw.text((position[0] + shadow_offset[0], position[1] + shadow_offset[1]), text, fill=shadow_fill, font=font)
    draw.text(position, text, fill=fill, font=font)


def _draw_template_text_slots(
    draw: ImageDraw.ImageDraw,
    *,
    text_slots: list[dict],
    values: dict[str, str],
    width_px: int,
    height_px: int,
) -> None:
    for slot in text_slots:
        field_name = slot.get("field_name")
        text_value = values.get(field_name or "", "--")
        if not text_value:
            continue

        x = int(float(slot.get("x", 0)) * width_px)
        y = int(float(slot.get("y", 0)) * height_px)
        max_width = max(1, int(float(slot.get("width", 0.2)) * width_px))
        font_size = max(8, int(float(slot.get("font_size", 12))))
        font_weight = (slot.get("font_weight") or "").strip().lower()
        color = (slot.get("color") or "#ffffff").strip() or "#ffffff"
        align = (slot.get("text_align") or "left").strip().lower()
        font = _load_font(font_size, bold=font_weight in {"600", "700", "800", "900", "bold", "semibold"})
        text = _truncate_to_width(text_value, font, max_width)
        bbox = draw.textbbox((0, 0), text, font=font)
        text_width = bbox[2] - bbox[0]
        draw_x = x
        if align == "center":
            draw_x = x + max((max_width - text_width) // 2, 0)
        elif align == "right":
            draw_x = x + max(max_width - text_width, 0)

        _draw_text_with_shadow(
            draw,
            (draw_x, y),
            text,
            font=font,
            fill=color,
            shadow_fill=(0, 0, 0, 160),
            shadow_offset=(0, max(height_px // 500, 1)),
        )


def _build_layer_text_values(
    *,
    name: str,
    birth_date_text: str | None,
    height_text: str | None,
    weight_text: str | None,
    city_or_team: str | None,
) -> dict[str, str]:
    date_value = (birth_date_text or "--").strip() or "--"
    height_value = (height_text or "--").strip() or "--"
    weight_value = (weight_text or "--").strip() or "--"
    city_value = (city_or_team or "--").strip() or "--"

    return {
        "NAME": (name or "NOME").strip().upper(),
        "DATE": f"{date_value} |",
        "HEIGHT": f"{height_value} |",
        "WEIGHT": weight_value,
        "CITY_OR_TEAM": city_value.upper(),
    }


def _truncate_to_width(text: str, font: ImageFont.FreeTypeFont | ImageFont.ImageFont, max_width: int) -> str:
    bbox = font.getbbox(text)
    if bbox[2] - bbox[0] <= max_width:
        return text
    trimmed = text
    while trimmed:
        candidate = f"{trimmed}..."
        bbox = font.getbbox(candidate)
        if bbox[2] - bbox[0] <= max_width:
            return candidate
        trimmed = trimmed[:-1]
    return text
