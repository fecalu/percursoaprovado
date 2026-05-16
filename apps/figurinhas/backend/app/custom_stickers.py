from __future__ import annotations

import io
from dataclasses import dataclass
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageOps

try:
    from google import genai
    from google.genai import types as genai_types
except ImportError:  # pragma: no cover - handled by fallback generation
    genai = None  # type: ignore[assignment]
    genai_types = None  # type: ignore[assignment]


PROFILE_LABELS = {
    "HOMEM": "Homem",
    "MULHER": "Mulher",
    "MENINO": "Menino",
    "MENINA": "Menina",
}

PROFILE_THEMES = {
    "HOMEM": ("#0f2748", "#1f7a4d", "#cde7d7"),
    "MULHER": ("#5b1f55", "#d54f8a", "#f5c5da"),
    "MENINO": ("#134f7c", "#22a2d6", "#cceaf6"),
    "MENINA": ("#7c2c49", "#ff7fa9", "#ffd8e6"),
}

DEFAULT_CUSTOM_STICKER_PROMPT_TEMPLATE = (
    "Use the first image as the real photo reference for {name}, a {profile_label_lower}. "
    "{base_hint}Preserve the person's real facial features, skin tone, hair, smile and identity. "
    "The final result must look like one single authentic collectible football sticker, never like a pasted portrait, cutout or collage. "
    "{details_hint}{city_hint}Do not redesign the base, do not remove borders, do not alter the official shirt, do not add extra people, extra hands, duplicated features, random logos, watermarks or collage artifacts. "
    "Return one complete finished sticker image only."
)


@dataclass
class CustomStickerRender:
    portrait_bytes: bytes
    final_bytes: bytes


class _SafePromptValues(dict):
    def __missing__(self, key):  # pragma: no cover - defensive fallback
        return ""


def generate_custom_sticker_render(
    settings,
    *,
    uploaded_photo_bytes: bytes,
    base_template_path: Path | None = None,
    prompt_template: str | None = None,
    name: str,
    profile_type: str,
    birth_date_text: str | None,
    height_text: str | None,
    weight_text: str | None,
    city_or_team: str | None,
    target_width_px: int,
    target_height_px: int,
) -> CustomStickerRender:
    uploaded_photo = _open_uploaded_photo(uploaded_photo_bytes)
    base_template = _open_base_template(base_template_path, target_size=(target_width_px, target_height_px))
    gemini_sticker_image = None
    if base_template is not None and settings.gemini_api_key and genai is not None and genai_types is not None:
        try:
            gemini_sticker_image = _generate_sticker_with_gemini(
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
            )
        except Exception as exc:
            raise ValueError(_humanize_gemini_error(exc)) from exc
        if gemini_sticker_image is None:
            raise ValueError("Nao foi possivel gerar a figurinha com IA usando a base selecionada. Tente novamente.")

    if gemini_sticker_image is not None:
        final_image = _resize_to_exact(gemini_sticker_image, (target_width_px, target_height_px))
        portrait_image = final_image
    else:
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


def _generate_sticker_with_gemini(
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
) -> Image.Image | None:
    working_image = uploaded_photo.copy()
    working_image.thumbnail((1536, 1536))
    base_reference = base_template.copy().convert("RGB")
    base_reference.thumbnail((1536, 1536))
    client = genai.Client(api_key=settings.gemini_api_key)
    prompt = _build_gemini_prompt(
        prompt_template=prompt_template,
        name=name,
        profile_type=profile_type,
        birth_date_text=birth_date_text,
        height_text=height_text,
        weight_text=weight_text,
        city_or_team=city_or_team,
        has_base_template=True,
    )
    response = client.models.generate_content(
        model=settings.gemini_image_model,
        contents=[prompt, working_image, base_reference],
        config=genai_types.GenerateContentConfig(
            response_modalities=["TEXT", "IMAGE"],
        ),
    )
    for part in _iter_gemini_response_parts(response):
        if getattr(part, "inline_data", None) is not None:
            image = part.as_image()
            return image.convert("RGB")
    return None


def _humanize_gemini_error(exc: Exception) -> str:
    message = str(exc)
    normalized = message.lower()
    if "resource_exhausted" in normalized or "quota" in normalized or "429" in normalized:
        return "A chave Gemini configurada esta sem cota para gerar imagens agora. Verifique o plano ou use outra chave."
    if "api key" in normalized or "invalid" in normalized or "permission" in normalized:
        return "A chave Gemini configurada nao conseguiu autorizar a geracao dessa figurinha."
    if "deadline" in normalized or "timed out" in normalized or "timeout" in normalized:
        return "A Gemini demorou demais para responder. Tente novamente em instantes."
    if "safety" in normalized or "blocked" in normalized:
        return "A Gemini bloqueou essa geracao por politica de seguranca. Tente outra foto."
    if message.strip():
        return f"Nao foi possivel gerar a figurinha com IA: {message}"
    return "Nao foi possivel gerar a figurinha com IA usando a base selecionada. Tente novamente."


def _iter_gemini_response_parts(response) -> list:
    parts = getattr(response, "parts", None)
    if parts:
        return list(parts)

    candidates = getattr(response, "candidates", None) or []
    if not candidates:
        return []

    content = getattr(candidates[0], "content", None)
    if content is None:
        return []
    return list(getattr(content, "parts", None) or [])


def _build_gemini_prompt(
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
        " Use the second image as the official finished sticker base. Keep the same frame, shirt, background, layout, "
        "colors, badges, shadows and collectible card design, and replace only the person in that sticker with the "
        "real person from the first image."
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
    font_names = (
        ("DejaVuSans-Bold.ttf", "DejaVuSans.ttf")
        if bold
        else ("DejaVuSans.ttf", "DejaVuSans-Bold.ttf")
    )
    for font_name in font_names:
        try:
            return ImageFont.truetype(font_name, size=size)
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
