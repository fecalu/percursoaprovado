from __future__ import annotations

import enum
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


class CollectionStatus(str, enum.Enum):
    RASCUNHO = "RASCUNHO"
    PUBLICADA = "PUBLICADA"


class StickerCategory(str, enum.Enum):
    JOGADOR = "JOGADOR"
    GOLEIRO = "GOLEIRO"
    DEFESA = "DEFESA"
    MEIO = "MEIO"
    ATAQUE = "ATAQUE"
    COMISSAO = "COMISSAO"
    ESCUDO = "ESCUDO"
    ESPECIAL = "ESPECIAL"


class PrintServiceType(str, enum.Enum):
    IMPRESSAO = "IMPRESSAO"
    IMPRESSAO_PACOTINHOS = "IMPRESSAO_PACOTINHOS"


class PrintOrderStatus(str, enum.Enum):
    AGUARDANDO_PIX = "AGUARDANDO_PIX"
    PIX_CONFIRMADO = "PIX_CONFIRMADO"
    EM_PRODUCAO = "EM_PRODUCAO"
    PRONTO_PARA_RETIRADA = "PRONTO_PARA_RETIRADA"
    ENTREGUE = "ENTREGUE"
    CANCELADO = "CANCELADO"


class StickerSourceType(str, enum.Enum):
    PDF = "PDF"
    GENERATED = "GENERATED"


class CustomProfileType(str, enum.Enum):
    HOMEM = "HOMEM"
    MULHER = "MULHER"
    MENINO = "MENINO"
    MENINA = "MENINA"


class CustomCategoryType(str, enum.Enum):
    JOGADOR = "JOGADOR"


class CustomPositionType(str, enum.Enum):
    ATACANTE = "ATACANTE"
    MEIA = "MEIA"
    ZAGUEIRO = "ZAGUEIRO"
    GOLEIRO = "GOLEIRO"


class CustomTemplateCompositionMode(str, enum.Enum):
    LAYERS = "LAYERS"
    AI_OPTIONAL = "AI_OPTIONAL"


class CustomTemplateLayerType(str, enum.Enum):
    BACKGROUND = "BACKGROUND"
    FRAME = "FRAME"
    PHOTO_FRONT = "PHOTO_FRONT"
    INFO_PANEL = "INFO_PANEL"
    OVERLAY = "OVERLAY"
    SHINE = "SHINE"


class CustomTemplateTextField(str, enum.Enum):
    NAME = "NAME"
    DATE = "DATE"
    HEIGHT = "HEIGHT"
    WEIGHT = "WEIGHT"
    CITY_OR_TEAM = "CITY_OR_TEAM"


class CustomStickerUnlockStatus(str, enum.Enum):
    PENDENTE = "PENDENTE"
    PAGO = "PAGO"
    EXPIRADO = "EXPIRADO"
    FALHOU = "FALHOU"


class Album(Base):
    __tablename__ = "figurinhas_albums"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    slug: Mapped[str] = mapped_column(String(150), unique=True, nullable=False, index=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    collections: Mapped[list["Collection"]] = relationship(
        back_populates="album", cascade="all, delete-orphan", order_by="Collection.updated_at.desc()"
    )
    print_orders: Mapped[list["PrintOrder"]] = relationship(
        back_populates="album", order_by="PrintOrder.created_at.desc()"
    )


class Collection(Base):
    __tablename__ = "figurinhas_collections"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    album_id: Mapped[int | None] = mapped_column(ForeignKey("figurinhas_albums.id"), nullable=True, index=True)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    slug: Mapped[str] = mapped_column(String(150), unique=True, nullable=False, index=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_system: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    status: Mapped[CollectionStatus] = mapped_column(
        Enum(CollectionStatus), default=CollectionStatus.RASCUNHO, nullable=False
    )
    source_pdf_path: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    album: Mapped[Album | None] = relationship(back_populates="collections")
    pages: Mapped[list["Page"]] = relationship(
        back_populates="collection", cascade="all, delete-orphan", order_by="Page.page_number"
    )
    stickers: Mapped[list["Sticker"]] = relationship(
        back_populates="collection", cascade="all, delete-orphan", order_by="Sticker.sort_order"
    )
    exports: Mapped[list["Export"]] = relationship(
        back_populates="collection", cascade="all, delete-orphan", order_by="Export.created_at.desc()"
    )
    print_orders: Mapped[list["PrintOrder"]] = relationship(
        back_populates="collection", cascade="all, delete-orphan", order_by="PrintOrder.created_at.desc()"
    )


class Page(Base):
    __tablename__ = "figurinhas_pages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    collection_id: Mapped[int] = mapped_column(ForeignKey("figurinhas_collections.id"), nullable=False, index=True)
    page_number: Mapped[int] = mapped_column(Integer, nullable=False)
    image_path: Mapped[str] = mapped_column(String(255), nullable=False)
    width: Mapped[int] = mapped_column(Integer, nullable=False)
    height: Mapped[int] = mapped_column(Integer, nullable=False)

    collection: Mapped[Collection] = relationship(back_populates="pages")
    stickers: Mapped[list["Sticker"]] = relationship(back_populates="page")


class Sticker(Base):
    __tablename__ = "figurinhas_stickers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    collection_id: Mapped[int] = mapped_column(ForeignKey("figurinhas_collections.id"), nullable=False, index=True)
    page_id: Mapped[int] = mapped_column(ForeignKey("figurinhas_pages.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    code: Mapped[str | None] = mapped_column(String(80), nullable=True)
    category: Mapped[StickerCategory] = mapped_column(Enum(StickerCategory), default=StickerCategory.JOGADOR)
    source_type: Mapped[StickerSourceType] = mapped_column(
        Enum(StickerSourceType), default=StickerSourceType.PDF, nullable=False
    )
    template_id: Mapped[int | None] = mapped_column(
        ForeignKey("figurinhas_custom_sticker_templates.id"), nullable=True, index=True
    )
    session_token: Mapped[str | None] = mapped_column(String(120), nullable=True, index=True)
    profile_type: Mapped[CustomProfileType | None] = mapped_column(Enum(CustomProfileType), nullable=True)
    custom_category_type: Mapped[CustomCategoryType | None] = mapped_column(Enum(CustomCategoryType), nullable=True)
    custom_position_type: Mapped[CustomPositionType | None] = mapped_column(Enum(CustomPositionType), nullable=True)
    composition_mode_used: Mapped[CustomTemplateCompositionMode | None] = mapped_column(
        Enum(CustomTemplateCompositionMode), nullable=True
    )
    birth_date_text: Mapped[str | None] = mapped_column(String(40), nullable=True)
    height_text: Mapped[str | None] = mapped_column(String(40), nullable=True)
    weight_text: Mapped[str | None] = mapped_column(String(40), nullable=True)
    city_or_team: Mapped[str | None] = mapped_column(String(150), nullable=True)
    uploaded_photo_path: Mapped[str | None] = mapped_column(String(255), nullable=True)
    generated_portrait_path: Mapped[str | None] = mapped_column(String(255), nullable=True)
    photo_offset_x: Mapped[float | None] = mapped_column(Float, nullable=True)
    photo_offset_y: Mapped[float | None] = mapped_column(Float, nullable=True)
    photo_scale: Mapped[float | None] = mapped_column(Float, nullable=True)
    export_width_pt: Mapped[float | None] = mapped_column(Float, nullable=True)
    export_height_pt: Mapped[float | None] = mapped_column(Float, nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    x_ratio: Mapped[float] = mapped_column(Float, nullable=False)
    y_ratio: Mapped[float] = mapped_column(Float, nullable=False)
    width_ratio: Mapped[float] = mapped_column(Float, nullable=False)
    height_ratio: Mapped[float] = mapped_column(Float, nullable=False)
    preview_path: Mapped[str] = mapped_column(String(255), nullable=False)
    crop_path: Mapped[str] = mapped_column(String(255), nullable=False)
    active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    detected_automatically: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    ocr_name_raw: Mapped[str | None] = mapped_column(String(255), nullable=True)
    ocr_name_suggested: Mapped[str | None] = mapped_column(String(255), nullable=True)
    ocr_confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    ocr_processed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    collection: Mapped[Collection] = relationship(back_populates="stickers")
    page: Mapped[Page] = relationship(back_populates="stickers")
    template: Mapped["CustomStickerTemplate | None"] = relationship(back_populates="generated_stickers")


class CustomStickerTemplate(Base):
    __tablename__ = "figurinhas_custom_sticker_templates"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    profile_type: Mapped[CustomProfileType] = mapped_column(Enum(CustomProfileType), nullable=False, index=True)
    category_type: Mapped[CustomCategoryType] = mapped_column(
        Enum(CustomCategoryType), default=CustomCategoryType.JOGADOR, nullable=False, index=True
    )
    position_type: Mapped[CustomPositionType] = mapped_column(Enum(CustomPositionType), nullable=False, index=True)
    composition_mode: Mapped[CustomTemplateCompositionMode] = mapped_column(
        Enum(CustomTemplateCompositionMode), default=CustomTemplateCompositionMode.LAYERS, nullable=False
    )
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    layers: Mapped[list["CustomStickerTemplateLayer"]] = relationship(
        back_populates="template", cascade="all, delete-orphan", order_by="CustomStickerTemplateLayer.z_index.asc()"
    )
    photo_slot: Mapped["CustomStickerTemplatePhotoSlot | None"] = relationship(
        back_populates="template", cascade="all, delete-orphan", uselist=False
    )
    text_slots: Mapped[list["CustomStickerTemplateTextSlot"]] = relationship(
        back_populates="template", cascade="all, delete-orphan", order_by="CustomStickerTemplateTextSlot.id.asc()"
    )
    generated_stickers: Mapped[list["Sticker"]] = relationship(back_populates="template")


class CustomStickerTemplateLayer(Base):
    __tablename__ = "figurinhas_custom_sticker_template_layers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    template_id: Mapped[int] = mapped_column(
        ForeignKey("figurinhas_custom_sticker_templates.id"), nullable=False, index=True
    )
    layer_type: Mapped[CustomTemplateLayerType] = mapped_column(Enum(CustomTemplateLayerType), nullable=False)
    label: Mapped[str] = mapped_column(String(120), nullable=False)
    file_path: Mapped[str | None] = mapped_column(String(255), nullable=True)
    z_index: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    template: Mapped[CustomStickerTemplate] = relationship(back_populates="layers")


class CustomStickerTemplatePhotoSlot(Base):
    __tablename__ = "figurinhas_custom_sticker_template_photo_slots"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    template_id: Mapped[int] = mapped_column(
        ForeignKey("figurinhas_custom_sticker_templates.id"), nullable=False, unique=True, index=True
    )
    x: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    y: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    width: Mapped[float] = mapped_column(Float, default=1.0, nullable=False)
    height: Mapped[float] = mapped_column(Float, default=1.0, nullable=False)
    default_scale: Mapped[float] = mapped_column(Float, default=1.0, nullable=False)
    min_scale: Mapped[float] = mapped_column(Float, default=0.7, nullable=False)
    max_scale: Mapped[float] = mapped_column(Float, default=1.5, nullable=False)
    anchor_x: Mapped[float] = mapped_column(Float, default=0.5, nullable=False)
    anchor_y: Mapped[float] = mapped_column(Float, default=0.5, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    template: Mapped[CustomStickerTemplate] = relationship(back_populates="photo_slot")


class CustomStickerTemplateTextSlot(Base):
    __tablename__ = "figurinhas_custom_sticker_template_text_slots"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    template_id: Mapped[int] = mapped_column(
        ForeignKey("figurinhas_custom_sticker_templates.id"), nullable=False, index=True
    )
    field_name: Mapped[CustomTemplateTextField] = mapped_column(Enum(CustomTemplateTextField), nullable=False)
    x: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    y: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    width: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    font_size: Mapped[float] = mapped_column(Float, default=12.0, nullable=False)
    font_weight: Mapped[str | None] = mapped_column(String(40), nullable=True)
    text_align: Mapped[str | None] = mapped_column(String(20), nullable=True)
    color: Mapped[str | None] = mapped_column(String(20), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    template: Mapped[CustomStickerTemplate] = relationship(back_populates="text_slots")


class Export(Base):
    __tablename__ = "figurinhas_exports"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    collection_id: Mapped[int] = mapped_column(ForeignKey("figurinhas_collections.id"), nullable=False, index=True)
    file_path: Mapped[str] = mapped_column(String(255), nullable=False)
    item_count: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    collection: Mapped[Collection] = relationship(back_populates="exports")


class ServiceSettings(Base):
    __tablename__ = "figurinhas_service_settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    service_enabled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    donation_enabled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    pack_size: Mapped[int] = mapped_column(Integer, default=7, nullable=False)
    print_price_cents: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    pack_price_cents: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    pix_key: Mapped[str | None] = mapped_column(String(255), nullable=True)
    pix_holder: Mapped[str | None] = mapped_column(String(150), nullable=True)
    donation_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    pickup_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    custom_prompt_template: Mapped[str | None] = mapped_column(Text, nullable=True)
    custom_base_homem_path: Mapped[str | None] = mapped_column(String(255), nullable=True)
    custom_base_mulher_path: Mapped[str | None] = mapped_column(String(255), nullable=True)
    custom_base_menino_path: Mapped[str | None] = mapped_column(String(255), nullable=True)
    custom_base_menina_path: Mapped[str | None] = mapped_column(String(255), nullable=True)
    custom_generation_mode: Mapped[CustomTemplateCompositionMode] = mapped_column(
        Enum(CustomTemplateCompositionMode), default=CustomTemplateCompositionMode.LAYERS, nullable=False
    )
    custom_sticker_unlock_enabled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    custom_sticker_unlock_price_cents: Mapped[int] = mapped_column(Integer, default=500, nullable=False)
    custom_sticker_unlock_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )


class CustomStickerUnlock(Base):
    __tablename__ = "figurinhas_custom_sticker_unlocks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    album_id: Mapped[int] = mapped_column(ForeignKey("figurinhas_albums.id"), nullable=False, index=True)
    sticker_id: Mapped[int] = mapped_column(ForeignKey("figurinhas_stickers.id"), nullable=False, index=True)
    session_token: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
    amount_cents: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[CustomStickerUnlockStatus] = mapped_column(
        Enum(CustomStickerUnlockStatus), default=CustomStickerUnlockStatus.PENDENTE, nullable=False
    )
    mp_payment_id: Mapped[str | None] = mapped_column(String(80), nullable=True, index=True)
    mp_external_reference: Mapped[str | None] = mapped_column(String(120), nullable=True, index=True)
    mp_status: Mapped[str | None] = mapped_column(String(50), nullable=True)
    mp_status_detail: Mapped[str | None] = mapped_column(String(120), nullable=True)
    qr_code_base64: Mapped[str | None] = mapped_column(Text, nullable=True)
    qr_code: Mapped[str | None] = mapped_column(Text, nullable=True)
    ticket_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    paid_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    album: Mapped[Album] = relationship()
    sticker: Mapped[Sticker] = relationship()


class PrintOrder(Base):
    __tablename__ = "figurinhas_print_orders"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    reference_code: Mapped[str] = mapped_column(String(30), unique=True, nullable=False, index=True)
    album_id: Mapped[int | None] = mapped_column(ForeignKey("figurinhas_albums.id"), nullable=True, index=True)
    album_name: Mapped[str | None] = mapped_column(String(150), nullable=True)
    collection_id: Mapped[int] = mapped_column(ForeignKey("figurinhas_collections.id"), nullable=False, index=True)
    collection_name: Mapped[str] = mapped_column(String(150), nullable=False)
    customer_name: Mapped[str] = mapped_column(String(150), nullable=False)
    customer_whatsapp: Mapped[str] = mapped_column(String(40), nullable=False)
    customer_nickname: Mapped[str | None] = mapped_column(String(120), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    admin_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    service_type: Mapped[PrintServiceType] = mapped_column(Enum(PrintServiceType), nullable=False)
    status: Mapped[PrintOrderStatus] = mapped_column(
        Enum(PrintOrderStatus), default=PrintOrderStatus.AGUARDANDO_PIX, nullable=False
    )
    item_count: Mapped[int] = mapped_column(Integer, nullable=False)
    sheet_count: Mapped[int] = mapped_column(Integer, nullable=False)
    pack_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    pack_size: Mapped[int] = mapped_column(Integer, nullable=False)
    print_price_cents: Mapped[int] = mapped_column(Integer, nullable=False)
    pack_price_cents: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    total_price_cents: Mapped[int] = mapped_column(Integer, nullable=False)
    export_file_path: Mapped[str] = mapped_column(String(255), nullable=False)
    sticker_payload: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    album: Mapped[Album | None] = relationship(back_populates="print_orders")
    collection: Mapped[Collection] = relationship(back_populates="print_orders")
