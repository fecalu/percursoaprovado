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


class Collection(Base):
    __tablename__ = "figurinhas_collections"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    slug: Mapped[str] = mapped_column(String(150), unique=True, nullable=False, index=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[CollectionStatus] = mapped_column(
        Enum(CollectionStatus), default=CollectionStatus.RASCUNHO, nullable=False
    )
    source_pdf_path: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    pages: Mapped[list["Page"]] = relationship(
        back_populates="collection", cascade="all, delete-orphan", order_by="Page.page_number"
    )
    stickers: Mapped[list["Sticker"]] = relationship(
        back_populates="collection", cascade="all, delete-orphan", order_by="Sticker.sort_order"
    )
    exports: Mapped[list["Export"]] = relationship(
        back_populates="collection", cascade="all, delete-orphan", order_by="Export.created_at.desc()"
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


class Export(Base):
    __tablename__ = "figurinhas_exports"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    collection_id: Mapped[int] = mapped_column(ForeignKey("figurinhas_collections.id"), nullable=False, index=True)
    file_path: Mapped[str] = mapped_column(String(255), nullable=False)
    item_count: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    collection: Mapped[Collection] = relationship(back_populates="exports")
