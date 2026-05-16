from __future__ import annotations

import base64
import io
from dataclasses import dataclass

from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageOps

try:
    from openai import OpenAI
except ImportError:  # pragma: no cover - handled by fallback generation
    OpenAI = None  # type: ignore[assignment]


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


@dataclass
class CustomStickerRender:
    portrait_bytes: bytes
    final_bytes: bytes


def generate_custom_sticker_render(
    settings,
    *,
    uploaded_photo_bytes: bytes,
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
    portrait_image = _generate_portrait_with_fallback(
        settings,
        uploaded_photo=uploaded_photo,
        name=name,
        profile_type=profile_type,
        city_or_team=city_or_team,
        target_width_px=max(int(target_width_px * 0.86), 720),
        target_height_px=max(int(target_height_px * 0.62), 960),
    )

    portrait_buffer = io.BytesIO()
    portrait_image.save(portrait_buffer, format="PNG", optimize=True)

    final_image = _compose_sticker_card(
        portrait_image,
        name=name,
        profile_type=profile_type,
        birth_date_text=birth_date_text,
        height_text=height_text,
        weight_text=weight_text,
        city_or_team=city_or_team,
        width_px=target_width_px,
        height_px=target_height_px,
    )
    final_buffer = io.BytesIO()
    final_image.save(final_buffer, format="PNG", optimize=True)
    return CustomStickerRender(
        portrait_bytes=portrait_buffer.getvalue(),
        final_bytes=final_buffer.getvalue(),
    )


def _open_uploaded_photo(uploaded_photo_bytes: bytes) -> Image.Image:
    with Image.open(io.BytesIO(uploaded_photo_bytes)) as raw_image:
        return ImageOps.exif_transpose(raw_image).convert("RGB")


def _generate_portrait_with_fallback(
    settings,
    *,
    uploaded_photo: Image.Image,
    name: str,
    profile_type: str,
    city_or_team: str | None,
    target_width_px: int,
    target_height_px: int,
) -> Image.Image:
    if settings.openai_api_key and OpenAI is not None:
        generated = _generate_portrait_with_openai(
            settings,
            uploaded_photo=uploaded_photo,
            name=name,
            profile_type=profile_type,
            city_or_team=city_or_team,
        )
        if generated is not None:
            return _fit_cover(generated, (target_width_px, target_height_px))
    return _build_stylized_fallback(uploaded_photo, profile_type, (target_width_px, target_height_px))


def _generate_portrait_with_openai(
    settings,
    *,
    uploaded_photo: Image.Image,
    name: str,
    profile_type: str,
    city_or_team: str | None,
) -> Image.Image | None:
    try:
        client = OpenAI(api_key=settings.openai_api_key)
        upload_buffer = io.BytesIO()
        working_image = uploaded_photo.copy()
        working_image.thumbnail((1536, 1536))
        working_image.save(upload_buffer, format="JPEG", quality=92, optimize=True)
        image_base64 = base64.b64encode(upload_buffer.getvalue()).decode("ascii")
        prompt = _build_openai_prompt(name=name, profile_type=profile_type, city_or_team=city_or_team)
        response = client.responses.create(
            model=settings.openai_response_model,
            input=[
                {
                    "role": "user",
                    "content": [
                        {"type": "input_text", "text": prompt},
                        {
                            "type": "input_image",
                            "image_url": f"data:image/jpeg;base64,{image_base64}",
                        },
                    ],
                }
            ],
            tools=[
                {
                    "type": "image_generation",
                    "action": "edit",
                    "input_fidelity": "high",
                }
            ],
        )
        generated_images = [
            output.result
            for output in getattr(response, "output", [])
            if getattr(output, "type", None) == "image_generation_call" and getattr(output, "result", None)
        ]
        if not generated_images:
            return None
        return _open_uploaded_photo(base64.b64decode(generated_images[0]))
    except Exception:
        return None


def _build_openai_prompt(*, name: str, profile_type: str, city_or_team: str | None) -> str:
    profile_label = PROFILE_LABELS.get(profile_type, "Pessoa")
    city_hint = f" The background can subtly reference {city_or_team}." if city_or_team else ""
    return (
        f"Using the uploaded face as the main reference, create a polished collectible football sticker portrait of a "
        f"{profile_label.lower()} named {name}. Keep strong facial resemblance, clean sportswear, confident pose, "
        f"waist-up framing, premium lighting, and a friendly editorial sports look. Do not add any text, frame, "
        f"logo, watermark, hands covering the face, extra people, or duplicated limbs.{city_hint}"
    )


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
