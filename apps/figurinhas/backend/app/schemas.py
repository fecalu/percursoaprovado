from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any

from pydantic import BaseModel, Field, field_validator

from .models import (
    CollectionStatus,
    CustomCategoryType,
    CustomProfileType,
    CustomPositionType,
    CustomTemplateCompositionMode,
    CustomTemplateLayerType,
    CustomTemplateTextField,
    CustomStickerUnlockType,
    PrintOrderStatus,
    PrintServiceType,
    SourceDetectedStickerStatus,
    SourceDocumentStatus,
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


class PageSelectionBlockResponse(BaseModel):
    id: int
    page_id: int
    collection_id: int | None
    collection_name: str | None = None
    label: str | None
    x: float
    y: float
    width: float
    height: float
    sort_order: int
    created_at: datetime
    updated_at: datetime


class PageSelectionBlockCreate(BaseModel):
    collection_id: int = Field(ge=1)
    label: str | None = Field(default=None, max_length=150)
    x: float = Field(ge=0, lt=1)
    y: float = Field(ge=0, lt=1)
    width: float = Field(gt=0, le=1)
    height: float = Field(gt=0, le=1)
    sort_order: int = Field(default=0, ge=0, le=9999)


class PageSelectionBlockUpdate(BaseModel):
    collection_id: int = Field(ge=1)
    label: str | None = Field(default=None, max_length=150)
    x: float = Field(ge=0, lt=1)
    y: float = Field(ge=0, lt=1)
    width: float = Field(gt=0, le=1)
    height: float = Field(gt=0, le=1)
    sort_order: int = Field(default=0, ge=0, le=9999)


class SourceDocumentPageResponse(BaseModel):
    id: int
    document_id: int
    page_number: int
    image_path: str
    width: int
    height: int
    detected_count: int = 0
    pending_detected_count: int = 0
    assigned_detected_count: int = 0
    discarded_detected_count: int = 0
    blocks: list[PageSelectionBlockResponse] = []


class SourceDocumentSummaryResponse(BaseModel):
    id: int
    album_id: int
    album_name: str | None = None
    album_slug: str | None = None
    title: str
    pdf_path: str
    page_count: int
    status: SourceDocumentStatus
    block_count: int = 0
    detected_count: int = 0
    pending_detected_count: int = 0
    assigned_detected_count: int = 0
    discarded_detected_count: int = 0
    created_at: datetime
    updated_at: datetime


class SourceDocumentDetailResponse(SourceDocumentSummaryResponse):
    pages: list[SourceDocumentPageResponse] = []


class SourceDetectedStickerResponse(BaseModel):
    id: int
    document_id: int
    page_id: int
    assigned_collection_id: int | None = None
    assigned_collection_name: str | None = None
    status: SourceDetectedStickerStatus
    category: StickerCategory
    x_ratio: float
    y_ratio: float
    width_ratio: float
    height_ratio: float
    preview_path: str
    crop_path: str
    ocr_name_raw: str | None = None
    ocr_name_suggested: str | None = None
    ocr_confidence: float | None = None
    ocr_processed_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


class SourceDetectedStickerAssignRequest(BaseModel):
    collection_id: int = Field(ge=1)
    detected_sticker_ids: list[int] = Field(min_length=1)


class SourceDetectedStickerBulkActionRequest(BaseModel):
    detected_sticker_ids: list[int] = Field(min_length=1)


class SourceDetectedStickerBulkActionResponse(BaseModel):
    document_id: int
    affected_count: int
    collection_id: int | None = None
    collection_name: str | None = None


class PageLayoutTemplateBlockResponse(BaseModel):
    id: int
    template_id: int
    collection_id: int | None
    collection_name: str | None = None
    label: str | None
    x: float
    y: float
    width: float
    height: float
    sort_order: int
    created_at: datetime
    updated_at: datetime


class PageLayoutTemplateCreate(BaseModel):
    name: str = Field(min_length=2, max_length=150)


class PageLayoutTemplateResponse(BaseModel):
    id: int
    album_id: int
    album_name: str | None = None
    name: str
    block_count: int = 0
    created_at: datetime
    updated_at: datetime
    blocks: list[PageLayoutTemplateBlockResponse] = []


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
    template_id: int | None
    source_document_id: int | None
    source_document_page_id: int | None
    source_block_id: int | None
    name: str
    code: str | None
    category: StickerCategory
    source_type: StickerSourceType
    profile_type: CustomProfileType | None
    custom_category_type: CustomCategoryType | None
    custom_position_type: CustomPositionType | None
    composition_mode_used: CustomTemplateCompositionMode | None
    birth_date_text: str | None
    height_text: str | None
    weight_text: str | None
    city_or_team: str | None
    photo_offset_x: float | None
    photo_offset_y: float | None
    photo_scale: float | None
    photo_rotation: float | None
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


class CustomTemplateLayerInput(BaseModel):
    layer_type: CustomTemplateLayerType
    label: str = Field(min_length=1, max_length=120)
    file_path: str | None = Field(default=None, max_length=255)
    z_index: int = Field(default=0, ge=0, le=999)
    is_active: bool = True


class CustomTemplatePhotoSlotInput(BaseModel):
    x: float = Field(default=0, ge=0, le=1)
    y: float = Field(default=0, ge=0, le=1)
    width: float = Field(default=1, gt=0, le=1)
    height: float = Field(default=1, gt=0, le=1)
    default_scale: float = Field(default=1, gt=0, le=5)
    min_scale: float = Field(default=0.7, gt=0, le=5)
    max_scale: float = Field(default=1.5, gt=0, le=8)
    portrait_z_index: int = Field(default=30, ge=-999, le=999)
    anchor_x: float = Field(default=0.5, ge=0, le=1)
    anchor_y: float = Field(default=0.5, ge=0, le=1)
    visible_x: float = Field(default=0, ge=0, le=1)
    visible_y: float = Field(default=0, ge=0, le=1)
    visible_width: float = Field(default=1, gt=0, le=1)
    visible_height: float = Field(default=0.9, gt=0, le=1)


class CustomTemplateTextSlotInput(BaseModel):
    field_name: CustomTemplateTextField
    x: float = Field(default=0, ge=0, le=1)
    y: float = Field(default=0, ge=0, le=1)
    width: float = Field(default=0, ge=0, le=1)
    font_size: float = Field(default=12, gt=0, le=200)
    font_weight: str | None = Field(default=None, max_length=40)
    text_align: str | None = Field(default=None, max_length=20)
    color: str | None = Field(default=None, max_length=20)


class CustomTemplateBase(BaseModel):
    album_id: int = Field(ge=1)
    name: str = Field(min_length=2, max_length=150)
    profile_type: CustomProfileType
    category_type: CustomCategoryType = CustomCategoryType.JOGADOR
    position_type: CustomPositionType
    composition_mode: CustomTemplateCompositionMode = CustomTemplateCompositionMode.LAYERS
    sort_order: int = Field(default=0, ge=0, le=9999)
    is_active: bool = True
    layers: list[CustomTemplateLayerInput] = Field(default_factory=list)
    photo_slot: CustomTemplatePhotoSlotInput | None = None
    text_slots: list[CustomTemplateTextSlotInput] = Field(default_factory=list)


class CustomTemplateCreate(CustomTemplateBase):
    pass


class CustomTemplateUpdate(CustomTemplateBase):
    pass


class CustomTemplateLayerResponse(CustomTemplateLayerInput):
    id: int


class CustomTemplatePhotoSlotResponse(CustomTemplatePhotoSlotInput):
    id: int


class CustomTemplateTextSlotResponse(CustomTemplateTextSlotInput):
    id: int


class CustomTemplateReadinessCheckResponse(BaseModel):
    key: str
    label: str
    ready: bool
    detail: str | None = None


class CustomTemplateLayerInventoryResponse(BaseModel):
    layer_type: CustomTemplateLayerType
    label: str
    count: int


class CustomTemplateManualStatusResponse(BaseModel):
    ready: bool
    missing_count: int
    missing_labels: list[str] = Field(default_factory=list)
    checks: list[CustomTemplateReadinessCheckResponse] = Field(default_factory=list)
    layer_inventory: list[CustomTemplateLayerInventoryResponse] = Field(default_factory=list)


class CustomTemplateSummaryResponse(BaseModel):
    id: int
    album_id: int | None
    name: str
    profile_type: CustomProfileType
    category_type: CustomCategoryType
    position_type: CustomPositionType
    composition_mode: CustomTemplateCompositionMode
    sort_order: int
    is_active: bool
    layer_count: int
    preview_path: str | None = None
    has_photo_slot: bool
    manual_ready: bool
    manual_status: CustomTemplateManualStatusResponse
    text_slot_count: int
    created_at: datetime
    updated_at: datetime


class CustomTemplatePublicOption(BaseModel):
    id: int
    album_id: int | None
    name: str
    profile_type: CustomProfileType
    category_type: CustomCategoryType
    position_type: CustomPositionType
    composition_mode: CustomTemplateCompositionMode
    preview_path: str | None = None
    sort_order: int
    layer_count: int
    has_photo_slot: bool
    manual_ready: bool
    manual_status: CustomTemplateManualStatusResponse
    layers: list[CustomTemplateLayerResponse] = Field(default_factory=list)
    photo_slot: CustomTemplatePhotoSlotResponse | None = None
    text_slots: list[CustomTemplateTextSlotResponse] = Field(default_factory=list)


class MyStickerCutoutResponse(BaseModel):
    image_data_url: str
    portrait_image_data_url: str | None = None
    cutout_image_data_url: str | None = None
    asset_token: str | None = None


class PublicProgressJobStatus(str, Enum):
    PENDENTE = "PENDENTE"
    PROCESSANDO = "PROCESSANDO"
    CONCLUIDO = "CONCLUIDO"
    FALHOU = "FALHOU"


class PublicProgressJobResponse(BaseModel):
    job_id: str
    job_type: str
    status: PublicProgressJobStatus
    title: str
    subtitle: str | None = None
    steps: list[str] = Field(default_factory=list)
    step_index: int = 0
    progress: int = 0
    message: str | None = None
    result: dict[str, Any] | None = None
    error: str | None = None


class CustomTemplateDetailResponse(BaseModel):
    id: int
    album_id: int | None
    name: str
    profile_type: CustomProfileType
    category_type: CustomCategoryType
    position_type: CustomPositionType
    composition_mode: CustomTemplateCompositionMode
    sort_order: int
    is_active: bool
    preview_path: str | None = None
    manual_ready: bool
    manual_status: CustomTemplateManualStatusResponse
    created_at: datetime
    updated_at: datetime
    layers: list[CustomTemplateLayerResponse] = Field(default_factory=list)
    photo_slot: CustomTemplatePhotoSlotResponse | None = None
    text_slots: list[CustomTemplateTextSlotResponse] = Field(default_factory=list)


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
    custom_generation_mode: CustomTemplateCompositionMode
    custom_sticker_unlock_enabled: bool
    custom_sticker_unlock_price_cents: int
    custom_sticker_unlock_message: str | None
    custom_ai_unlock_enabled: bool
    custom_ai_unlock_price_cents: int
    custom_ai_unlock_message: str | None
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
    custom_base_crianca_path: str | None = None
    custom_base_menino_path: str | None = None
    custom_base_menina_path: str | None = None


class ServiceConfigUpdate(BaseModel):
    service_enabled: bool = False
    donation_enabled: bool = False
    custom_generation_mode: CustomTemplateCompositionMode = CustomTemplateCompositionMode.LAYERS
    custom_sticker_unlock_enabled: bool = False
    custom_sticker_unlock_price_cents: int = Field(default=500, ge=0, le=100000)
    custom_sticker_unlock_message: str | None = Field(default=None, max_length=500)
    custom_ai_unlock_enabled: bool = False
    custom_ai_unlock_price_cents: int = Field(default=500, ge=0, le=100000)
    custom_ai_unlock_message: str | None = Field(default=None, max_length=500)
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
    sticker_id: int | None
    unlock_type: CustomStickerUnlockType
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


class BlockDetectResponse(BaseModel):
    block_id: int
    page_id: int
    page_number: int
    collection_id: int
    collection_name: str
    status: str
    template: str | None
    reason: str | None
    detected_count: int
    replaced_count: int
