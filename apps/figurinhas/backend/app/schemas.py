from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field, field_validator

from .models import CollectionStatus, StickerCategory


class CollectionCreate(BaseModel):
    name: str = Field(min_length=2, max_length=150)
    slug: str = Field(min_length=2, max_length=150)
    description: str | None = Field(default=None, max_length=500)


class CollectionResponse(BaseModel):
    id: int
    name: str
    slug: str
    description: str | None
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
    sort_order: int
    x_ratio: float
    y_ratio: float
    width_ratio: float
    height_ratio: float
    preview_path: str
    crop_path: str
    active: bool
    created_at: datetime
    updated_at: datetime
    page_number: int


class PublishCollectionRequest(BaseModel):
    status: CollectionStatus


class AdminLoginRequest(BaseModel):
    password: str = Field(min_length=1)


class ExportRequest(BaseModel):
    collection_slug: str
    sticker_ids: list[int] = Field(min_length=1)


class ExportResponse(BaseModel):
    export_id: int
    item_count: int
    download_path: str
    file_name: str


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
