from __future__ import annotations

import base64
import hashlib
import hmac
import time
import traceback
import uuid
from datetime import UTC, datetime, timedelta
from pathlib import Path
from threading import Lock
from zoneinfo import ZoneInfo

from fastapi import Depends, FastAPI, File, Form, Header, HTTPException, Query, Request, Response, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from sqlalchemy import and_, distinct, func, or_, select
from sqlalchemy.orm import Session as OrmSession
from sqlalchemy.orm import Session, selectinload

from .config import get_settings
from .custom_stickers import build_manual_cutout_assets
from .database import Base, SessionLocal, engine, get_db
from .mercadopago import MercadoPagoError
from .models import (
    Album,
    Collection,
    CollectionExportMode,
    CollectionStatus,
    CollectionType,
    CustomCategoryType,
    CustomPositionType,
    CustomStickerTemplate,
    CustomStickerTemplateLayer,
    CustomStickerTemplatePhotoSlot,
    CustomStickerTemplateTextSlot,
    CustomTemplateCompositionMode,
    CustomTemplateLayerType,
    CustomProfileType,
    CustomStickerUnlock,
    CustomStickerUnlockStatus,
    CustomStickerUnlockType,
    Page,
    PageLayoutTemplate,
    PageLayoutTemplateBlock,
    PageSelectionBlock,
    PrintOrder,
    PrintOrderStatus,
    PublicAccessEvent,
    SourceDocument,
    SourceDocumentPage,
    Sticker,
    StickerCategory,
    StickerSourceType,
)
from .schemas import (
    AdminLoginRequest,
    AdminAccessSummaryResponse,
    AdminSessionResponse,
    AlbumCreate,
    AlbumResponse,
    AlbumUpdate,
    AutoDetectResponse,
    BlockDetectResponse,
    CollectionAlbumAssign,
    CollectionCreate,
    CollectionResponse,
    CollectionUpdate,
    CustomTemplateCreate,
    CustomTemplateDetailResponse,
    CustomTemplatePublicOption,
    CustomTemplateSummaryResponse,
    CustomTemplateUpdate,
    CustomStickerUnlockRequest,
    CustomStickerUnlockResponse,
    MyStickerCutoutResponse,
    OrderQuoteRequest,
    OrderQuoteResponse,
    ExportRequest,
    ExportResponse,
    PageLayoutTemplateCreate,
    PageLayoutTemplateResponse,
    PageSelectionBlockResponse,
    PageSelectionBlockCreate,
    PageSelectionBlockUpdate,
    PublicProgressJobResponse,
    PublicServiceConfigResponse,
    PageResponse,
    SourceDetectedStickerBulkActionRequest,
    SourceDetectedStickerBulkActionResponse,
    SourceDetectedStickerAssignRequest,
    SourceDetectedStickerResponse,
    SourceDocumentDetailResponse,
    SourceDocumentPageResponse,
    SourceDocumentSummaryResponse,
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
    album_stats,
    album_sort_key,
    album_to_response,
    apply_page_layout_template_to_source_page,
    auto_detect_collection_pages,
    auto_detect_source_document_stickers,
    auto_detect_source_block_stickers,
    build_export_pdf,
    build_order_quote,
    build_order_quote_with_extras,
    collection_stats,
    collection_sort_key,
    consume_custom_sticker_unlock_use,
    collection_to_response,
    create_page_layout_template_from_source_page,
    custom_template_to_detail_response,
    custom_template_to_public_option,
    custom_template_to_summary_response,
    custom_sticker_unlock_to_response,
    create_print_order,
    crop_sticker_image,
    discard_source_detected_stickers,
    unassign_source_detected_stickers,
    duplicate_page_selection_block,
    duplicate_blocks_from_previous_source_page,
    delete_source_document_record,
    delete_custom_base_image,
    delete_album_record,
    delete_collection_record,
    delete_custom_template_layer_image,
    delete_generated_stickers_for_session,
    ensure_album_slug_unique,
    ensure_default_album_assignments,
    ensure_default_custom_template_assignments,
    generated_sticker_for_selection,
    get_or_create_service_settings,
    get_or_create_custom_sticker_unlock,
    generated_sticker_has_export_access,
    generated_sticker_requires_manual_unlock,
    has_generated_sticker,
    import_custom_template_layers,
    ensure_collection_slug_unique,
    load_album_by_slug_or_fail,
    load_album_or_fail,
    load_collection_by_slug_or_fail,
    load_collection_or_fail,
    load_generated_sticker_for_session,
    load_available_custom_sticker_unlock,
    load_latest_custom_sticker_unlock,
    load_active_custom_templates,
    load_page_layout_template_or_fail,
    load_page_selection_block_or_fail,
    load_print_order_or_fail,
    load_source_detected_sticker_or_fail,
    load_source_document_page_or_fail,
    load_source_document_or_fail,
    load_sticker_or_fail,
    load_prepared_portrait_bytes,
    page_to_response,
    page_layout_template_to_response,
    pending_custom_sticker_unlock_matches_settings,
    source_document_page_to_response,
    source_detected_sticker_to_response,
    source_document_to_detail_response,
    source_document_to_summary_response,
    print_order_to_response,
    refresh_sticker_ocr,
    save_prepared_cutout_assets,
    save_custom_base_image,
    save_custom_template_layer_image,
    save_pdf_and_render_pages,
    save_source_document_and_render_pages,
    service_settings_to_response,
    slugify,
    sync_custom_sticker_unlock_status,
    sticker_to_response,
    normalize_legacy_custom_template_photo_visibility,
    normalize_legacy_custom_template_zoom_limits,
    normalize_collection_metadata,
    normalize_collection_export_settings,
    normalize_legacy_custom_template_text_layouts,
    normalize_custom_profile_type,
    normalize_template_text_slots,
    cleanup_orphaned_source_document_artifacts,
    assign_source_detected_stickers,
    upsert_generated_sticker,
    validate_sticker_bounds,
    is_custom_sticker_unlocked,
)
from .progress_jobs import public_progress_jobs


settings = get_settings()
PUBLIC_FILE_PREFIXES = (
    "pages/",
    "crops/",
    "custom_stickers/",
    "custom_portraits/",
    "custom_bases/",
    "custom_template_layers/",
    "source_document_pages/",
    "source_detected/",
)
EXPORT_DOWNLOAD_TTL_SECONDS = 600
PUBLIC_ANALYTICS_TZ = ZoneInfo("America/Sao_Paulo")

app = FastAPI(title="Figurinhas API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _is_allowed_public_file_path(relative_path: str) -> bool:
    normalized = (relative_path or "").strip().lstrip("/")
    return bool(normalized) and any(normalized.startswith(prefix) for prefix in PUBLIC_FILE_PREFIXES)


def _resolve_public_storage_path_or_404(relative_path: str) -> Path:
    normalized = (relative_path or "").strip().lstrip("/")
    if not _is_allowed_public_file_path(normalized):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Arquivo nao encontrado.")
    file_path = (settings.storage_root / normalized).resolve()
    try:
        file_path.relative_to(settings.storage_root)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Arquivo nao encontrado.") from exc
    if not file_path.exists() or not file_path.is_file():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Arquivo nao encontrado.")
    return file_path


def _build_export_download_signature(export_id: int, expires_at: int) -> str:
    payload = f"{export_id}:{expires_at}".encode("utf-8")
    secret = settings.export_signing_secret.encode("utf-8")
    return hmac.new(secret, payload, hashlib.sha256).hexdigest()


def _build_export_download_path(export_id: int, *, ttl_seconds: int = EXPORT_DOWNLOAD_TTL_SECONDS) -> str:
    expires_at = int(time.time()) + max(60, ttl_seconds)
    token = _build_export_download_signature(export_id, expires_at)
    return f"/exports/{export_id}/download?expires={expires_at}&token={token}"


def _validate_export_download_token_or_403(export_id: int, expires_at: int, token: str) -> None:
    if expires_at < int(time.time()):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Link de download expirado.")
    expected = _build_export_download_signature(export_id, expires_at)
    if not hmac.compare_digest(expected, (token or "").strip()):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Link de download invalido.")


class AdminSessionStore:
    def __init__(self) -> None:
        self._sessions: dict[str, float] = {}
        self._lock = Lock()

    def _cleanup_locked(self) -> None:
        now = time.time()
        expired = [token for token, expires_at in self._sessions.items() if expires_at <= now]
        for token in expired:
            self._sessions.pop(token, None)

    def create(self, *, ttl_hours: int) -> tuple[str, datetime]:
        token = uuid.uuid4().hex + uuid.uuid4().hex
        expires_at = datetime.now(UTC) + timedelta(hours=max(1, ttl_hours))
        with self._lock:
            self._cleanup_locked()
            self._sessions[token] = expires_at.timestamp()
        return token, expires_at

    def validate(self, token: str | None) -> bool:
        normalized = (token or "").strip()
        if not normalized:
            return False
        with self._lock:
            self._cleanup_locked()
            return normalized in self._sessions

    def revoke(self, token: str | None) -> None:
        normalized = (token or "").strip()
        if not normalized:
            return
        with self._lock:
            self._sessions.pop(normalized, None)


class AdminLoginThrottle:
    def __init__(self) -> None:
        self._attempts: dict[str, list[float]] = {}
        self._blocked_until: dict[str, float] = {}
        self._lock = Lock()

    def _cleanup_locked(self, *, now: float, window_seconds: int) -> None:
        stale_keys = []
        for key, attempts in self._attempts.items():
            fresh = [stamp for stamp in attempts if stamp >= now - window_seconds]
            if fresh:
                self._attempts[key] = fresh
            else:
                stale_keys.append(key)
        for key in stale_keys:
            self._attempts.pop(key, None)
        expired_blocks = [key for key, blocked_until in self._blocked_until.items() if blocked_until <= now]
        for key in expired_blocks:
            self._blocked_until.pop(key, None)

    def check_or_raise(self, key: str) -> None:
        now = time.time()
        window_seconds = max(60, settings.admin_login_attempt_window_minutes * 60)
        with self._lock:
            self._cleanup_locked(now=now, window_seconds=window_seconds)
            blocked_until = self._blocked_until.get(key)
            if blocked_until and blocked_until > now:
                wait_seconds = int(blocked_until - now)
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail=f"Muitas tentativas de login. Tente novamente em {max(1, wait_seconds)} segundo(s).",
                )

    def register_failure(self, key: str) -> None:
        now = time.time()
        window_seconds = max(60, settings.admin_login_attempt_window_minutes * 60)
        with self._lock:
            self._cleanup_locked(now=now, window_seconds=window_seconds)
            attempts = self._attempts.setdefault(key, [])
            attempts.append(now)
            if len(attempts) >= max(1, settings.admin_login_max_attempts):
                self._blocked_until[key] = now + max(60, settings.admin_login_block_minutes * 60)
                self._attempts.pop(key, None)

    def reset(self, key: str) -> None:
        with self._lock:
            self._attempts.pop(key, None)
            self._blocked_until.pop(key, None)


admin_sessions = AdminSessionStore()
admin_login_throttle = AdminLoginThrottle()


class PublicRateLimiter:
    def __init__(self) -> None:
        self._hits: dict[str, list[float]] = {}
        self._lock = Lock()

    def _cleanup_locked(self, *, now: float, window_seconds: int) -> None:
        stale_keys = []
        for key, hits in self._hits.items():
            fresh = [stamp for stamp in hits if stamp >= now - window_seconds]
            if fresh:
                self._hits[key] = fresh
            else:
                stale_keys.append(key)
        for key in stale_keys:
            self._hits.pop(key, None)

    def enforce(self, *, bucket: str, subject: str, limit: int, window_seconds: int) -> None:
        if limit <= 0:
            return
        now = time.time()
        storage_key = f"{bucket}:{subject}"
        with self._lock:
            self._cleanup_locked(now=now, window_seconds=window_seconds)
            hits = self._hits.setdefault(storage_key, [])
            if len(hits) >= limit:
                retry_after = max(1, int(window_seconds - (now - hits[0])))
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail=f"Muitas requisicoes para esta operacao. Tente novamente em {retry_after} segundo(s).",
                )
            hits.append(now)


public_rate_limiter = PublicRateLimiter()


def _job_response(job) -> dict:
    return {
        "job_id": job.id,
        "job_type": job.job_type,
        "status": job.status,
        "title": job.title,
        "subtitle": job.subtitle,
        "steps": list(job.steps),
        "step_index": job.step_index,
        "progress": job.progress,
        "message": job.message,
        "result": job.result,
        "error": job.error,
    }


def _start_public_job(
    *,
    job_type: str,
    session_token: str,
    album_slug: str | None,
    title: str,
    subtitle: str | None,
    steps: list[str],
):
    return public_progress_jobs.create(
        job_type=job_type,
        session_token=session_token,
        album_slug=album_slug,
        title=title,
        subtitle=subtitle,
        steps=steps,
    )


def _build_job_reporter(job_id: str, steps: list[str]):
    def report(progress: int, message: str) -> None:
        try:
            step_index = steps.index(message)
        except ValueError:
            step_index = None
        public_progress_jobs.update(
            job_id,
            status="PROCESSANDO",
            progress=progress,
            step_index=step_index,
            message=message,
        )

    return report


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
            "source_type": "VARCHAR(20) NOT NULL DEFAULT 'PDF'",
            "session_token": "VARCHAR(120)",
            "profile_type": "VARCHAR(20)",
            "birth_date_text": "VARCHAR(40)",
            "height_text": "VARCHAR(40)",
            "weight_text": "VARCHAR(40)",
            "city_or_team": "VARCHAR(150)",
            "template_id": "INTEGER",
            "custom_category_type": "VARCHAR(20)",
            "custom_position_type": "VARCHAR(20)",
            "composition_mode_used": "VARCHAR(20)",
            "source_document_id": "INTEGER",
            "source_document_page_id": "INTEGER",
            "source_block_id": "INTEGER",
            "photo_offset_x": "FLOAT",
            "photo_offset_y": "FLOAT",
            "photo_scale": "FLOAT",
            "photo_rotation": "FLOAT",
            "uploaded_photo_path": "VARCHAR(255)",
            "generated_portrait_path": "VARCHAR(255)",
            "export_width_pt": "FLOAT",
            "export_height_pt": "FLOAT",
        }

        for column_name, definition in required_columns.items():
            if column_name in existing_columns:
                continue
            connection.exec_driver_sql(f"ALTER TABLE figurinhas_stickers ADD COLUMN {column_name} {definition}")
        connection.exec_driver_sql(
            "UPDATE figurinhas_stickers SET profile_type = 'CRIANCA' WHERE profile_type IN ('MENINO', 'MENINA')"
        )

        collections_table_exists = connection.exec_driver_sql(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='figurinhas_collections'"
        ).fetchone()
        if collections_table_exists:
            collection_columns = {
                row[1] for row in connection.exec_driver_sql("PRAGMA table_info(figurinhas_collections)").fetchall()
            }
            if "album_id" not in collection_columns:
                connection.exec_driver_sql("ALTER TABLE figurinhas_collections ADD COLUMN album_id INTEGER")
            if "sort_order" not in collection_columns:
                connection.exec_driver_sql(
                    "ALTER TABLE figurinhas_collections ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0"
                )
            if "collection_type" not in collection_columns:
                connection.exec_driver_sql(
                    "ALTER TABLE figurinhas_collections ADD COLUMN collection_type VARCHAR(30) NOT NULL DEFAULT 'SELECAO'"
                )
            if "export_mode" not in collection_columns:
                connection.exec_driver_sql(
                    "ALTER TABLE figurinhas_collections ADD COLUMN export_mode VARCHAR(30) NOT NULL DEFAULT 'GRID'"
                )
            if "allow_quantity_choice" not in collection_columns:
                connection.exec_driver_sql(
                    "ALTER TABLE figurinhas_collections ADD COLUMN allow_quantity_choice BOOLEAN NOT NULL DEFAULT 0"
                )
            if "default_quantity" not in collection_columns:
                connection.exec_driver_sql(
                    "ALTER TABLE figurinhas_collections ADD COLUMN default_quantity INTEGER NOT NULL DEFAULT 1"
                )
            if "max_quantity_per_order" not in collection_columns:
                connection.exec_driver_sql(
                    "ALTER TABLE figurinhas_collections ADD COLUMN max_quantity_per_order INTEGER NOT NULL DEFAULT 1"
                )
            if "display_group_order" not in collection_columns:
                connection.exec_driver_sql(
                    "ALTER TABLE figurinhas_collections ADD COLUMN display_group_order INTEGER NOT NULL DEFAULT 1"
                )
            if "display_item_order" not in collection_columns:
                connection.exec_driver_sql(
                    "ALTER TABLE figurinhas_collections ADD COLUMN display_item_order INTEGER NOT NULL DEFAULT 999"
                )
            if "is_system" not in collection_columns:
                connection.exec_driver_sql(
                    "ALTER TABLE figurinhas_collections ADD COLUMN is_system BOOLEAN NOT NULL DEFAULT 0"
                )

        albums_table_exists = connection.exec_driver_sql(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='figurinhas_albums'"
        ).fetchone()
        if albums_table_exists:
            album_columns = {
                row[1] for row in connection.exec_driver_sql("PRAGMA table_info(figurinhas_albums)").fetchall()
            }
            if "sort_order" not in album_columns:
                connection.exec_driver_sql(
                    "ALTER TABLE figurinhas_albums ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0"
                )

        service_settings_table_exists = connection.exec_driver_sql(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='figurinhas_service_settings'"
        ).fetchone()
        if service_settings_table_exists:
            service_columns = {
                row[1] for row in connection.exec_driver_sql("PRAGMA table_info(figurinhas_service_settings)").fetchall()
            }
            if "donation_enabled" not in service_columns:
                connection.exec_driver_sql(
                    "ALTER TABLE figurinhas_service_settings ADD COLUMN donation_enabled BOOLEAN NOT NULL DEFAULT 0"
                )
            if "donation_message" not in service_columns:
                connection.exec_driver_sql(
                    "ALTER TABLE figurinhas_service_settings ADD COLUMN donation_message TEXT"
                )
            if "pickup_note" not in service_columns:
                connection.exec_driver_sql(
                    "ALTER TABLE figurinhas_service_settings ADD COLUMN pickup_note TEXT"
                )
            if "custom_prompt_template" not in service_columns:
                connection.exec_driver_sql(
                    "ALTER TABLE figurinhas_service_settings ADD COLUMN custom_prompt_template TEXT"
                )
            if "custom_base_homem_path" not in service_columns:
                connection.exec_driver_sql(
                    "ALTER TABLE figurinhas_service_settings ADD COLUMN custom_base_homem_path VARCHAR(255)"
                )
            if "custom_base_mulher_path" not in service_columns:
                connection.exec_driver_sql(
                    "ALTER TABLE figurinhas_service_settings ADD COLUMN custom_base_mulher_path VARCHAR(255)"
                )
            if "custom_base_menino_path" not in service_columns:
                connection.exec_driver_sql(
                    "ALTER TABLE figurinhas_service_settings ADD COLUMN custom_base_menino_path VARCHAR(255)"
                )
            if "custom_base_menina_path" not in service_columns:
                connection.exec_driver_sql(
                    "ALTER TABLE figurinhas_service_settings ADD COLUMN custom_base_menina_path VARCHAR(255)"
                )
            if "custom_generation_mode" not in service_columns:
                connection.exec_driver_sql(
                    "ALTER TABLE figurinhas_service_settings ADD COLUMN custom_generation_mode VARCHAR(20) NOT NULL DEFAULT 'LAYERS'"
                )
            if "custom_sticker_unlock_enabled" not in service_columns:
                connection.exec_driver_sql(
                    "ALTER TABLE figurinhas_service_settings ADD COLUMN custom_sticker_unlock_enabled BOOLEAN NOT NULL DEFAULT 0"
                )
            if "custom_sticker_unlock_price_cents" not in service_columns:
                connection.exec_driver_sql(
                    "ALTER TABLE figurinhas_service_settings ADD COLUMN custom_sticker_unlock_price_cents INTEGER NOT NULL DEFAULT 500"
                )
            if "custom_sticker_unlock_message" not in service_columns:
                connection.exec_driver_sql(
                    "ALTER TABLE figurinhas_service_settings ADD COLUMN custom_sticker_unlock_message TEXT"
                )
            if "custom_ai_unlock_enabled" not in service_columns:
                connection.exec_driver_sql(
                    "ALTER TABLE figurinhas_service_settings ADD COLUMN custom_ai_unlock_enabled BOOLEAN NOT NULL DEFAULT 0"
                )
            if "custom_ai_unlock_price_cents" not in service_columns:
                connection.exec_driver_sql(
                    "ALTER TABLE figurinhas_service_settings ADD COLUMN custom_ai_unlock_price_cents INTEGER NOT NULL DEFAULT 500"
                )
            if "custom_ai_unlock_message" not in service_columns:
                connection.exec_driver_sql(
                    "ALTER TABLE figurinhas_service_settings ADD COLUMN custom_ai_unlock_message TEXT"
                )
            connection.exec_driver_sql(
                """
                UPDATE figurinhas_service_settings
                SET custom_base_menino_path = COALESCE(custom_base_menino_path, custom_base_menina_path),
                    custom_base_menina_path = NULL
                """
            )

        print_orders_table_exists = connection.exec_driver_sql(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='figurinhas_print_orders'"
        ).fetchone()
        if print_orders_table_exists:
            order_columns = {
                row[1] for row in connection.exec_driver_sql("PRAGMA table_info(figurinhas_print_orders)").fetchall()
            }
            if "album_id" not in order_columns:
                connection.exec_driver_sql("ALTER TABLE figurinhas_print_orders ADD COLUMN album_id INTEGER")
            if "album_name" not in order_columns:
                connection.exec_driver_sql("ALTER TABLE figurinhas_print_orders ADD COLUMN album_name VARCHAR(150)")

        unlocks_table_exists = connection.exec_driver_sql(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='figurinhas_custom_sticker_unlocks'"
        ).fetchone()
        if unlocks_table_exists:
            unlock_info = connection.exec_driver_sql(
                "PRAGMA table_info(figurinhas_custom_sticker_unlocks)"
            ).fetchall()
            unlock_columns = {row[1] for row in unlock_info}
            sticker_id_notnull = any(row[1] == "sticker_id" and row[3] == 1 for row in unlock_info)
            needs_unlock_table_rebuild = "unlock_type" not in unlock_columns or sticker_id_notnull
            if needs_unlock_table_rebuild:
                paid_at_select = "paid_at" if "paid_at" in unlock_columns else "NULL"
                connection.exec_driver_sql("PRAGMA foreign_keys=OFF")
                connection.exec_driver_sql(
                    "ALTER TABLE figurinhas_custom_sticker_unlocks RENAME TO figurinhas_custom_sticker_unlocks_legacy"
                )
                connection.exec_driver_sql(
                    """
                    CREATE TABLE figurinhas_custom_sticker_unlocks (
                        id INTEGER NOT NULL PRIMARY KEY,
                        album_id INTEGER NOT NULL,
                        sticker_id INTEGER,
                        session_token VARCHAR(120) NOT NULL,
                        unlock_type VARCHAR(20) NOT NULL DEFAULT 'MANUAL_PDF',
                        amount_cents INTEGER NOT NULL,
                        total_uses INTEGER NOT NULL DEFAULT 0,
                        remaining_uses INTEGER NOT NULL DEFAULT 0,
                        status VARCHAR(20) NOT NULL,
                        mp_payment_id VARCHAR(80),
                        mp_external_reference VARCHAR(120),
                        mp_status VARCHAR(50),
                        mp_status_detail VARCHAR(120),
                        qr_code_base64 TEXT,
                        qr_code TEXT,
                        ticket_url TEXT,
                        expires_at DATETIME,
                        paid_at DATETIME,
                        created_at DATETIME NOT NULL,
                        updated_at DATETIME NOT NULL,
                        FOREIGN KEY(album_id) REFERENCES figurinhas_albums (id),
                        FOREIGN KEY(sticker_id) REFERENCES figurinhas_stickers (id)
                    )
                    """
                )
                connection.exec_driver_sql(
                    f"""
                    INSERT INTO figurinhas_custom_sticker_unlocks (
                        id,
                        album_id,
                        sticker_id,
                        session_token,
                        unlock_type,
                        amount_cents,
                        total_uses,
                        remaining_uses,
                        status,
                        mp_payment_id,
                        mp_external_reference,
                        mp_status,
                        mp_status_detail,
                        qr_code_base64,
                        qr_code,
                        ticket_url,
                        expires_at,
                        paid_at,
                        created_at,
                        updated_at
                    )
                    SELECT
                        id,
                        album_id,
                        sticker_id,
                        session_token,
                        'MANUAL_PDF',
                        amount_cents,
                        0,
                        0,
                        status,
                        mp_payment_id,
                        mp_external_reference,
                        mp_status,
                        mp_status_detail,
                        qr_code_base64,
                        qr_code,
                        ticket_url,
                        expires_at,
                        {paid_at_select},
                        created_at,
                        updated_at
                    FROM figurinhas_custom_sticker_unlocks_legacy
                    """
                )
                connection.exec_driver_sql("DROP TABLE figurinhas_custom_sticker_unlocks_legacy")
                connection.exec_driver_sql(
                    "CREATE INDEX IF NOT EXISTS ix_figurinhas_custom_sticker_unlocks_album_id ON figurinhas_custom_sticker_unlocks (album_id)"
                )
                connection.exec_driver_sql(
                    "CREATE INDEX IF NOT EXISTS ix_figurinhas_custom_sticker_unlocks_sticker_id ON figurinhas_custom_sticker_unlocks (sticker_id)"
                )
                connection.exec_driver_sql(
                    "CREATE INDEX IF NOT EXISTS ix_figurinhas_custom_sticker_unlocks_session_token ON figurinhas_custom_sticker_unlocks (session_token)"
                )
                connection.exec_driver_sql(
                    "CREATE INDEX IF NOT EXISTS ix_figurinhas_custom_sticker_unlocks_unlock_type ON figurinhas_custom_sticker_unlocks (unlock_type)"
                )
                connection.exec_driver_sql(
                    "CREATE INDEX IF NOT EXISTS ix_figurinhas_custom_sticker_unlocks_mp_payment_id ON figurinhas_custom_sticker_unlocks (mp_payment_id)"
                )
                connection.exec_driver_sql(
                    "CREATE INDEX IF NOT EXISTS ix_figurinhas_custom_sticker_unlocks_mp_external_reference ON figurinhas_custom_sticker_unlocks (mp_external_reference)"
                )
                connection.exec_driver_sql("PRAGMA foreign_keys=ON")
            else:
                if "paid_at" not in unlock_columns:
                    connection.exec_driver_sql(
                        "ALTER TABLE figurinhas_custom_sticker_unlocks ADD COLUMN paid_at DATETIME"
                    )
                if "unlock_type" not in unlock_columns:
                    connection.exec_driver_sql(
                        "ALTER TABLE figurinhas_custom_sticker_unlocks ADD COLUMN unlock_type VARCHAR(20) NOT NULL DEFAULT 'MANUAL_PDF'"
                    )
                if "total_uses" not in unlock_columns:
                    connection.exec_driver_sql(
                        "ALTER TABLE figurinhas_custom_sticker_unlocks ADD COLUMN total_uses INTEGER NOT NULL DEFAULT 0"
                    )
                if "remaining_uses" not in unlock_columns:
                    connection.exec_driver_sql(
                        "ALTER TABLE figurinhas_custom_sticker_unlocks ADD COLUMN remaining_uses INTEGER NOT NULL DEFAULT 0"
                    )

        custom_templates_table_exists = connection.exec_driver_sql(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='figurinhas_custom_sticker_templates'"
        ).fetchone()
        if custom_templates_table_exists:
            template_columns = {
                row[1] for row in connection.exec_driver_sql("PRAGMA table_info(figurinhas_custom_sticker_templates)").fetchall()
            }
            if "album_id" not in template_columns:
                connection.exec_driver_sql(
                    "ALTER TABLE figurinhas_custom_sticker_templates ADD COLUMN album_id INTEGER"
                )
            connection.exec_driver_sql(
                "UPDATE figurinhas_custom_sticker_templates SET profile_type = 'CRIANCA' WHERE profile_type IN ('MENINO', 'MENINA')"
            )
            connection.exec_driver_sql(
                """
                UPDATE figurinhas_custom_sticker_templates
                SET name = REPLACE(REPLACE(name, 'Menino', 'Crianca'), 'Menina', 'Crianca')
                WHERE name LIKE '%Menino%' OR name LIKE '%Menina%'
                """
            )

        custom_template_photo_slots_table_exists = connection.exec_driver_sql(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='figurinhas_custom_sticker_template_photo_slots'"
        ).fetchone()
        if custom_template_photo_slots_table_exists:
            photo_slot_columns = {
                row[1]
                for row in connection.exec_driver_sql(
                    "PRAGMA table_info(figurinhas_custom_sticker_template_photo_slots)"
                ).fetchall()
            }
            if "portrait_z_index" not in photo_slot_columns:
                connection.exec_driver_sql(
                    "ALTER TABLE figurinhas_custom_sticker_template_photo_slots ADD COLUMN portrait_z_index INTEGER NOT NULL DEFAULT 30"
                )
            if "visible_x" not in photo_slot_columns:
                connection.exec_driver_sql(
                    "ALTER TABLE figurinhas_custom_sticker_template_photo_slots ADD COLUMN visible_x FLOAT NOT NULL DEFAULT 0"
                )
            if "visible_y" not in photo_slot_columns:
                connection.exec_driver_sql(
                    "ALTER TABLE figurinhas_custom_sticker_template_photo_slots ADD COLUMN visible_y FLOAT NOT NULL DEFAULT 0"
                )
            if "visible_width" not in photo_slot_columns:
                connection.exec_driver_sql(
                    "ALTER TABLE figurinhas_custom_sticker_template_photo_slots ADD COLUMN visible_width FLOAT NOT NULL DEFAULT 1"
                )
            if "visible_height" not in photo_slot_columns:
                connection.exec_driver_sql(
                    "ALTER TABLE figurinhas_custom_sticker_template_photo_slots ADD COLUMN visible_height FLOAT NOT NULL DEFAULT 0.9"
                )


def ensure_runtime_indexes() -> None:
    index_statements = (
        "CREATE INDEX IF NOT EXISTS ix_figurinhas_collections_public_catalog ON figurinhas_collections (status, is_system, display_group_order, display_item_order, sort_order, id)",
        "CREATE INDEX IF NOT EXISTS ix_figurinhas_collections_album_catalog ON figurinhas_collections (album_id, status, is_system, sort_order, id)",
        "CREATE INDEX IF NOT EXISTS ix_figurinhas_stickers_collection_active_catalog ON figurinhas_stickers (collection_id, active, sort_order, id)",
        "CREATE INDEX IF NOT EXISTS ix_figurinhas_stickers_collection_category_active ON figurinhas_stickers (collection_id, category, active, sort_order, id)",
        "CREATE INDEX IF NOT EXISTS ix_figurinhas_source_documents_album_status ON figurinhas_source_documents (album_id, status, created_at, id)",
        "CREATE INDEX IF NOT EXISTS ix_figurinhas_source_document_pages_document_page_number ON figurinhas_source_document_pages (document_id, page_number, id)",
        "CREATE INDEX IF NOT EXISTS ix_figurinhas_source_detected_stickers_document_page_status ON figurinhas_source_detected_stickers (document_id, page_id, status, id)",
        "CREATE INDEX IF NOT EXISTS ix_figurinhas_source_detected_stickers_assigned_status ON figurinhas_source_detected_stickers (assigned_collection_id, status, id)",
        "CREATE INDEX IF NOT EXISTS ix_figurinhas_custom_sticker_unlocks_album_session_type_status ON figurinhas_custom_sticker_unlocks (album_id, session_token, unlock_type, status, created_at, id)",
        "CREATE INDEX IF NOT EXISTS ix_figurinhas_print_orders_album_created ON figurinhas_print_orders (album_id, created_at, id)",
        "CREATE INDEX IF NOT EXISTS ix_figurinhas_public_access_events_date_route ON figurinhas_public_access_events (event_date, route_key, id)",
        "CREATE INDEX IF NOT EXISTS ix_figurinhas_public_access_events_subject_date ON figurinhas_public_access_events (subject_hash, event_date, id)",
    )
    with engine.begin() as connection:
        for statement in index_statements:
            connection.exec_driver_sql(statement)


@app.on_event("startup")
def startup() -> None:
    Base.metadata.create_all(bind=engine)
    ensure_runtime_schema()
    ensure_runtime_indexes()
    with OrmSession(engine) as db:
        ensure_default_album_assignments(db)
        ensure_default_custom_template_assignments(db)
        normalize_collection_metadata(db)
        cleanup_orphaned_source_document_artifacts(db)
        normalize_legacy_custom_template_text_layouts(db)
        normalize_legacy_custom_template_photo_visibility(db)
        normalize_legacy_custom_template_zoom_limits(db)
        get_or_create_service_settings(db)
        db.commit()


def _admin_login_client_key(request: Request) -> str:
    forwarded_for = (request.headers.get("x-forwarded-for") or "").split(",")[0].strip()
    if forwarded_for:
        return forwarded_for
    return request.client.host if request.client else "unknown"


def _public_client_key(request: Request) -> str:
    forwarded_for = (request.headers.get("x-forwarded-for") or "").split(",")[0].strip()
    if forwarded_for:
        return forwarded_for
    return request.client.host if request.client else "unknown"


def _session_subject(session_token: str | None) -> str | None:
    normalized = (session_token or "").strip()
    return normalized or None


def _public_visitor_subject_hash(request: Request) -> str:
    client_key = _public_client_key(request)
    user_agent = (request.headers.get("user-agent") or "").strip().lower()
    subject = f"{client_key}|{user_agent}"
    return hashlib.sha256(subject.encode("utf-8")).hexdigest()


def _track_public_catalog_access(request: Request) -> None:
    event_date = datetime.now(PUBLIC_ANALYTICS_TZ).date()
    try:
        with SessionLocal() as tracking_db:
            tracking_db.add(
                PublicAccessEvent(
                    event_date=event_date,
                    route_key="CATALOG_HOME",
                    subject_hash=_public_visitor_subject_hash(request),
                )
            )
            tracking_db.commit()
    except Exception:
        traceback.print_exc()


def _build_admin_access_summary(db: Session) -> dict:
    today = datetime.now(PUBLIC_ANALYTICS_TZ).date()
    last_7_start = today - timedelta(days=6)

    def _counts(date_from, date_to):
        row = db.execute(
            select(
                func.count(PublicAccessEvent.id),
                func.count(distinct(PublicAccessEvent.subject_hash)),
            ).where(
                PublicAccessEvent.route_key == "CATALOG_HOME",
                PublicAccessEvent.event_date >= date_from,
                PublicAccessEvent.event_date <= date_to,
            )
        ).one()
        return int(row[0] or 0), int(row[1] or 0)

    visits_today, unique_today = _counts(today, today)
    visits_last_7_days, unique_last_7_days = _counts(last_7_start, today)
    return {
        "visits_today": visits_today,
        "unique_today": unique_today,
        "visits_last_7_days": visits_last_7_days,
        "unique_last_7_days": unique_last_7_days,
    }


def _enforce_public_rate_limit(
    *,
    request: Request,
    bucket: str,
    limit: int,
    session_token: str | None = None,
) -> None:
    window_seconds = max(10, settings.public_rate_limit_window_seconds)
    public_rate_limiter.enforce(
        bucket=bucket,
        subject=f"ip:{_public_client_key(request)}",
        limit=limit,
        window_seconds=window_seconds,
    )
    session_subject = _session_subject(session_token)
    if session_subject:
        public_rate_limiter.enforce(
            bucket=bucket,
            subject=f"session:{session_subject}",
            limit=limit,
            window_seconds=window_seconds,
        )


def _verify_admin_password(password: str) -> bool:
    candidate = (password or "").strip()
    if not candidate:
        return False
    configured_hash = settings.admin_password_hash
    if configured_hash:
        try:
            algorithm, iterations_text, salt, expected = configured_hash.split("$", 3)
            if algorithm != "pbkdf2_sha256":
                return False
            derived = hashlib.pbkdf2_hmac(
                "sha256",
                candidate.encode("utf-8"),
                salt.encode("utf-8"),
                int(iterations_text),
            ).hex()
            return hmac.compare_digest(derived, expected)
        except Exception:
            return False
    return hmac.compare_digest(candidate, settings.admin_token)


def _extract_admin_session_token(authorization: str | None, x_admin_token: str | None) -> str:
    normalized_auth = (authorization or "").strip()
    if normalized_auth.lower().startswith("bearer "):
        return normalized_auth[7:].strip()
    return (x_admin_token or "").strip()


def require_admin(
    authorization: str | None = Header(default=None, alias="Authorization"),
    x_admin_token: str | None = Header(default=None, alias="X-Admin-Token"),
) -> None:
    session_token = _extract_admin_session_token(authorization, x_admin_token)
    if admin_sessions.validate(session_token):
        return
    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Sessao administrativa invalida ou expirada.")


def load_custom_template_or_404(db: Session, template_id: int) -> CustomStickerTemplate:
    template = db.execute(
        select(CustomStickerTemplate)
        .options(
            selectinload(CustomStickerTemplate.layers),
            selectinload(CustomStickerTemplate.photo_slot),
            selectinload(CustomStickerTemplate.text_slots),
        )
        .where(CustomStickerTemplate.id == template_id)
    ).scalar_one_or_none()
    if not template:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template da Minha Figurinha nao encontrado.")
    return template


def load_custom_template_layer_or_404(template: CustomStickerTemplate, layer_id: int) -> CustomStickerTemplateLayer:
    layer = next((item for item in template.layers if item.id == layer_id), None)
    if not layer:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Camada do template nao encontrada.")
    return layer


def apply_custom_template_payload(template: CustomStickerTemplate, payload: CustomTemplateCreate | CustomTemplateUpdate) -> None:
    template.album_id = payload.album_id
    template.name = payload.name.strip()
    template.profile_type = normalize_custom_profile_type(payload.profile_type)
    template.category_type = payload.category_type
    template.position_type = payload.position_type
    template.composition_mode = payload.composition_mode
    template.sort_order = payload.sort_order
    template.is_active = payload.is_active

    template.layers.clear()
    seen_singleton_types: set[CustomTemplateLayerType] = set()
    for layer in payload.layers:
        if layer.layer_type != CustomTemplateLayerType.OVERLAY:
            if layer.layer_type in seen_singleton_types:
                continue
            seen_singleton_types.add(layer.layer_type)
        template.layers.append(
            CustomStickerTemplateLayer(
                layer_type=layer.layer_type,
                label=layer.label.strip(),
                file_path=(layer.file_path or "").strip() or None,
                z_index=layer.z_index,
                is_active=layer.is_active,
            )
        )

    if payload.photo_slot is None:
        template.photo_slot = None
    else:
        photo_slot = template.photo_slot or CustomStickerTemplatePhotoSlot()
        photo_slot.x = payload.photo_slot.x
        photo_slot.y = payload.photo_slot.y
        photo_slot.width = payload.photo_slot.width
        photo_slot.height = payload.photo_slot.height
        photo_slot.default_scale = payload.photo_slot.default_scale
        photo_slot.min_scale = payload.photo_slot.min_scale
        photo_slot.max_scale = payload.photo_slot.max_scale
        photo_slot.portrait_z_index = payload.photo_slot.portrait_z_index
        photo_slot.anchor_x = payload.photo_slot.anchor_x
        photo_slot.anchor_y = payload.photo_slot.anchor_y
        photo_slot.visible_x = payload.photo_slot.visible_x
        photo_slot.visible_y = payload.photo_slot.visible_y
        photo_slot.visible_width = payload.photo_slot.visible_width
        photo_slot.visible_height = payload.photo_slot.visible_height
        template.photo_slot = photo_slot

    template.text_slots.clear()
    for slot in payload.text_slots:
        template.text_slots.append(
            CustomStickerTemplateTextSlot(
                field_name=slot.field_name,
                x=slot.x,
                y=slot.y,
                width=slot.width,
                font_size=slot.font_size,
                font_weight=(slot.font_weight or "").strip() or None,
                text_align=(slot.text_align or "").strip() or None,
                color=(slot.color or "").strip() or None,
            )
        )


def selected_stickers_for_album_or_400(
    db: Session,
    album: Album,
    sticker_ids: list[int],
    session_token: str | None = None,
) -> list[Sticker]:
    unique_ids = list(dict.fromkeys(sticker_ids))
    if not unique_ids:
        return []
    public_filter = and_(
        Collection.is_system.is_(False),
        Collection.status == CollectionStatus.PUBLICADA,
        Sticker.source_type == StickerSourceType.PDF,
    )
    private_filter = and_(
        Collection.is_system.is_(True),
        Sticker.source_type == StickerSourceType.GENERATED,
        Sticker.session_token == (session_token or "").strip(),
    )
    statement = (
        select(Sticker)
        .join(Collection, Sticker.collection_id == Collection.id)
        .options(selectinload(Sticker.collection).selectinload(Collection.album), selectinload(Sticker.page))
        .where(
            Collection.album_id == album.id,
            Sticker.active.is_(True),
            Sticker.id.in_(unique_ids),
            or_(public_filter, private_filter),
        )
        .order_by(Collection.sort_order.asc(), Collection.name.asc(), Sticker.sort_order.asc(), Sticker.name.asc())
    )
    stickers = db.execute(statement).scalars().all()
    if not stickers or len(stickers) != len(unique_ids):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Nenhuma figurinha valida foi selecionada.")
    return stickers


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/files/{relative_path:path}")
def download_public_file(request: Request, relative_path: str) -> FileResponse:
    _enforce_public_rate_limit(
        request=request,
        bucket="public_files",
        limit=settings.public_public_file_limit,
    )
    file_path = _resolve_public_storage_path_or_404(relative_path)
    return FileResponse(path=file_path, filename=file_path.name)


@app.get("/service-config", response_model=PublicServiceConfigResponse)
def get_public_service_config(request: Request, db: Session = Depends(get_db)) -> dict:
    _enforce_public_rate_limit(
        request=request,
        bucket="service_config_read",
        limit=settings.public_service_config_limit,
    )
    service_settings = get_or_create_service_settings(db)
    return service_settings_to_response(service_settings, include_sensitive=False)


@app.post("/admin/session", response_model=AdminSessionResponse)
def admin_login(payload: AdminLoginRequest, request: Request) -> dict:
    client_key = _admin_login_client_key(request)
    admin_login_throttle.check_or_raise(client_key)
    if not _verify_admin_password(payload.password):
        admin_login_throttle.register_failure(client_key)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Senha invalida.")
    admin_login_throttle.reset(client_key)
    token, expires_at = admin_sessions.create(ttl_hours=settings.admin_session_ttl_hours)
    return {"token": token, "expires_at": expires_at}


@app.delete("/admin/session", status_code=status.HTTP_204_NO_CONTENT)
def admin_logout(
    authorization: str | None = Header(default=None, alias="Authorization"),
    x_admin_token: str | None = Header(default=None, alias="X-Admin-Token"),
) -> Response:
    admin_sessions.revoke(_extract_admin_session_token(authorization, x_admin_token))
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@app.get("/albums", response_model=list[AlbumResponse])
def list_public_albums(request: Request, db: Session = Depends(get_db)) -> list[dict]:
    _enforce_public_rate_limit(
        request=request,
        bucket="catalog_read",
        limit=settings.public_catalog_limit,
    )
    _track_public_catalog_access(request)
    albums = db.execute(
        select(Album)
        .options(selectinload(Album.collections).selectinload(Collection.album))
        .order_by(Album.sort_order.asc(), Album.name.asc(), Album.id.asc())
    ).scalars().all()

    visible_albums: list[Album] = []
    collection_ids: list[int] = []
    for album in albums:
        published_collections = [
            collection
            for collection in album.collections
            if collection.status == CollectionStatus.PUBLICADA and not collection.is_system
        ]
        if not published_collections:
            continue
        visible_albums.append(album)
        collection_ids.extend(collection.id for collection in published_collections)

    visible_albums = sorted(visible_albums, key=album_sort_key)
    collection_stats_map = collection_stats(db, collection_ids)
    album_stats_map = album_stats(db, [album.id for album in visible_albums])
    responses: list[dict] = []
    for album in visible_albums:
        published_collections = sorted(
            [
                collection
                for collection in album.collections
                if collection.status == CollectionStatus.PUBLICADA and not collection.is_system
            ],
            key=collection_sort_key,
        )
        collection_payload = [
            collection_to_response(
                collection,
                collection_stats_map.get(collection.id, {}),
                include_sensitive=False,
            )
            for collection in published_collections
        ]
        responses.append(album_to_response(album, album_stats_map.get(album.id, {}), collection_payload))
    return responses


@app.get("/collections", response_model=list[CollectionResponse])
def list_public_collections(
    request: Request,
    limit: int = Query(default=settings.public_collection_limit, ge=1, le=settings.public_collection_limit_max),
    offset: int = Query(default=0, ge=0, le=5000),
    db: Session = Depends(get_db),
) -> list[dict]:
    _enforce_public_rate_limit(
        request=request,
        bucket="catalog_read",
        limit=settings.public_catalog_limit,
    )
    collections = db.execute(
        select(Collection)
        .options(selectinload(Collection.album))
        .where(Collection.status == CollectionStatus.PUBLICADA, Collection.is_system.is_(False))
        .order_by(Collection.sort_order.asc(), Collection.name.asc(), Collection.id.asc())
        .limit(limit)
        .offset(offset)
    ).scalars().all()
    stats = collection_stats(db, [collection.id for collection in collections])
    return [
        collection_to_response(collection, stats.get(collection.id, {}), include_sensitive=False)
        for collection in collections
    ]


@app.get("/collections/{slug}", response_model=CollectionResponse)
def get_public_collection(slug: str, request: Request, db: Session = Depends(get_db)) -> dict:
    _enforce_public_rate_limit(
        request=request,
        bucket="catalog_read",
        limit=settings.public_catalog_limit,
    )
    collection = load_collection_by_slug_or_fail(db, slug, public_only=True)
    stats = collection_stats(db, [collection.id])
    return collection_to_response(collection, stats.get(collection.id, {}), include_sensitive=False)


@app.get("/collections/{slug}/stickers", response_model=list[StickerResponse])
def list_public_stickers(
    slug: str,
    request: Request,
    search: str | None = Query(default=None, max_length=120),
    category: StickerCategory | None = None,
    limit: int = Query(default=settings.public_sticker_limit, ge=1, le=settings.public_sticker_limit_max),
    offset: int = Query(default=0, ge=0, le=10000),
    db: Session = Depends(get_db),
) -> list[dict]:
    _enforce_public_rate_limit(
        request=request,
        bucket="catalog_read",
        limit=settings.public_catalog_limit,
    )
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
    statement = statement.limit(limit).offset(offset)
    stickers = db.execute(statement).scalars().all()
    return [sticker_to_response(sticker, include_sensitive=False) for sticker in stickers]


@app.get("/custom-templates", response_model=list[CustomTemplatePublicOption])
def list_public_custom_templates(
    request: Request,
    album_slug: str | None = Query(default=None),
    db: Session = Depends(get_db),
) -> list[dict]:
    _enforce_public_rate_limit(
        request=request,
        bucket="catalog_read",
        limit=settings.public_catalog_limit,
    )
    album_id = load_album_by_slug_or_fail(db, album_slug).id if album_slug else None
    templates = load_active_custom_templates(db, album_id=album_id)
    return [custom_template_to_public_option(template) for template in templates]


@app.get("/public-jobs/{job_id}", response_model=PublicProgressJobResponse)
def get_public_job_status(
    request: Request,
    job_id: str,
    session_token: str = Query(..., min_length=12, max_length=120),
) -> dict:
    _enforce_public_rate_limit(
        request=request,
        bucket="public_job_status",
        limit=settings.public_public_job_status_limit,
        session_token=session_token,
    )
    job = public_progress_jobs.get(job_id, session_token=session_token)
    if not job:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Processo nao encontrado para essa sessao.")
    return _job_response(job)


@app.get("/albums/{album_slug}/my-sticker", response_model=StickerResponse | None)
def get_my_sticker(
    request: Request,
    album_slug: str,
    session_token: str = Query(..., min_length=12, max_length=120),
    db: Session = Depends(get_db),
) -> dict | None:
    _enforce_public_rate_limit(
        request=request,
        bucket="my_sticker_read",
        limit=settings.public_unlock_read_limit,
        session_token=session_token,
    )
    album = load_album_by_slug_or_fail(db, album_slug)
    sticker = load_generated_sticker_for_session(db, album.id, session_token)
    return sticker_to_response(sticker, include_sensitive=False) if sticker else None


@app.post("/albums/{album_slug}/my-sticker-cutout-jobs", response_model=PublicProgressJobResponse)
async def create_my_sticker_cutout_job(
    request: Request,
    album_slug: str,
    session_token: str = Form(..., min_length=12, max_length=120),
    photo: UploadFile = File(...),
    db: Session = Depends(get_db),
) -> dict:
    _enforce_public_rate_limit(
        request=request,
        bucket="my_sticker_cutout_job",
        limit=settings.public_cutout_job_limit,
        session_token=session_token,
    )
    album = load_album_by_slug_or_fail(db, album_slug)
    if not photo.filename:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Envie uma foto valida para remover o fundo.")
    if not (photo.content_type or "").startswith("image/"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Envie uma imagem JPG ou PNG valida.")

    uploaded_photo_bytes = await photo.read()
    if not uploaded_photo_bytes:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="A foto enviada esta vazia.")
    if len(uploaded_photo_bytes) > settings.custom_upload_limit_mb * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"A foto enviada passou do limite de {settings.custom_upload_limit_mb} MB.",
        )

    steps = [
        "Recebendo a foto...",
        "Removendo fundo...",
        "Preparando o retrato...",
        "Gerando o preview...",
        "Finalizando o encaixe...",
    ]
    job = _start_public_job(
        job_type="MANUAL_CUTOUT",
        session_token=session_token,
        album_slug=album_slug,
        title="Preparando encaixe na figurinha",
        subtitle="Vamos remover o fundo e deixar sua foto pronta para ajuste.",
        steps=steps,
    )

    def worker() -> None:
        reporter = _build_job_reporter(job.id, steps)
        try:
            cutout_assets = build_manual_cutout_assets(uploaded_photo_bytes, progress_callback=reporter)
            asset_token = save_prepared_cutout_assets(
                album,
                session_token=session_token,
                cutout_bytes=cutout_assets.cutout_bytes,
                portrait_bytes=cutout_assets.portrait_bytes,
            )
            public_progress_jobs.update(
                job.id,
                status="CONCLUIDO",
                progress=100,
                step_index=len(steps) - 1,
                message="Tudo pronto. Agora ajuste sua foto.",
                result={
                    "image_data_url": f"data:{cutout_assets.preview_mime_type};base64,{base64.b64encode(cutout_assets.portrait_preview_bytes).decode('ascii')}",
                    "portrait_image_data_url": f"data:{cutout_assets.preview_mime_type};base64,{base64.b64encode(cutout_assets.portrait_preview_bytes).decode('ascii')}",
                    "cutout_image_data_url": f"data:{cutout_assets.preview_mime_type};base64,{base64.b64encode(cutout_assets.cutout_preview_bytes).decode('ascii')}",
                    "asset_token": asset_token,
                },
            )
        except Exception as err:
            public_progress_jobs.update(
                job.id,
                status="FALHOU",
                error="Nao foi possivel remover o fundo da foto para a montagem manual.",
                message=str(err),
            )

    if not public_progress_jobs.run(job.id, worker):
        public_progress_jobs.discard(job.id)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="A fila de processamento esta cheia agora. Tente novamente em instantes.",
        )
    return _job_response(job)


@app.post("/albums/{album_slug}/my-sticker-jobs", response_model=PublicProgressJobResponse)
async def create_or_replace_my_sticker_job(
    request: Request,
    album_slug: str,
    session_token: str = Form(..., min_length=12, max_length=120),
    name: str = Form(..., min_length=2, max_length=150),
    profile_type: CustomProfileType = Form(...),
    category_type: CustomCategoryType = Form(default=CustomCategoryType.JOGADOR),
    position_type: CustomPositionType = Form(...),
    template_id: int | None = Form(default=None),
    requested_composition_mode: CustomTemplateCompositionMode | None = Form(default=None),
    birth_date_text: str | None = Form(default=None, max_length=40),
    height_text: str | None = Form(default=None, max_length=40),
    weight_text: str | None = Form(default=None, max_length=40),
    city_or_team: str | None = Form(default=None, max_length=150),
    prepared_cutout_token: str | None = Form(default=None, max_length=120),
    prepared_portrait: UploadFile | None = File(default=None),
    photo_offset_x: float | None = Form(default=0.0),
    photo_offset_y: float | None = Form(default=0.0),
    photo_scale: float | None = Form(default=1.0),
    photo_rotation: float | None = Form(default=0.0),
    photo: UploadFile = File(...),
    db: Session = Depends(get_db),
) -> dict:
    _enforce_public_rate_limit(
        request=request,
        bucket="my_sticker_job",
        limit=settings.public_my_sticker_job_limit,
        session_token=session_token,
    )
    load_album_by_slug_or_fail(db, album_slug)
    if not photo.filename:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Envie uma foto valida para criar a figurinha.")
    if not (photo.content_type or "").startswith("image/"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Envie uma imagem JPG ou PNG valida.")

    uploaded_photo_bytes = await photo.read()
    if not uploaded_photo_bytes:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="A foto enviada esta vazia.")
    if len(uploaded_photo_bytes) > settings.custom_upload_limit_mb * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"A foto enviada passou do limite de {settings.custom_upload_limit_mb} MB.",
        )
    prepared_portrait_bytes: bytes | None = None
    if prepared_portrait and prepared_portrait.filename:
        if prepared_portrait.content_type and not prepared_portrait.content_type.startswith("image/"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="O ajuste fino da foto precisa ser enviado como imagem PNG valida.",
            )
        prepared_portrait_bytes = await prepared_portrait.read()
        if not prepared_portrait_bytes:
            prepared_portrait_bytes = None
        elif len(prepared_portrait_bytes) > settings.custom_upload_limit_mb * 1024 * 1024:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"O ajuste fino da foto passou do limite de {settings.custom_upload_limit_mb} MB.",
            )

    is_ai_job = requested_composition_mode == CustomTemplateCompositionMode.AI_OPTIONAL
    steps = (
        [
            "Validando o modelo...",
            "Preparando a base...",
            "Criando sua figurinha com IA...",
            "Preparando os arquivos finais...",
            "Salvando no album...",
        ]
        if is_ai_job
        else [
            "Validando o modelo...",
            "Preparando o modelo...",
            "Removendo fundo...",
            "Preparando o retrato...",
            "Montando sua figurinha...",
            "Preparando os arquivos finais...",
            "Salvando no album...",
        ]
    )
    job = _start_public_job(
        job_type="CREATE_STICKER_AI" if is_ai_job else "CREATE_STICKER_MANUAL",
        session_token=session_token,
        album_slug=album_slug,
        title="Criando sua figurinha com IA" if is_ai_job else "Incluindo sua figurinha no album",
        subtitle="Esse processo pode levar alguns segundos." if is_ai_job else "Estamos montando sua figurinha com os ajustes escolhidos.",
        steps=steps,
    )

    def worker() -> None:
        worker_db = SessionLocal()
        try:
            album = load_album_by_slug_or_fail(worker_db, album_slug)
            resolved_prepared_portrait_bytes = prepared_portrait_bytes or load_prepared_portrait_bytes(
                album,
                session_token=session_token,
                asset_token=prepared_cutout_token,
            )
            reporter = _build_job_reporter(job.id, steps)
            sticker = upsert_generated_sticker(
                worker_db,
                album=album,
                session_token=session_token,
                template_id=template_id,
                requested_composition_mode=requested_composition_mode,
                name=name,
                profile_type=profile_type,
                category_type=category_type,
                position_type=position_type,
                birth_date_text=birth_date_text,
                height_text=height_text,
                weight_text=weight_text,
                city_or_team=city_or_team,
                uploaded_photo_bytes=uploaded_photo_bytes,
                prepared_portrait_bytes=resolved_prepared_portrait_bytes,
                photo_offset_x=photo_offset_x,
                photo_offset_y=photo_offset_y,
                photo_scale=photo_scale,
                photo_rotation=photo_rotation,
                progress_callback=reporter,
            )
            worker_db.commit()
            sticker = load_sticker_or_fail(worker_db, sticker.id)
            public_progress_jobs.update(
                job.id,
                status="CONCLUIDO",
                progress=100,
                step_index=len(steps) - 1,
                message="Sua figurinha ficou pronta.",
                result=sticker_to_response(sticker, include_sensitive=False),
            )
        except ValueError as err:
            public_progress_jobs.update(
                job.id,
                status="FALHOU",
                error=str(err),
                message=str(err),
            )
        except Exception as err:
            traceback.print_exc()
            error_message = str(err).strip() or "Nao foi possivel concluir a sua figurinha agora."
            public_progress_jobs.update(
                job.id,
                status="FALHOU",
                error=error_message,
                message=error_message,
            )
        finally:
            worker_db.close()

    if not public_progress_jobs.run(job.id, worker):
        public_progress_jobs.discard(job.id)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="A fila de processamento esta cheia agora. Tente novamente em instantes.",
        )
    return _job_response(job)


@app.post("/albums/{album_slug}/my-sticker", response_model=StickerResponse)
async def create_or_replace_my_sticker(
    request: Request,
    album_slug: str,
    session_token: str = Form(..., min_length=12, max_length=120),
    name: str = Form(..., min_length=2, max_length=150),
    profile_type: CustomProfileType = Form(...),
    category_type: CustomCategoryType = Form(default=CustomCategoryType.JOGADOR),
    position_type: CustomPositionType = Form(...),
    template_id: int | None = Form(default=None),
    requested_composition_mode: CustomTemplateCompositionMode | None = Form(default=None),
    birth_date_text: str | None = Form(default=None, max_length=40),
    height_text: str | None = Form(default=None, max_length=40),
    weight_text: str | None = Form(default=None, max_length=40),
    city_or_team: str | None = Form(default=None, max_length=150),
    prepared_cutout_token: str | None = Form(default=None, max_length=120),
    prepared_portrait: UploadFile | None = File(default=None),
    photo_offset_x: float | None = Form(default=0.0),
    photo_offset_y: float | None = Form(default=0.0),
    photo_scale: float | None = Form(default=1.0),
    photo_rotation: float | None = Form(default=0.0),
    photo: UploadFile = File(...),
    db: Session = Depends(get_db),
) -> dict:
    _enforce_public_rate_limit(
        request=request,
        bucket="my_sticker_job",
        limit=settings.public_my_sticker_job_limit,
        session_token=session_token,
    )
    album = load_album_by_slug_or_fail(db, album_slug)
    if not photo.filename:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Envie uma foto valida para criar a figurinha.")
    if not (photo.content_type or "").startswith("image/"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Envie uma imagem JPG ou PNG valida.")

    uploaded_photo_bytes = await photo.read()
    if not uploaded_photo_bytes:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="A foto enviada esta vazia.")
    if len(uploaded_photo_bytes) > settings.custom_upload_limit_mb * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"A foto enviada passou do limite de {settings.custom_upload_limit_mb} MB.",
        )
    prepared_portrait_bytes: bytes | None = None
    if prepared_portrait and prepared_portrait.filename:
        if prepared_portrait.content_type and not prepared_portrait.content_type.startswith("image/"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="O ajuste fino da foto precisa ser enviado como imagem PNG valida.",
            )
        prepared_portrait_bytes = await prepared_portrait.read()
        if not prepared_portrait_bytes:
            prepared_portrait_bytes = None
        elif len(prepared_portrait_bytes) > settings.custom_upload_limit_mb * 1024 * 1024:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"O ajuste fino da foto passou do limite de {settings.custom_upload_limit_mb} MB.",
            )

    try:
        prepared_portrait_bytes = prepared_portrait_bytes or load_prepared_portrait_bytes(
            album,
            session_token=session_token,
            asset_token=prepared_cutout_token,
        )
        sticker = upsert_generated_sticker(
            db,
            album=album,
            session_token=session_token,
            template_id=template_id,
            requested_composition_mode=requested_composition_mode,
            name=name,
            profile_type=profile_type,
            category_type=category_type,
            position_type=position_type,
            birth_date_text=birth_date_text,
            height_text=height_text,
            weight_text=weight_text,
            city_or_team=city_or_team,
            uploaded_photo_bytes=uploaded_photo_bytes,
            prepared_portrait_bytes=prepared_portrait_bytes,
            photo_offset_x=photo_offset_x,
            photo_offset_y=photo_offset_y,
            photo_scale=photo_scale,
            photo_rotation=photo_rotation,
        )
    except ValueError as err:
        status_code_override = (
            status.HTTP_402_PAYMENT_REQUIRED
            if "Pague para liberar a criacao com IA" in str(err)
            else status.HTTP_400_BAD_REQUEST
        )
        raise HTTPException(status_code=status_code_override, detail=str(err)) from err

    db.commit()
    sticker = load_sticker_or_fail(db, sticker.id)
    return sticker_to_response(sticker, include_sensitive=False)


@app.post("/albums/{album_slug}/my-sticker-cutout", response_model=MyStickerCutoutResponse)
async def create_my_sticker_cutout(
    request: Request,
    album_slug: str,
    session_token: str = Form(..., min_length=12, max_length=120),
    photo: UploadFile = File(...),
    db: Session = Depends(get_db),
) -> dict:
    _enforce_public_rate_limit(
        request=request,
        bucket="my_sticker_cutout_job",
        limit=settings.public_cutout_job_limit,
        session_token=session_token,
    )
    album = load_album_by_slug_or_fail(db, album_slug)
    if not photo.filename:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Envie uma foto valida para remover o fundo.")
    if not (photo.content_type or "").startswith("image/"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Envie uma imagem JPG ou PNG valida.")

    uploaded_photo_bytes = await photo.read()
    if not uploaded_photo_bytes:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="A foto enviada esta vazia.")
    if len(uploaded_photo_bytes) > settings.custom_upload_limit_mb * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"A foto enviada passou do limite de {settings.custom_upload_limit_mb} MB.",
        )

    try:
        cutout_assets = build_manual_cutout_assets(uploaded_photo_bytes)
        asset_token = save_prepared_cutout_assets(
            album,
            session_token=session_token,
            cutout_bytes=cutout_assets.cutout_bytes,
            portrait_bytes=cutout_assets.portrait_bytes,
        )
    except Exception as err:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Nao foi possivel remover o fundo da foto para a montagem manual.",
        ) from err

    return {
        "image_data_url": f"data:{cutout_assets.preview_mime_type};base64,{base64.b64encode(cutout_assets.portrait_preview_bytes).decode('ascii')}",
        "portrait_image_data_url": f"data:{cutout_assets.preview_mime_type};base64,{base64.b64encode(cutout_assets.portrait_preview_bytes).decode('ascii')}",
        "cutout_image_data_url": f"data:{cutout_assets.preview_mime_type};base64,{base64.b64encode(cutout_assets.cutout_preview_bytes).decode('ascii')}",
        "asset_token": asset_token,
    }


@app.delete("/albums/{album_slug}/my-sticker/{sticker_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_my_sticker(
    album_slug: str,
    sticker_id: int,
    session_token: str = Query(..., min_length=12, max_length=120),
    db: Session = Depends(get_db),
) -> Response:
    album = load_album_by_slug_or_fail(db, album_slug)
    sticker = load_sticker_or_fail(db, sticker_id)
    if (
        sticker.collection.album_id != album.id
        or sticker.source_type != StickerSourceType.GENERATED
        or sticker.session_token != session_token.strip()
    ):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Minha Figurinha nao encontrada para essa sessao.")

    delete_generated_stickers_for_session(db, album.id, session_token)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


def _get_my_sticker_unlock_by_type(
    *,
    album_slug: str,
    session_token: str,
    unlock_type: CustomStickerUnlockType,
    db: Session,
) -> dict | None:
    try:
        album = load_album_by_slug_or_fail(db, album_slug)
    except LookupError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    service_settings = get_or_create_service_settings(db)
    unlock = load_latest_custom_sticker_unlock(
        db,
        album_id=album.id,
        session_token=session_token,
        unlock_type=unlock_type,
    )
    if not unlock:
        return None
    if unlock.status == CustomStickerUnlockStatus.PENDENTE:
        sync_custom_sticker_unlock_status(unlock)
        if unlock.status == CustomStickerUnlockStatus.PENDENTE and not pending_custom_sticker_unlock_matches_settings(
            unlock,
            service_settings,
            unlock_type,
        ):
            unlock.status = CustomStickerUnlockStatus.EXPIRADO
            unlock.mp_status_detail = "price_changed"
        db.commit()
        db.refresh(unlock)
        if unlock.status == CustomStickerUnlockStatus.EXPIRADO and unlock.mp_status_detail == "price_changed":
            return None
    available_unlock = load_available_custom_sticker_unlock(
        db,
        album_id=album.id,
        session_token=session_token,
        unlock_type=unlock_type,
    )
    if available_unlock:
        return custom_sticker_unlock_to_response(available_unlock, service_settings)
    return custom_sticker_unlock_to_response(unlock, service_settings)


def _create_my_sticker_unlock_by_type(
    *,
    album_slug: str,
    payload: CustomStickerUnlockRequest,
    unlock_type: CustomStickerUnlockType,
    db: Session,
) -> dict:
    try:
        album = load_album_by_slug_or_fail(db, album_slug)
    except LookupError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    service_settings = get_or_create_service_settings(db)
    sticker = load_generated_sticker_for_session(db, album.id, payload.session_token)
    if unlock_type == CustomStickerUnlockType.MANUAL_PDF:
        if not sticker:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Crie a Minha Figurinha manual antes de liberar o PDF completo.",
            )
        if sticker.composition_mode_used == CustomTemplateCompositionMode.AI_OPTIONAL:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Essa figurinha foi criada com IA e nao precisa da cobranca manual no PDF.",
            )
    try:
        unlock = get_or_create_custom_sticker_unlock(
            db,
            album=album,
            sticker=sticker,
            session_token=payload.session_token,
            service_settings=service_settings,
            unlock_type=unlock_type,
        )
    except ValueError as err:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(err)) from err
    except MercadoPagoError as err:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(err)) from err
    db.commit()
    db.refresh(unlock)
    return custom_sticker_unlock_to_response(unlock, service_settings)


@app.get("/albums/{album_slug}/my-sticker-unlock", response_model=CustomStickerUnlockResponse | None)
def get_my_sticker_unlock(
    request: Request,
    album_slug: str,
    session_token: str = Query(..., min_length=12, max_length=120),
    db: Session = Depends(get_db),
) -> dict | None:
    _enforce_public_rate_limit(
        request=request,
        bucket="unlock_read",
        limit=settings.public_unlock_read_limit,
        session_token=session_token,
    )
    return _get_my_sticker_unlock_by_type(
        album_slug=album_slug,
        session_token=session_token,
        unlock_type=CustomStickerUnlockType.MANUAL_PDF,
        db=db,
    )


@app.post("/albums/{album_slug}/my-sticker-unlock", response_model=CustomStickerUnlockResponse)
def create_my_sticker_unlock(
    request: Request,
    album_slug: str,
    payload: CustomStickerUnlockRequest,
    db: Session = Depends(get_db),
) -> dict:
    _enforce_public_rate_limit(
        request=request,
        bucket="unlock_create",
        limit=settings.public_unlock_limit,
        session_token=payload.session_token,
    )
    return _create_my_sticker_unlock_by_type(
        album_slug=album_slug,
        payload=payload,
        unlock_type=CustomStickerUnlockType.MANUAL_PDF,
        db=db,
    )


@app.get("/albums/{album_slug}/my-sticker/manual-unlock", response_model=CustomStickerUnlockResponse | None)
def get_my_sticker_manual_unlock(
    request: Request,
    album_slug: str,
    session_token: str = Query(..., min_length=12, max_length=120),
    db: Session = Depends(get_db),
) -> dict | None:
    _enforce_public_rate_limit(
        request=request,
        bucket="unlock_read",
        limit=settings.public_unlock_read_limit,
        session_token=session_token,
    )
    return _get_my_sticker_unlock_by_type(
        album_slug=album_slug,
        session_token=session_token,
        unlock_type=CustomStickerUnlockType.MANUAL_PDF,
        db=db,
    )


@app.post("/albums/{album_slug}/my-sticker/manual-unlock", response_model=CustomStickerUnlockResponse)
def create_my_sticker_manual_unlock(
    request: Request,
    album_slug: str,
    payload: CustomStickerUnlockRequest,
    db: Session = Depends(get_db),
) -> dict:
    _enforce_public_rate_limit(
        request=request,
        bucket="unlock_create",
        limit=settings.public_unlock_limit,
        session_token=payload.session_token,
    )
    return _create_my_sticker_unlock_by_type(
        album_slug=album_slug,
        payload=payload,
        unlock_type=CustomStickerUnlockType.MANUAL_PDF,
        db=db,
    )


@app.get("/albums/{album_slug}/my-sticker/ai-unlock", response_model=CustomStickerUnlockResponse | None)
def get_my_sticker_ai_unlock(
    request: Request,
    album_slug: str,
    session_token: str = Query(..., min_length=12, max_length=120),
    db: Session = Depends(get_db),
) -> dict | None:
    _enforce_public_rate_limit(
        request=request,
        bucket="unlock_read",
        limit=settings.public_unlock_read_limit,
        session_token=session_token,
    )
    return _get_my_sticker_unlock_by_type(
        album_slug=album_slug,
        session_token=session_token,
        unlock_type=CustomStickerUnlockType.AI_CREATE,
        db=db,
    )


@app.post("/albums/{album_slug}/my-sticker/ai-unlock", response_model=CustomStickerUnlockResponse)
def create_my_sticker_ai_unlock(
    request: Request,
    album_slug: str,
    payload: CustomStickerUnlockRequest,
    db: Session = Depends(get_db),
) -> dict:
    _enforce_public_rate_limit(
        request=request,
        bucket="unlock_create",
        limit=settings.public_unlock_limit,
        session_token=payload.session_token,
    )
    return _create_my_sticker_unlock_by_type(
        album_slug=album_slug,
        payload=payload,
        unlock_type=CustomStickerUnlockType.AI_CREATE,
        db=db,
    )


@app.post("/exports/jobs", response_model=PublicProgressJobResponse)
def create_export_job(payload: ExportRequest, request: Request, db: Session = Depends(get_db)) -> dict:
    _enforce_public_rate_limit(
        request=request,
        bucket="export_create",
        limit=settings.public_export_limit,
        session_token=payload.session_token,
    )
    album = load_album_by_slug_or_fail(db, payload.album_slug)
    steps = [
        "Separando suas figurinhas...",
        "Montando as paginas...",
        "Gerando o PDF...",
        "Finalizando download...",
    ]
    job = _start_public_job(
        job_type="EXPORT_PDF",
        session_token=payload.session_token or "",
        album_slug=payload.album_slug,
        title="Preparando seu PDF",
        subtitle="Estamos montando o arquivo para baixar.",
        steps=steps,
    )

    def worker() -> None:
        worker_db = SessionLocal()
        try:
            worker_album = load_album_by_slug_or_fail(worker_db, payload.album_slug)
            stickers = selected_stickers_for_album_or_400(
                worker_db,
                worker_album,
                payload.sticker_ids,
                payload.session_token,
            )
            service_settings = get_or_create_service_settings(worker_db)
            generated_sticker = generated_sticker_for_selection(stickers)
            if not generated_sticker_has_export_access(
                worker_db,
                album_id=worker_album.id,
                session_token=(payload.session_token or ""),
                sticker=generated_sticker,
                service_settings=service_settings,
            ):
                if generated_sticker and generated_sticker.composition_mode_used == CustomTemplateCompositionMode.AI_OPTIONAL:
                    raise ValueError("Pague para liberar a criacao com IA antes de usar essa figurinha no PDF.")
                raise ValueError("Pague para liberar o PDF com a Minha Figurinha ou baixe gratis sem ela.")
            reporter = _build_job_reporter(job.id, steps)
            export_record = build_export_pdf(
                worker_album,
                stickers,
                worker_db,
                extra_selections=[item.model_dump() for item in payload.extras],
                progress_callback=reporter,
            )
            if generated_sticker_requires_manual_unlock(generated_sticker, service_settings):
                consume_custom_sticker_unlock_use(
                    worker_db,
                    album_id=worker_album.id,
                    session_token=(payload.session_token or ""),
                    unlock_type=CustomStickerUnlockType.MANUAL_PDF,
                )
            worker_db.commit()
            public_progress_jobs.update(
                job.id,
                status="CONCLUIDO",
                progress=100,
                step_index=len(steps) - 1,
                message="Download iniciando...",
                result={
                    "export_id": export_record.id,
                    "item_count": export_record.item_count,
                    "download_path": _build_export_download_path(export_record.id),
                    "file_name": Path(export_record.file_path).name,
                },
            )
        except ValueError as err:
            public_progress_jobs.update(
                job.id,
                status="FALHOU",
                error=str(err),
                message=str(err),
            )
        except Exception as err:
            public_progress_jobs.update(
                job.id,
                status="FALHOU",
                error="Nao foi possivel gerar o PDF agora.",
                message=str(err),
            )
        finally:
            worker_db.close()

    if not public_progress_jobs.run(job.id, worker):
        public_progress_jobs.discard(job.id)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="A fila de processamento esta cheia agora. Tente novamente em instantes.",
        )
    return _job_response(job)


@app.post("/exports", response_model=ExportResponse)
def create_export(payload: ExportRequest, request: Request, db: Session = Depends(get_db)) -> dict:
    _enforce_public_rate_limit(
        request=request,
        bucket="export_create",
        limit=settings.public_export_limit,
        session_token=payload.session_token,
    )
    album = load_album_by_slug_or_fail(db, payload.album_slug)
    stickers = selected_stickers_for_album_or_400(db, album, payload.sticker_ids, payload.session_token)
    service_settings = get_or_create_service_settings(db)
    generated_sticker = generated_sticker_for_selection(stickers)
    if not generated_sticker_has_export_access(
        db,
        album_id=album.id,
        session_token=(payload.session_token or ""),
        sticker=generated_sticker,
        service_settings=service_settings,
    ):
        if generated_sticker and generated_sticker.composition_mode_used == CustomTemplateCompositionMode.AI_OPTIONAL:
            raise HTTPException(
                status_code=status.HTTP_402_PAYMENT_REQUIRED,
                detail="Pague para liberar a criacao com IA antes de usar essa figurinha no PDF.",
            )
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail="Pague para liberar o PDF com a Minha Figurinha ou baixe gratis sem ela.",
        )
    export_record = build_export_pdf(
        album,
        stickers,
        db,
        extra_selections=[item.model_dump() for item in payload.extras],
    )
    if generated_sticker_requires_manual_unlock(generated_sticker, service_settings):
        consume_custom_sticker_unlock_use(
            db,
            album_id=album.id,
            session_token=(payload.session_token or ""),
            unlock_type=CustomStickerUnlockType.MANUAL_PDF,
        )
    db.commit()
    return {
        "export_id": export_record.id,
        "item_count": export_record.item_count,
        "download_path": _build_export_download_path(export_record.id),
        "file_name": Path(export_record.file_path).name,
    }


@app.post("/orders/quote", response_model=OrderQuoteResponse)
def quote_print_order(payload: OrderQuoteRequest, request: Request, db: Session = Depends(get_db)) -> dict:
    _enforce_public_rate_limit(
        request=request,
        bucket="quote_order",
        limit=settings.public_quote_limit,
        session_token=payload.session_token,
    )
    album = load_album_by_slug_or_fail(db, payload.album_slug)
    stickers = selected_stickers_for_album_or_400(db, album, payload.sticker_ids, payload.session_token)
    service_settings = get_or_create_service_settings(db)
    quote = build_order_quote_with_extras(
        album,
        stickers,
        [item.model_dump() for item in payload.extras],
        db,
        service_settings,
    )
    quote.pop("plan", None)
    return quote


@app.post("/orders", response_model=PrintOrderResponse)
def create_public_print_order(payload: PrintOrderCreate, request: Request, db: Session = Depends(get_db)) -> dict:
    _enforce_public_rate_limit(
        request=request,
        bucket="create_order",
        limit=settings.public_order_limit,
        session_token=payload.session_token,
    )
    album = load_album_by_slug_or_fail(db, payload.album_slug)
    stickers = selected_stickers_for_album_or_400(db, album, payload.sticker_ids, payload.session_token)
    service_settings = get_or_create_service_settings(db)
    try:
        order = create_print_order(
            db=db,
            album=album,
            stickers=stickers,
            extra_selections=[item.model_dump() for item in payload.extras],
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
def download_export(
    request: Request,
    export_id: int,
    expires: int = Query(...),
    token: str = Query(..., min_length=32, max_length=128),
    db: Session = Depends(get_db),
) -> FileResponse:
    from .models import Export

    _enforce_public_rate_limit(
        request=request,
        bucket="export_download",
        limit=settings.public_download_limit,
    )
    _validate_export_download_token_or_403(export_id, expires, token)
    export_record = db.get(Export, export_id)
    if not export_record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Exportacao nao encontrada.")
    file_path = settings.storage_root / export_record.file_path
    if not file_path.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Arquivo da exportacao nao encontrado.")
    return FileResponse(path=file_path, filename=file_path.name, media_type="application/pdf")


@app.get("/admin/collections", response_model=list[CollectionResponse], dependencies=[Depends(require_admin)])
def list_admin_collections(db: Session = Depends(get_db)) -> list[dict]:
    collections = db.execute(
        select(Collection)
        .options(selectinload(Collection.album))
        .where(Collection.is_system.is_(False))
        .order_by(Collection.sort_order.asc(), Collection.name.asc(), Collection.id.asc())
    ).scalars().all()
    stats = collection_stats(db, [collection.id for collection in collections])
    return [collection_to_response(collection, stats.get(collection.id, {})) for collection in collections]


@app.get("/admin/albums", response_model=list[AlbumResponse], dependencies=[Depends(require_admin)])
def list_admin_albums(db: Session = Depends(get_db)) -> list[dict]:
    albums = db.execute(
        select(Album)
        .options(selectinload(Album.collections).selectinload(Collection.album))
        .order_by(Album.sort_order.asc(), Album.name.asc(), Album.id.asc())
    ).scalars().all()
    album_stats_map = album_stats(db, [album.id for album in albums])
    collection_stats_map = collection_stats(
        db,
        [collection.id for album in albums for collection in album.collections],
    )
    return [
        album_to_response(
            album,
            album_stats_map.get(album.id, {}),
            [
                collection_to_response(collection, collection_stats_map.get(collection.id, {}))
                for collection in sorted(
                    [collection for collection in album.collections if not collection.is_system],
                    key=collection_sort_key,
                )
            ],
        )
        for album in albums
    ]


@app.get(
    "/admin/source-documents",
    response_model=list[SourceDocumentSummaryResponse],
    dependencies=[Depends(require_admin)],
)
def list_admin_source_documents(
    album_id: int | None = Query(default=None),
    db: Session = Depends(get_db),
) -> list[dict]:
    statement = (
        select(SourceDocument)
        .options(
            selectinload(SourceDocument.album),
            selectinload(SourceDocument.pages).selectinload(SourceDocumentPage.blocks),
            selectinload(SourceDocument.detected_stickers),
        )
        .order_by(SourceDocument.updated_at.desc(), SourceDocument.id.desc())
    )
    if album_id is not None:
        statement = statement.where(SourceDocument.album_id == album_id)
    documents = db.execute(statement).scalars().all()
    return [source_document_to_summary_response(document) for document in documents]


@app.get(
    "/admin/source-documents/{document_id}",
    response_model=SourceDocumentDetailResponse,
    dependencies=[Depends(require_admin)],
)
def get_admin_source_document(document_id: int, db: Session = Depends(get_db)) -> dict:
    try:
        document = load_source_document_or_fail(db, document_id)
    except LookupError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return source_document_to_detail_response(document)


@app.get(
    "/admin/source-documents/{document_id}/pages",
    response_model=list[SourceDocumentPageResponse],
    dependencies=[Depends(require_admin)],
)
def list_admin_source_document_pages(document_id: int, db: Session = Depends(get_db)) -> list[dict]:
    try:
        document = load_source_document_or_fail(db, document_id)
    except LookupError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return [source_document_page_to_response(page) for page in document.pages]


@app.post(
    "/admin/source-documents/{document_id}/detect-stickers",
    response_model=AutoDetectResponse,
    dependencies=[Depends(require_admin)],
)
def detect_source_document_stickers(
    document_id: int,
    replace_existing: bool = Query(default=True),
    db: Session = Depends(get_db),
) -> dict:
    try:
        document = load_source_document_or_fail(db, document_id)
        response = auto_detect_source_document_stickers(db, document, replace_existing=replace_existing)
    except LookupError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except FileNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    db.commit()
    return response


@app.get(
    "/admin/source-document-pages/{page_id}/detected-stickers",
    response_model=list[SourceDetectedStickerResponse],
    dependencies=[Depends(require_admin)],
)
def list_source_document_page_detected_stickers(page_id: int, db: Session = Depends(get_db)) -> list[dict]:
    try:
        page = load_source_document_page_or_fail(db, page_id)
    except LookupError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return [source_detected_sticker_to_response(detected_sticker) for detected_sticker in page.detected_stickers]


@app.post(
    "/admin/source-documents/{document_id}/assign-detected-stickers",
    response_model=SourceDetectedStickerBulkActionResponse,
    dependencies=[Depends(require_admin)],
)
def assign_detected_stickers_to_collection(
    document_id: int,
    payload: SourceDetectedStickerAssignRequest,
    db: Session = Depends(get_db),
) -> dict:
    try:
        document = load_source_document_or_fail(db, document_id)
        collection = load_collection_or_fail(db, payload.collection_id)
        response = assign_source_detected_stickers(
            db,
            document,
            collection=collection,
            detected_sticker_ids=payload.detected_sticker_ids,
        )
    except LookupError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except FileNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    db.commit()
    return response


@app.post(
    "/admin/source-documents/{document_id}/discard-detected-stickers",
    response_model=SourceDetectedStickerBulkActionResponse,
    dependencies=[Depends(require_admin)],
)
def discard_detected_source_stickers(
    document_id: int,
    payload: SourceDetectedStickerBulkActionRequest,
    db: Session = Depends(get_db),
) -> dict:
    try:
        document = load_source_document_or_fail(db, document_id)
        response = discard_source_detected_stickers(
            db,
            document,
            detected_sticker_ids=payload.detected_sticker_ids,
        )
    except LookupError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    db.commit()
    return response


@app.post(
    "/admin/source-documents/{document_id}/unassign-detected-stickers",
    response_model=SourceDetectedStickerBulkActionResponse,
    dependencies=[Depends(require_admin)],
)
def unassign_detected_source_stickers(
    document_id: int,
    payload: SourceDetectedStickerBulkActionRequest,
    db: Session = Depends(get_db),
) -> dict:
    try:
        document = load_source_document_or_fail(db, document_id)
        response = unassign_source_detected_stickers(
            db,
            document,
            detected_sticker_ids=payload.detected_sticker_ids,
        )
    except LookupError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    db.commit()
    return response


@app.get(
    "/admin/page-layout-templates",
    response_model=list[PageLayoutTemplateResponse],
    dependencies=[Depends(require_admin)],
)
def list_admin_page_layout_templates(
    album_id: int | None = Query(default=None),
    db: Session = Depends(get_db),
) -> list[dict]:
    statement = (
        select(PageLayoutTemplate)
        .options(
            selectinload(PageLayoutTemplate.album),
            selectinload(PageLayoutTemplate.blocks).selectinload(PageLayoutTemplateBlock.collection),
        )
        .order_by(PageLayoutTemplate.created_at.desc(), PageLayoutTemplate.id.desc())
    )
    if album_id is not None:
        statement = statement.where(PageLayoutTemplate.album_id == album_id)
    templates = db.execute(statement).scalars().all()
    return [page_layout_template_to_response(template) for template in templates]


@app.post(
    "/admin/source-documents",
    response_model=SourceDocumentDetailResponse,
    dependencies=[Depends(require_admin)],
)
async def create_source_document(
    album_id: int = Form(...),
    title: str = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
) -> dict:
    try:
        album = load_album_or_fail(db, album_id)
    except LookupError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Envie um arquivo PDF valido.")
    upload_bytes = await file.read()
    if not upload_bytes:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="O arquivo PDF esta vazio.")
    normalized_title = (title or "").strip()
    if len(normalized_title) < 2:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Informe um titulo para o documento.")

    document = SourceDocument(
        album=album,
        title=normalized_title[:150],
        pdf_path="",
    )
    try:
        db.add(document)
        db.flush()
        save_source_document_and_render_pages(document, file.filename, upload_bytes, db)
        db.commit()
    except Exception as exc:
        db.rollback()
        detail = str(exc).strip()
        if detail:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Nao consegui processar esse PDF. {detail}",
            ) from exc
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Nao consegui processar esse PDF agora. Verifique se ele nao esta corrompido, protegido ou fora do padrao esperado.",
        ) from exc
    document = load_source_document_or_fail(db, document.id)
    return source_document_to_detail_response(document)


@app.delete(
    "/admin/source-documents/{document_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_admin)],
)
def delete_admin_source_document(document_id: int, db: Session = Depends(get_db)) -> Response:
    try:
        document = load_source_document_or_fail(db, document_id)
    except LookupError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    delete_source_document_record(db, document)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@app.post(
    "/admin/source-document-pages/{page_id}/layout-templates",
    response_model=PageLayoutTemplateResponse,
    dependencies=[Depends(require_admin)],
)
def create_page_layout_template(
    page_id: int,
    payload: PageLayoutTemplateCreate,
    db: Session = Depends(get_db),
) -> dict:
    try:
        page = load_source_document_page_or_fail(db, page_id)
        template = create_page_layout_template_from_source_page(db, page, name=payload.name)
    except LookupError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    db.commit()
    return page_layout_template_to_response(template)


@app.post(
    "/admin/page-layout-templates/{template_id}/apply-to-page/{page_id}",
    response_model=SourceDocumentPageResponse,
    dependencies=[Depends(require_admin)],
)
def apply_page_layout_template(
    template_id: int,
    page_id: int,
    replace_existing: bool = Query(default=True),
    db: Session = Depends(get_db),
) -> dict:
    try:
        template = load_page_layout_template_or_fail(db, template_id)
        page = load_source_document_page_or_fail(db, page_id)
        updated_page = apply_page_layout_template_to_source_page(
            db,
            template,
            page,
            replace_existing=replace_existing,
        )
    except LookupError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    db.commit()
    return source_document_page_to_response(updated_page)


@app.delete(
    "/admin/page-layout-templates/{template_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_admin)],
)
def delete_page_layout_template(template_id: int, db: Session = Depends(get_db)) -> Response:
    try:
        template = load_page_layout_template_or_fail(db, template_id)
    except LookupError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    db.delete(template)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


def _validate_page_selection_block_bounds(*, x: float, y: float, width: float, height: float) -> None:
    if x + width > 1.000001 or y + height > 1.000001:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="O bloco precisa caber dentro da pagina renderizada.",
        )


@app.post(
    "/admin/source-document-pages/{page_id}/blocks",
    response_model=PageSelectionBlockResponse,
    dependencies=[Depends(require_admin)],
)
def create_page_selection_block(page_id: int, payload: PageSelectionBlockCreate, db: Session = Depends(get_db)) -> dict:
    try:
        page = load_source_document_page_or_fail(db, page_id)
        collection = load_collection_or_fail(db, payload.collection_id)
    except LookupError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc

    if collection.album_id != page.document.album_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Escolha uma selecao do mesmo album desse documento fonte.",
        )
    _validate_page_selection_block_bounds(x=payload.x, y=payload.y, width=payload.width, height=payload.height)

    next_sort_order = payload.sort_order or (
        max((existing.sort_order for existing in page.blocks), default=0) + 1
    )
    block = PageSelectionBlock(
        page_id=page.id,
        collection_id=collection.id,
        label=(payload.label or "").strip() or collection.name,
        x=round(payload.x, 6),
        y=round(payload.y, 6),
        width=round(payload.width, 6),
        height=round(payload.height, 6),
        sort_order=next_sort_order,
    )
    db.add(block)
    db.commit()
    block = load_page_selection_block_or_fail(db, block.id)
    return page_selection_block_to_response(block)


@app.put(
    "/admin/page-selection-blocks/{block_id}",
    response_model=PageSelectionBlockResponse,
    dependencies=[Depends(require_admin)],
)
def update_page_selection_block(block_id: int, payload: PageSelectionBlockUpdate, db: Session = Depends(get_db)) -> dict:
    try:
        block = load_page_selection_block_or_fail(db, block_id)
        collection = load_collection_or_fail(db, payload.collection_id)
    except LookupError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc

    if collection.album_id != block.page.document.album_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Escolha uma selecao do mesmo album desse documento fonte.",
        )
    _validate_page_selection_block_bounds(x=payload.x, y=payload.y, width=payload.width, height=payload.height)

    block.collection_id = collection.id
    block.label = (payload.label or "").strip() or collection.name
    block.x = round(payload.x, 6)
    block.y = round(payload.y, 6)
    block.width = round(payload.width, 6)
    block.height = round(payload.height, 6)
    block.sort_order = payload.sort_order
    db.commit()
    block = load_page_selection_block_or_fail(db, block.id)
    return page_selection_block_to_response(block)


@app.delete(
    "/admin/page-selection-blocks/{block_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_admin)],
)
def delete_page_selection_block(block_id: int, db: Session = Depends(get_db)) -> Response:
    try:
        block = load_page_selection_block_or_fail(db, block_id)
    except LookupError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    db.delete(block)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@app.post(
    "/admin/page-selection-blocks/{block_id}/duplicate",
    response_model=PageSelectionBlockResponse,
    dependencies=[Depends(require_admin)],
)
def duplicate_source_page_selection_block(block_id: int, db: Session = Depends(get_db)) -> dict:
    try:
        block = load_page_selection_block_or_fail(db, block_id)
        duplicated = duplicate_page_selection_block(db, block)
    except LookupError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    db.commit()
    return page_selection_block_to_response(duplicated)


@app.post(
    "/admin/source-document-pages/{page_id}/duplicate-previous-blocks",
    response_model=SourceDocumentPageResponse,
    dependencies=[Depends(require_admin)],
)
def duplicate_previous_source_page_blocks(
    page_id: int,
    replace_existing: bool = Query(default=True),
    db: Session = Depends(get_db),
) -> dict:
    try:
        page = load_source_document_page_or_fail(db, page_id)
        updated_page = duplicate_blocks_from_previous_source_page(db, page, replace_existing=replace_existing)
    except LookupError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    db.commit()
    return source_document_page_to_response(updated_page)


@app.post(
    "/admin/page-selection-blocks/{block_id}/detect-stickers",
    response_model=BlockDetectResponse,
    dependencies=[Depends(require_admin)],
)
def detect_stickers_inside_source_block(
    block_id: int,
    replace_existing: bool = Query(default=True),
    db: Session = Depends(get_db),
) -> dict:
    try:
        block = load_page_selection_block_or_fail(db, block_id)
        response = auto_detect_source_block_stickers(db, block, replace_existing=replace_existing)
    except LookupError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except FileNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    db.commit()
    return response


@app.get(
    "/admin/page-selection-blocks/{block_id}/stickers",
    response_model=list[StickerResponse],
    dependencies=[Depends(require_admin)],
)
def list_source_block_stickers(block_id: int, db: Session = Depends(get_db)) -> list[dict]:
    try:
        load_page_selection_block_or_fail(db, block_id)
    except LookupError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc

    stickers = db.execute(
        select(Sticker)
        .options(selectinload(Sticker.collection), selectinload(Sticker.page))
        .where(Sticker.source_block_id == block_id)
        .order_by(Sticker.sort_order.asc(), Sticker.id.asc())
    ).scalars().all()
    return [sticker_to_response(sticker) for sticker in stickers]


@app.get(
    "/admin/custom-templates",
    response_model=list[CustomTemplateSummaryResponse],
    dependencies=[Depends(require_admin)],
)
def list_admin_custom_templates(
    album_id: int | None = Query(default=None),
    db: Session = Depends(get_db),
) -> list[dict]:
    statement = (
        select(CustomStickerTemplate)
        .options(
            selectinload(CustomStickerTemplate.layers),
            selectinload(CustomStickerTemplate.photo_slot),
            selectinload(CustomStickerTemplate.text_slots),
        )
        .order_by(
            CustomStickerTemplate.sort_order.asc(),
            CustomStickerTemplate.profile_type.asc(),
            CustomStickerTemplate.position_type.asc(),
            CustomStickerTemplate.id.asc(),
        )
    )
    if album_id is not None:
        statement = statement.where(CustomStickerTemplate.album_id == album_id)
    templates = db.execute(statement).scalars().all()
    return [custom_template_to_summary_response(template) for template in templates]


@app.post(
    "/admin/custom-templates",
    response_model=CustomTemplateDetailResponse,
    dependencies=[Depends(require_admin)],
)
def create_admin_custom_template(payload: CustomTemplateCreate, db: Session = Depends(get_db)) -> dict:
    load_album_or_fail(db, payload.album_id)
    template = CustomStickerTemplate()
    apply_custom_template_payload(template, payload)
    db.add(template)
    db.commit()
    template = load_custom_template_or_404(db, template.id)
    return custom_template_to_detail_response(template)


@app.get(
    "/admin/custom-templates/{template_id}",
    response_model=CustomTemplateDetailResponse,
    dependencies=[Depends(require_admin)],
)
def get_admin_custom_template(template_id: int, db: Session = Depends(get_db)) -> dict:
    template = load_custom_template_or_404(db, template_id)
    return custom_template_to_detail_response(template)


@app.put(
    "/admin/custom-templates/{template_id}",
    response_model=CustomTemplateDetailResponse,
    dependencies=[Depends(require_admin)],
)
def update_admin_custom_template(template_id: int, payload: CustomTemplateUpdate, db: Session = Depends(get_db)) -> dict:
    load_album_or_fail(db, payload.album_id)
    template = load_custom_template_or_404(db, template_id)
    apply_custom_template_payload(template, payload)
    db.commit()
    template = load_custom_template_or_404(db, template_id)
    return custom_template_to_detail_response(template)


@app.delete(
    "/admin/custom-templates/{template_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_admin)],
)
def delete_admin_custom_template(template_id: int, db: Session = Depends(get_db)) -> Response:
    template = load_custom_template_or_404(db, template_id)
    generated_stickers = db.execute(select(Sticker).where(Sticker.template_id == template.id)).scalars().all()
    for sticker in generated_stickers:
        sticker.template_id = None
    for layer in list(template.layers):
        delete_custom_template_layer_image(layer)
    db.delete(template)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@app.post(
    "/admin/custom-templates/{template_id}/layers/{layer_id}/file",
    response_model=CustomTemplateDetailResponse,
    dependencies=[Depends(require_admin)],
)
async def upload_admin_custom_template_layer_file(
    template_id: int,
    layer_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
) -> dict:
    template = load_custom_template_or_404(db, template_id)
    layer = load_custom_template_layer_or_404(template, layer_id)
    if not file.filename:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Envie uma imagem valida para a camada.")
    if not (file.content_type or "").startswith("image/"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Envie uma imagem JPG, PNG ou WebP valida.")

    upload_bytes = await file.read()
    if not upload_bytes:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="A imagem da camada enviada esta vazia.")
    if len(upload_bytes) > settings.custom_upload_limit_mb * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"A imagem da camada passou do limite de {settings.custom_upload_limit_mb} MB.",
        )

    try:
        save_custom_template_layer_image(layer, upload_bytes=upload_bytes, original_name=file.filename)
    except OSError as err:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Nao foi possivel ler a imagem da camada.") from err

    db.commit()
    template = load_custom_template_or_404(db, template_id)
    return custom_template_to_detail_response(template)


@app.delete(
    "/admin/custom-templates/{template_id}/layers/{layer_id}/file",
    response_model=CustomTemplateDetailResponse,
    dependencies=[Depends(require_admin)],
)
def delete_admin_custom_template_layer_file(template_id: int, layer_id: int, db: Session = Depends(get_db)) -> dict:
    template = load_custom_template_or_404(db, template_id)
    layer = load_custom_template_layer_or_404(template, layer_id)
    delete_custom_template_layer_image(layer)
    db.commit()
    template = load_custom_template_or_404(db, template_id)
    return custom_template_to_detail_response(template)


@app.post(
    "/admin/custom-templates/{template_id}/import-layers",
    response_model=CustomTemplateDetailResponse,
    dependencies=[Depends(require_admin)],
)
async def import_admin_custom_template_layers(
    template_id: int,
    files: list[UploadFile] = File(...),
    db: Session = Depends(get_db),
) -> dict:
    template = load_custom_template_or_404(db, template_id)
    if not files:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Envie pelo menos uma imagem para importar.")

    imported_files: list[tuple[str, bytes]] = []
    for file in files:
        if not file.filename:
            continue
        if not (file.content_type or "").startswith("image/"):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Envie apenas imagens PNG, JPG ou WebP no importador.")
        upload_bytes = await file.read()
        if not upload_bytes:
            continue
        if len(upload_bytes) > settings.custom_upload_limit_mb * 1024 * 1024:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Uma das imagens passou do limite de {settings.custom_upload_limit_mb} MB.",
            )
        imported_files.append((file.filename, upload_bytes))

    if not imported_files:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Nenhuma imagem valida foi encontrada no envio.")

    try:
        import_custom_template_layers(template, files=imported_files)
    except OSError as err:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Nao foi possivel ler uma das imagens do pacote.") from err

    db.commit()
    template = load_custom_template_or_404(db, template_id)
    return custom_template_to_detail_response(template)


@app.get("/admin/service-config", response_model=ServiceConfigResponse, dependencies=[Depends(require_admin)])
def get_admin_service_config(db: Session = Depends(get_db)) -> dict:
    service_settings = get_or_create_service_settings(db)
    return service_settings_to_response(service_settings)


@app.put("/admin/service-config", response_model=ServiceConfigResponse, dependencies=[Depends(require_admin)])
def update_admin_service_config(payload: ServiceConfigUpdate, db: Session = Depends(get_db)) -> dict:
    service_settings = get_or_create_service_settings(db)
    service_settings.service_enabled = payload.service_enabled
    service_settings.donation_enabled = payload.donation_enabled
    service_settings.custom_generation_mode = payload.custom_generation_mode
    service_settings.custom_sticker_unlock_enabled = payload.custom_sticker_unlock_enabled
    service_settings.custom_sticker_unlock_price_cents = payload.custom_sticker_unlock_price_cents
    service_settings.custom_sticker_unlock_message = (payload.custom_sticker_unlock_message or "").strip() or None
    service_settings.custom_ai_unlock_enabled = payload.custom_ai_unlock_enabled
    service_settings.custom_ai_unlock_price_cents = payload.custom_ai_unlock_price_cents
    service_settings.custom_ai_unlock_message = (payload.custom_ai_unlock_message or "").strip() or None
    service_settings.pack_size = payload.pack_size
    service_settings.print_price_cents = payload.print_price_cents
    service_settings.pack_price_cents = payload.pack_price_cents
    service_settings.pix_key = (payload.pix_key or "").strip() or None
    service_settings.pix_holder = (payload.pix_holder or "").strip() or None
    service_settings.donation_message = (payload.donation_message or "").strip() or None
    service_settings.pickup_note = (payload.pickup_note or "").strip() or None
    service_settings.custom_prompt_template = (payload.custom_prompt_template or "").strip() or None
    db.commit()
    db.refresh(service_settings)
    return service_settings_to_response(service_settings)


@app.post(
    "/admin/service-config/custom-bases/{profile_type}",
    response_model=ServiceConfigResponse,
    dependencies=[Depends(require_admin)],
)
async def upload_admin_custom_base(
    profile_type: CustomProfileType,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
) -> dict:
    if not file.filename:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Envie uma imagem valida para a base.")
    if not (file.content_type or "").startswith("image/"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Envie uma imagem JPG ou PNG valida.")

    upload_bytes = await file.read()
    if not upload_bytes:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="A imagem base enviada esta vazia.")
    if len(upload_bytes) > settings.custom_upload_limit_mb * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"A imagem base passou do limite de {settings.custom_upload_limit_mb} MB.",
        )

    service_settings = get_or_create_service_settings(db)
    try:
        save_custom_base_image(
            service_settings,
            profile_type=profile_type,
            upload_bytes=upload_bytes,
            original_name=file.filename,
        )
    except OSError as err:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Nao foi possivel ler essa imagem base.") from err

    db.commit()
    db.refresh(service_settings)
    return service_settings_to_response(service_settings)


@app.delete(
    "/admin/service-config/custom-bases/{profile_type}",
    response_model=ServiceConfigResponse,
    dependencies=[Depends(require_admin)],
)
def delete_admin_custom_base(profile_type: CustomProfileType, db: Session = Depends(get_db)) -> dict:
    service_settings = get_or_create_service_settings(db)
    delete_custom_base_image(service_settings, profile_type)
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


@app.get(
    "/admin/access-summary",
    response_model=AdminAccessSummaryResponse,
    dependencies=[Depends(require_admin)],
)
def get_admin_access_summary(db: Session = Depends(get_db)) -> dict:
    return _build_admin_access_summary(db)


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


@app.post("/admin/albums", response_model=AlbumResponse, dependencies=[Depends(require_admin)])
def create_album(payload: AlbumCreate, db: Session = Depends(get_db)) -> dict:
    slug = slugify(payload.slug)
    ensure_album_slug_unique(db, slug)
    album = Album(
        name=payload.name.strip(),
        slug=slug,
        description=(payload.description or "").strip() or None,
        sort_order=payload.sort_order,
    )
    db.add(album)
    db.commit()
    db.refresh(album)
    return album_to_response(album, {"collections": 0, "published_collections": 0}, [])


@app.put("/admin/albums/{album_id}", response_model=AlbumResponse, dependencies=[Depends(require_admin)])
def update_album(album_id: int, payload: AlbumUpdate, db: Session = Depends(get_db)) -> dict:
    album = load_album_or_fail(db, album_id)
    slug = slugify(payload.slug)
    ensure_album_slug_unique(db, slug, excluding_id=album.id)
    album.name = payload.name.strip()
    album.slug = slug
    album.description = (payload.description or "").strip() or None
    album.sort_order = payload.sort_order
    db.commit()
    db.refresh(album)
    stats = album_stats(db, [album.id])
    collection_stats_map = collection_stats(db, [collection.id for collection in album.collections])
    return album_to_response(
        album,
        stats.get(album.id, {}),
        [
            collection_to_response(collection, collection_stats_map.get(collection.id, {}))
            for collection in sorted(album.collections, key=collection_sort_key)
        ],
    )


@app.delete("/admin/albums/{album_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(require_admin)])
def delete_admin_album(album_id: int, db: Session = Depends(get_db)) -> Response:
    album = load_album_or_fail(db, album_id)
    delete_album_record(db, album)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@app.post("/admin/collections", response_model=CollectionResponse, dependencies=[Depends(require_admin)])
def create_collection(payload: CollectionCreate, db: Session = Depends(get_db)) -> dict:
    album = load_album_or_fail(db, payload.album_id)
    slug = slugify(payload.slug)
    ensure_collection_slug_unique(db, slug)
    collection = Collection(
        album=album,
        name=payload.name.strip(),
        slug=slug,
        description=(payload.description or "").strip() or None,
        collection_type=payload.collection_type,
        export_mode=payload.export_mode,
        allow_quantity_choice=payload.allow_quantity_choice,
        default_quantity=payload.default_quantity,
        max_quantity_per_order=payload.max_quantity_per_order,
        display_group_order=payload.display_group_order,
        display_item_order=payload.display_item_order,
        sort_order=payload.sort_order,
    )
    normalize_collection_export_settings(collection)
    db.add(collection)
    db.commit()
    db.refresh(collection)
    stats = collection_stats(db, [collection.id])
    return collection_to_response(collection, stats.get(collection.id, {}))


@app.put("/admin/collections/{collection_id}", response_model=CollectionResponse, dependencies=[Depends(require_admin)])
def update_collection(collection_id: int, payload: CollectionUpdate, db: Session = Depends(get_db)) -> dict:
    collection = load_collection_or_fail(db, collection_id)
    slug = slugify(payload.slug)
    ensure_collection_slug_unique(db, slug, excluding_id=collection.id)
    collection.name = payload.name.strip()
    collection.slug = slug
    collection.description = (payload.description or "").strip() or None
    collection.collection_type = payload.collection_type
    collection.export_mode = payload.export_mode
    collection.allow_quantity_choice = payload.allow_quantity_choice
    collection.default_quantity = payload.default_quantity
    collection.max_quantity_per_order = payload.max_quantity_per_order
    collection.display_group_order = payload.display_group_order
    collection.display_item_order = payload.display_item_order
    collection.sort_order = payload.sort_order
    normalize_collection_export_settings(collection)
    db.commit()
    db.refresh(collection)
    stats = collection_stats(db, [collection.id])
    return collection_to_response(collection, stats.get(collection.id, {}))


@app.put("/admin/collections/{collection_id}/album", response_model=CollectionResponse, dependencies=[Depends(require_admin)])
def assign_collection_album(collection_id: int, payload: CollectionAlbumAssign, db: Session = Depends(get_db)) -> dict:
    collection = load_collection_or_fail(db, collection_id)
    album = load_album_or_fail(db, payload.album_id)
    collection.album = album
    db.commit()
    db.refresh(collection)
    stats = collection_stats(db, [collection.id])
    return collection_to_response(collection, stats.get(collection.id, {}))


@app.delete("/admin/collections/{collection_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(require_admin)])
def delete_admin_collection(collection_id: int, db: Session = Depends(get_db)) -> Response:
    collection = load_collection_or_fail(db, collection_id)
    delete_collection_record(db, collection)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


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
    if payload.status == CollectionStatus.PUBLICADA:
        normalized_collection_type = (
            collection.collection_type
            if isinstance(collection.collection_type, CollectionType)
            else CollectionType((collection.collection_type or CollectionType.SELECAO.value))
        )
        normalized_export_mode = (
            collection.export_mode
            if isinstance(collection.export_mode, CollectionExportMode)
            else CollectionExportMode((collection.export_mode or CollectionExportMode.GRID.value))
        )
        is_append_only_extra = (
            normalized_collection_type == CollectionType.OUTROS
            and normalized_export_mode == CollectionExportMode.APPEND_FULL_PDF
        )
        if is_append_only_extra:
            if not (collection.source_pdf_path or "").strip():
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Envie o PDF completo desse extra antes de publicar a colecao.",
                )
        elif stats.get("stickers", 0) == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cadastre pelo menos uma figurinha antes de publicar a colecao.",
            )
    collection.status = payload.status
    db.commit()
    db.refresh(collection)
    stats = collection_stats(db, [collection.id])
    return collection_to_response(collection, stats.get(collection.id, {}))
