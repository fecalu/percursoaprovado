from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field, field_validator

from .models import (
    CollectionStatus,
    CustomProfileType,
    PrintOrderStatus,
    PrintServiceType,
    StickerCategory,
    StickerSourceType,
)


class AlbumCreate(BaseModel):
    name: str = Field(min_length=2, max_length=150)
    slug: str = Field(min_length=2, max_length=150)
    description: str | None = Field(default=None, max_length=500)
    sort_order: int = Field(default=0, ge=0, le=9999)


class AlbumUpdate(BaseModel):
    name: str = Field(min_length=2, max_length=150)
    slug: str = Field(min_length=2, max_length=150)
    description: str | None = Field(default=None, max_length=500)
    sort_order: int = Field(default=0, ge=0, le=9999)


class CollectionSummaryResponse(BaseModel):
    id: int
    album_id: int | None
    name: str
    slug: str
    description: str | None
    sort_order: int
    status: CollectionStatus
    sticker_count: int
    page_count: int


class AlbumResponse(BaseModel):
    id: int
    name: str
    slug: str
    description: str | None
    sort_order: int
    created_at: datetime
    updated_at: datetime
    collection_count: int
    published_collection_count: int
    collections: list[CollectionSummaryResponse] = []


class CollectionCreate(BaseModel):
    album_id: int = Field(ge=1)
    name: str = Field(min_length=2, max_length=150)
    slug: str = Field(min_length=2, max_length=150)
    description: str | None = Field(default=None, max_length=500)
    sort_order: int = Field(default=0, ge=0, le=9999)


class CollectionUpdate(BaseModel):
    name: str = Field(min_length=2, max_length=150)
    slug: str = Field(min_length=2, max_length=150)
    description: str | None = Field(default=None, max_length=500)
    sort_order: int = Field(default=0, ge=0, le=9999)


class CollectionAlbumAssign(BaseModel):
    album_id: int = Field(ge=1)


class CollectionResponse(BaseModel):
    id: int
    album_id: int | None
    album_name: str | None
    album_slug: str | None
    name: str
    slug: str
    description: str | None
    sort_order: int
    status: CollectionStatus
    source_pdf_path: str | None
    created_at: datetime
    updated_at: datetime
    sticker_count: int
    page_count: int

    model_config = {"from_attributes": True}


class PageResponse(BaseModel):
    id: int
    page_number: int
    image_path: str
    width: int
    height: int

    model_config = {"from_attributes": True}


class StickerBase(BaseModel):
    collection_id: int
    page_id: int
    name: str = Field(min_length=1, max_length=150)
    code: str | None = Field(default=None, max_length=80)
    category: StickerCategory = StickerCategory.JOGADOR
    sort_order: int = Field(default=0, ge=0, le=9999)
    x_ratio: float = Field(gt=0, lt=1)
    y_ratio: float = Field(gt=0, lt=1)
    width_ratio: float = Field(gt=0, le=1)
    height_ratio: float = Field(gt=0, le=1)
    active: bool = True

    @field_validator("width_ratio")
    @classmethod
    def width_within_bounds(cls, value: float) -> float:
        return round(value, 6)

    @field_validator("height_ratio", "x_ratio", "y_ratio")
    @classmethod
    def normalize_ratio(cls, value: float) -> float:
        return round(value, 6)


class StickerCreate(StickerBase):
    pass


class StickerUpdate(BaseModel):
    page_id: int
    name: str = Field(min_length=1, max_length=150)
    code: str | None = Field(default=None, max_length=80)
    category: StickerCategory = StickerCategory.JOGADOR
    sort_order: int = Field(default=0, ge=0, le=9999)
    x_ratio: float = Field(gt=0, lt=1)
    y_ratio: float = Field(gt=0, lt=1)
    width_ratio: float = Field(gt=0, le=1)
    height_ratio: float = Field(gt=0, le=1)
    active: bool = True


class StickerResponse(BaseModel):
    id: int
    collection_id: int
    page_id: int
    name: str
    code: str | None
    category: StickerCategory
    source_type: StickerSourceType
    profile_type: CustomProfileType | None
    birth_date_text: str | None
    height_text: str | None
    weight_text: str | None
    city_or_team: str | None
    sort_order: int
    x_ratio: float
    y_ratio: float
    width_ratio: float
    height_ratio: float
    preview_path: str
    crop_path: str
    active: bool
    detected_automatically: bool
    ocr_name_raw: str | None
    ocr_name_suggested: str | None
    ocr_confidence: float | None
    ocr_processed_at: datetime | None
    created_at: datetime
    updated_at: datetime
    page_number: int


class PublishCollectionRequest(BaseModel):
    status: CollectionStatus


class AdminLoginRequest(BaseModel):
    password: str = Field(min_length=1)


class ExportRequest(BaseModel):
    album_slug: str
    sticker_ids: list[int] = Field(min_length=1)
    session_token: str | None = Field(default=None, max_length=120)


class ExportResponse(BaseModel):
    export_id: int
    item_count: int
    download_path: str
    file_name: str


class ServiceConfigResponse(BaseModel):
    service_enabled: bool
    donation_enabled: bool
    custom_sticker_unlock_enabled: bool
    custom_sticker_unlock_price_cents: int
    custom_sticker_unlock_message: str | None
    pack_size: int
    print_price_cents: int
    pack_price_cents: int
    pix_key: str | None
    pix_holder: str | None
    donation_message: str | None
    pickup_note: str | None
    custom_prompt_template: str | None = None
    custom_base_homem_path: str | None = None
    custom_base_mulher_path: str | None = None
    custom_base_menino_path: str | None = None
    custom_base_menina_path: str | None = None


class ServiceConfigUpdate(BaseModel):
    service_enabled: bool = False
    donation_enabled: bool = False
    custom_sticker_unlock_enabled: bool = False
    custom_sticker_unlock_price_cents: int = Field(default=500, ge=0, le=100000)
    custom_sticker_unlock_message: str | None = Field(default=None, max_length=500)
    pack_size: int = Field(default=7, ge=1, le=100)
    print_price_cents: int = Field(default=0, ge=0, le=100000)
    pack_price_cents: int = Field(default=0, ge=0, le=100000)
    pix_key: str | None = Field(default=None, max_length=255)
    pix_holder: str | None = Field(default=None, max_length=150)
    donation_message: str | None = Field(default=None, max_length=500)
    pickup_note: str | None = Field(default=None, max_length=500)
    custom_prompt_template: str | None = Field(default=None, max_length=3000)


class OrderQuoteRequest(BaseModel):
    album_slug: str
    sticker_ids: list[int] = Field(min_length=1)
    session_token: str | None = Field(default=None, max_length=120)


class OrderQuoteResponse(BaseModel):
    service_enabled: bool
    item_count: int
    sheet_count: int
    pack_size: int
    print_price_cents: int
    pack_price_cents: int
    print_total_cents: int
    pack_count: int
    pack_total_cents: int | None
    pack_eligible: bool
    pack_remainder: int
    pix_key: str | None
    pix_holder: str | None
    pickup_note: str | None


class PrintOrderCreate(BaseModel):
    album_slug: str
    sticker_ids: list[int] = Field(min_length=1)
    session_token: str | None = Field(default=None, max_length=120)
    service_type: PrintServiceType
    customer_name: str = Field(min_length=2, max_length=150)
    customer_whatsapp: str = Field(min_length=8, max_length=40)
    customer_nickname: str | None = Field(default=None, max_length=120)
    notes: str | None = Field(default=None, max_length=500)


class PrintOrderStickerSummary(BaseModel):
    id: int
    collection_name: str
    name: str
    category: StickerCategory
    page_number: int


class PrintOrderResponse(BaseModel):
    id: int
    reference_code: str
    album_id: int | None
    album_name: str | None
    collection_id: int
    collection_name: str
    customer_name: str
    customer_whatsapp: str
    customer_nickname: str | None
    notes: str | None
    admin_notes: str | None
    service_type: PrintServiceType
    status: PrintOrderStatus
    item_count: int
    sheet_count: int
    pack_count: int
    pack_size: int
    print_price_cents: int
    pack_price_cents: int
    total_price_cents: int
    export_download_path: str
    selected_stickers: list[PrintOrderStickerSummary]
    created_at: datetime
    updated_at: datetime
    pix_key: str | None = None
    pix_holder: str | None = None
    pickup_note: str | None = None


class PrintOrderUpdate(BaseModel):
    status: PrintOrderStatus
    admin_notes: str | None = Field(default=None, max_length=1000)


class CustomStickerUnlockRequest(BaseModel):
    session_token: str = Field(min_length=12, max_length=120)


class CustomStickerUnlockResponse(BaseModel):
    id: int
    album_id: int
    sticker_id: int
    status: str
    amount_cents: int
    payment_required: bool
    qr_code_base64: str | None = None
    qr_code: str | None = None
    ticket_url: str | None = None
    expires_at: datetime | None = None
    paid_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


class AutoDetectPageResponse(BaseModel):
    page_id: int
    page_number: int
    status: str
    template: str | None
    reason: str | None
    detected_count: int
    replaced_count: int


class AutoDetectResponse(BaseModel):
    detected_count: int
    replaced_count: int
    page_results: list[AutoDetectPageResponse]
