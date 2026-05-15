from __future__ import annotations

from pathlib import Path

from fastapi import Depends, FastAPI, File, Header, HTTPException, Query, Response, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import select
from sqlalchemy.orm import Session as OrmSession
from sqlalchemy.orm import Session, selectinload

from .config import get_settings
from .database import Base, engine, get_db
from .models import (
    Collection,
    CollectionStatus,
    Page,
    PrintOrder,
    PrintOrderStatus,
    Sticker,
    StickerCategory,
)
from .schemas import (
    AdminLoginRequest,
    AutoDetectResponse,
    CollectionCreate,
    CollectionResponse,
    OrderQuoteRequest,
    OrderQuoteResponse,
    ExportRequest,
    ExportResponse,
    PageResponse,
    PrintOrderCreate,
    PrintOrderResponse,
    PrintOrderUpdate,
    PublishCollectionRequest,
    ServiceConfigResponse,
    ServiceConfigUpdate,
    StickerCreate,
    StickerResponse,
    StickerUpdate,
)
from .services import (
    auto_detect_collection_pages,
    build_export_pdf,
    build_order_quote,
    collection_stats,
    collection_to_response,
    create_print_order,
    crop_sticker_image,
    get_or_create_service_settings,
    ensure_collection_slug_unique,
    load_collection_by_slug_or_fail,
    load_collection_or_fail,
    load_print_order_or_fail,
    load_sticker_or_fail,
    page_to_response,
    print_order_to_response,
    refresh_sticker_ocr,
    save_pdf_and_render_pages,
    service_settings_to_response,
    slugify,
    sticker_to_response,
    validate_sticker_bounds,
)


settings = get_settings()

app = FastAPI(title="Figurinhas API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.mount("/files", StaticFiles(directory=str(settings.storage_root)), name="files")


def ensure_runtime_schema() -> None:
    with engine.begin() as connection:
        if connection.dialect.name != "sqlite":
            return

        table_exists = connection.exec_driver_sql(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='figurinhas_stickers'"
        ).fetchone()
        if not table_exists:
            return

        existing_columns = {
            row[1] for row in connection.exec_driver_sql("PRAGMA table_info(figurinhas_stickers)").fetchall()
        }
        required_columns = {
            "detected_automatically": "BOOLEAN NOT NULL DEFAULT 0",
            "ocr_name_raw": "VARCHAR(255)",
            "ocr_name_suggested": "VARCHAR(255)",
            "ocr_confidence": "FLOAT",
            "ocr_processed_at": "DATETIME",
        }

        for column_name, definition in required_columns.items():
            if column_name in existing_columns:
                continue
            connection.exec_driver_sql(f"ALTER TABLE figurinhas_stickers ADD COLUMN {column_name} {definition}")


@app.on_event("startup")
def startup() -> None:
    Base.metadata.create_all(bind=engine)
    ensure_runtime_schema()
    with OrmSession(engine) as db:
        get_or_create_service_settings(db)
        db.commit()


def require_admin(x_admin_token: str | None = Header(default=None, alias="X-Admin-Token")) -> None:
    if x_admin_token != settings.admin_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token administrativo invalido.")


def selected_stickers_or_400(db: Session, collection: Collection, sticker_ids: list[int]) -> list[Sticker]:
    statement = (
        select(Sticker)
        .options(selectinload(Sticker.collection), selectinload(Sticker.page))
        .where(
            Sticker.collection_id == collection.id,
            Sticker.active.is_(True),
            Sticker.id.in_(sticker_ids),
        )
        .order_by(Sticker.sort_order.asc(), Sticker.name.asc())
    )
    stickers = db.execute(statement).scalars().all()
    if not stickers:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Nenhuma figurinha valida foi selecionada.")
    return stickers


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/service-config", response_model=ServiceConfigResponse)
def get_public_service_config(db: Session = Depends(get_db)) -> dict:
    service_settings = get_or_create_service_settings(db)
    return service_settings_to_response(service_settings)


@app.post("/admin/session")
def admin_login(payload: AdminLoginRequest) -> dict[str, str]:
    if payload.password != settings.admin_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Senha invalida.")
    return {"token": payload.password}


@app.get("/collections", response_model=list[CollectionResponse])
def list_public_collections(db: Session = Depends(get_db)) -> list[dict]:
    collections = db.execute(
        select(Collection)
        .where(Collection.status == CollectionStatus.PUBLICADA)
        .order_by(Collection.updated_at.desc())
        .limit(settings.public_collection_limit)
    ).scalars().all()
    stats = collection_stats(db, [collection.id for collection in collections])
    return [collection_to_response(collection, stats.get(collection.id, {})) for collection in collections]


@app.get("/collections/{slug}", response_model=CollectionResponse)
def get_public_collection(slug: str, db: Session = Depends(get_db)) -> dict:
    collection = load_collection_by_slug_or_fail(db, slug, public_only=True)
    stats = collection_stats(db, [collection.id])
    return collection_to_response(collection, stats.get(collection.id, {}))


@app.get("/collections/{slug}/stickers", response_model=list[StickerResponse])
def list_public_stickers(
    slug: str,
    search: str | None = Query(default=None, max_length=120),
    category: StickerCategory | None = None,
    db: Session = Depends(get_db),
) -> list[dict]:
    collection = load_collection_by_slug_or_fail(db, slug, public_only=True)
    statement = (
        select(Sticker)
        .options(selectinload(Sticker.page))
        .where(Sticker.collection_id == collection.id, Sticker.active.is_(True))
        .order_by(Sticker.sort_order.asc(), Sticker.name.asc())
    )
    if category:
        statement = statement.where(Sticker.category == category)
    if search:
        statement = statement.where(Sticker.name.ilike(f"%{search.strip()}%"))
    stickers = db.execute(statement).scalars().all()
    return [sticker_to_response(sticker) for sticker in stickers]


@app.post("/exports", response_model=ExportResponse)
def create_export(payload: ExportRequest, db: Session = Depends(get_db)) -> dict:
    collection = load_collection_by_slug_or_fail(db, payload.collection_slug, public_only=True)
    stickers = selected_stickers_or_400(db, collection, payload.sticker_ids)
    export_record = build_export_pdf(collection, stickers, db)
    db.commit()
    return {
        "export_id": export_record.id,
        "item_count": export_record.item_count,
        "download_path": f"/exports/{export_record.id}/download",
        "file_name": Path(export_record.file_path).name,
    }


@app.post("/orders/quote", response_model=OrderQuoteResponse)
def quote_print_order(payload: OrderQuoteRequest, db: Session = Depends(get_db)) -> dict:
    collection = load_collection_by_slug_or_fail(db, payload.collection_slug, public_only=True)
    stickers = selected_stickers_or_400(db, collection, payload.sticker_ids)
    service_settings = get_or_create_service_settings(db)
    quote = build_order_quote(collection, stickers, db, service_settings)
    quote.pop("plan", None)
    return quote


@app.post("/orders", response_model=PrintOrderResponse)
def create_public_print_order(payload: PrintOrderCreate, db: Session = Depends(get_db)) -> dict:
    collection = load_collection_by_slug_or_fail(db, payload.collection_slug, public_only=True)
    stickers = selected_stickers_or_400(db, collection, payload.sticker_ids)
    service_settings = get_or_create_service_settings(db)
    try:
        order = create_print_order(
            db=db,
            collection=collection,
            stickers=stickers,
            service_type=payload.service_type,
            customer_name=payload.customer_name,
            customer_whatsapp=payload.customer_whatsapp,
            customer_nickname=payload.customer_nickname,
            notes=payload.notes,
            service_settings=service_settings,
        )
    except ValueError as err:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(err)) from err
    db.commit()
    db.refresh(order)
    return print_order_to_response(order, service_settings)


@app.get("/exports/{export_id}/download")
def download_export(export_id: int, db: Session = Depends(get_db)) -> FileResponse:
    from .models import Export

    export_record = db.get(Export, export_id)
    if not export_record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Exportacao nao encontrada.")
    file_path = settings.storage_root / export_record.file_path
    if not file_path.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Arquivo da exportacao nao encontrado.")
    return FileResponse(path=file_path, filename=file_path.name, media_type="application/pdf")


@app.get("/admin/collections", response_model=list[CollectionResponse], dependencies=[Depends(require_admin)])
def list_admin_collections(db: Session = Depends(get_db)) -> list[dict]:
    collections = db.execute(select(Collection).order_by(Collection.updated_at.desc(), Collection.id.desc())).scalars().all()
    stats = collection_stats(db, [collection.id for collection in collections])
    return [collection_to_response(collection, stats.get(collection.id, {})) for collection in collections]


@app.get("/admin/service-config", response_model=ServiceConfigResponse, dependencies=[Depends(require_admin)])
def get_admin_service_config(db: Session = Depends(get_db)) -> dict:
    service_settings = get_or_create_service_settings(db)
    return service_settings_to_response(service_settings)


@app.put("/admin/service-config", response_model=ServiceConfigResponse, dependencies=[Depends(require_admin)])
def update_admin_service_config(payload: ServiceConfigUpdate, db: Session = Depends(get_db)) -> dict:
    service_settings = get_or_create_service_settings(db)
    service_settings.service_enabled = payload.service_enabled
    service_settings.pack_size = payload.pack_size
    service_settings.print_price_cents = payload.print_price_cents
    service_settings.pack_price_cents = payload.pack_price_cents
    service_settings.pix_key = (payload.pix_key or "").strip() or None
    service_settings.pix_holder = (payload.pix_holder or "").strip() or None
    service_settings.pickup_note = (payload.pickup_note or "").strip() or None
    db.commit()
    db.refresh(service_settings)
    return service_settings_to_response(service_settings)


@app.get("/admin/orders", response_model=list[PrintOrderResponse], dependencies=[Depends(require_admin)])
def list_admin_orders(
    status_filter: PrintOrderStatus | None = Query(default=None, alias="status"),
    db: Session = Depends(get_db),
) -> list[dict]:
    statement = select(PrintOrder).order_by(PrintOrder.created_at.desc(), PrintOrder.id.desc())
    if status_filter:
        statement = statement.where(PrintOrder.status == status_filter)
    orders = db.execute(statement).scalars().all()
    return [print_order_to_response(order) for order in orders]


@app.put("/admin/orders/{order_id}", response_model=PrintOrderResponse, dependencies=[Depends(require_admin)])
def update_admin_order(order_id: int, payload: PrintOrderUpdate, db: Session = Depends(get_db)) -> dict:
    order = load_print_order_or_fail(db, order_id)
    order.status = payload.status
    order.admin_notes = (payload.admin_notes or "").strip() or None
    db.commit()
    db.refresh(order)
    return print_order_to_response(order)


@app.get("/admin/orders/{order_id}/download", dependencies=[Depends(require_admin)])
def download_admin_order_export(order_id: int, db: Session = Depends(get_db)) -> FileResponse:
    order = load_print_order_or_fail(db, order_id)
    file_path = settings.storage_root / order.export_file_path
    if not file_path.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Arquivo do pedido nao encontrado.")
    return FileResponse(path=file_path, filename=file_path.name, media_type="application/pdf")


@app.post("/admin/collections", response_model=CollectionResponse, dependencies=[Depends(require_admin)])
def create_collection(payload: CollectionCreate, db: Session = Depends(get_db)) -> dict:
    slug = slugify(payload.slug)
    ensure_collection_slug_unique(db, slug)
    collection = Collection(name=payload.name.strip(), slug=slug, description=(payload.description or "").strip() or None)
    db.add(collection)
    db.commit()
    db.refresh(collection)
    stats = collection_stats(db, [collection.id])
    return collection_to_response(collection, stats.get(collection.id, {}))


@app.get("/admin/collections/{collection_id}", response_model=CollectionResponse, dependencies=[Depends(require_admin)])
def get_admin_collection(collection_id: int, db: Session = Depends(get_db)) -> dict:
    collection = load_collection_or_fail(db, collection_id)
    stats = collection_stats(db, [collection.id])
    return collection_to_response(collection, stats.get(collection.id, {}))


@app.post("/admin/collections/{collection_id}/upload-pdf", dependencies=[Depends(require_admin)])
async def upload_collection_pdf(
    collection_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
) -> dict[str, int]:
    collection = load_collection_or_fail(db, collection_id)
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Envie um arquivo PDF valido.")
    upload_bytes = await file.read()
    if not upload_bytes:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="O arquivo PDF esta vazio.")
    save_pdf_and_render_pages(collection, file.filename, upload_bytes, db)
    db.commit()
    return {"page_count": len(collection.pages)}


@app.get(
    "/admin/collections/{collection_id}/pages",
    response_model=list[PageResponse],
    dependencies=[Depends(require_admin)],
)
def list_collection_pages(collection_id: int, db: Session = Depends(get_db)) -> list[dict]:
    collection = load_collection_or_fail(db, collection_id)
    pages = db.execute(
        select(Page).where(Page.collection_id == collection.id).order_by(Page.page_number.asc())
    ).scalars().all()
    return [page_to_response(page) for page in pages]


@app.get(
    "/admin/collections/{collection_id}/stickers",
    response_model=list[StickerResponse],
    dependencies=[Depends(require_admin)],
)
def list_collection_stickers(collection_id: int, db: Session = Depends(get_db)) -> list[dict]:
    collection = load_collection_or_fail(db, collection_id)
    stickers = db.execute(
        select(Sticker)
        .options(selectinload(Sticker.page))
        .where(Sticker.collection_id == collection.id)
        .order_by(Sticker.sort_order.asc(), Sticker.name.asc())
    ).scalars().all()
    return [sticker_to_response(sticker) for sticker in stickers]


@app.post(
    "/admin/collections/{collection_id}/auto-detect",
    response_model=AutoDetectResponse,
    dependencies=[Depends(require_admin)],
)
def auto_detect_stickers(
    collection_id: int,
    page_id: int | None = Query(default=None),
    replace_existing: bool = Query(default=True),
    db: Session = Depends(get_db),
) -> dict:
    collection = load_collection_or_fail(db, collection_id)
    pages = db.execute(
        select(Page).where(Page.collection_id == collection.id).order_by(Page.page_number.asc())
    ).scalars().all()
    if not pages:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Suba um PDF antes de rodar a automacao.")

    if page_id is not None:
        pages = [page for page in pages if page.id == page_id]
        if not pages:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pagina nao encontrada nessa colecao.")

    response = auto_detect_collection_pages(db, collection, pages, replace_existing=replace_existing)
    db.commit()
    return response


@app.post("/admin/stickers", response_model=StickerResponse, dependencies=[Depends(require_admin)])
def create_sticker(payload: StickerCreate, db: Session = Depends(get_db)) -> dict:
    collection = load_collection_or_fail(db, payload.collection_id)
    page = db.get(Page, payload.page_id)
    if not page or page.collection_id != collection.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Pagina invalida para essa colecao.")
    validate_sticker_bounds(payload.x_ratio, payload.y_ratio, payload.width_ratio, payload.height_ratio)
    sticker = Sticker(
        collection=collection,
        page=page,
        name=payload.name.strip(),
        code=(payload.code or "").strip() or None,
        category=payload.category,
        sort_order=payload.sort_order,
        x_ratio=payload.x_ratio,
        y_ratio=payload.y_ratio,
        width_ratio=payload.width_ratio,
        height_ratio=payload.height_ratio,
        active=payload.active,
        preview_path="",
        crop_path="",
    )
    db.add(sticker)
    db.flush()
    crop_sticker_image(sticker)
    refresh_sticker_ocr(sticker, update_name=False)
    db.commit()
    db.refresh(sticker)
    sticker = load_sticker_or_fail(db, sticker.id)
    return sticker_to_response(sticker)


@app.put("/admin/stickers/{sticker_id}", response_model=StickerResponse, dependencies=[Depends(require_admin)])
def update_sticker(sticker_id: int, payload: StickerUpdate, db: Session = Depends(get_db)) -> dict:
    sticker = load_sticker_or_fail(db, sticker_id)
    page = db.get(Page, payload.page_id)
    if not page or page.collection_id != sticker.collection_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Pagina invalida para essa colecao.")
    validate_sticker_bounds(payload.x_ratio, payload.y_ratio, payload.width_ratio, payload.height_ratio)
    sticker.page = page
    sticker.name = payload.name.strip()
    sticker.code = (payload.code or "").strip() or None
    sticker.category = payload.category
    sticker.sort_order = payload.sort_order
    sticker.x_ratio = payload.x_ratio
    sticker.y_ratio = payload.y_ratio
    sticker.width_ratio = payload.width_ratio
    sticker.height_ratio = payload.height_ratio
    sticker.active = payload.active
    sticker.detected_automatically = False
    crop_sticker_image(sticker)
    refresh_sticker_ocr(sticker, update_name=False)
    db.commit()
    sticker = load_sticker_or_fail(db, sticker.id)
    return sticker_to_response(sticker)


@app.delete("/admin/stickers/{sticker_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(require_admin)])
def delete_sticker(sticker_id: int, db: Session = Depends(get_db)) -> Response:
    sticker = load_sticker_or_fail(db, sticker_id)
    from .services import delete_sticker_record

    delete_sticker_record(db, sticker)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@app.post(
    "/admin/collections/{collection_id}/publish",
    response_model=CollectionResponse,
    dependencies=[Depends(require_admin)],
)
def publish_collection(collection_id: int, payload: PublishCollectionRequest, db: Session = Depends(get_db)) -> dict:
    collection = load_collection_or_fail(db, collection_id)
    stats = collection_stats(db, [collection.id]).get(collection.id, {})
    if payload.status == CollectionStatus.PUBLICADA and stats.get("stickers", 0) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cadastre pelo menos uma figurinha antes de publicar a colecao.",
        )
    collection.status = payload.status
    db.commit()
    db.refresh(collection)
    stats = collection_stats(db, [collection.id])
    return collection_to_response(collection, stats.get(collection.id, {}))
