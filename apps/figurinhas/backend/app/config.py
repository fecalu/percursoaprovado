from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path


class Settings:
    app_name = "Figurinhas"
    storage_root = Path(os.getenv("FIGURINHAS_STORAGE_ROOT", "/app/storage")).resolve()
    database_url = os.getenv(
        "FIGURINHAS_DATABASE_URL",
        f"sqlite:///{(storage_root / 'figurinhas.sqlite3').as_posix()}",
    )
    database_pool_size = int(os.getenv("FIGURINHAS_DATABASE_POOL_SIZE", "5"))
    database_max_overflow = int(os.getenv("FIGURINHAS_DATABASE_MAX_OVERFLOW", "10"))
    database_pool_timeout_seconds = int(os.getenv("FIGURINHAS_DATABASE_POOL_TIMEOUT_SECONDS", "30"))
    database_pool_recycle_seconds = int(os.getenv("FIGURINHAS_DATABASE_POOL_RECYCLE_SECONDS", "1800"))
    admin_token = os.getenv("FIGURINHAS_ADMIN_TOKEN", "change-me")
    admin_password_hash = os.getenv("FIGURINHAS_ADMIN_PASSWORD_HASH", "").strip()
    admin_session_ttl_hours = int(os.getenv("FIGURINHAS_ADMIN_SESSION_TTL_HOURS", "12"))
    admin_login_attempt_window_minutes = int(os.getenv("FIGURINHAS_ADMIN_LOGIN_ATTEMPT_WINDOW_MINUTES", "15"))
    admin_login_max_attempts = int(os.getenv("FIGURINHAS_ADMIN_LOGIN_MAX_ATTEMPTS", "8"))
    admin_login_block_minutes = int(os.getenv("FIGURINHAS_ADMIN_LOGIN_BLOCK_MINUTES", "15"))
    export_signing_secret = os.getenv("FIGURINHAS_EXPORT_SIGNING_SECRET") or admin_token
    public_rate_limit_window_seconds = int(os.getenv("FIGURINHAS_PUBLIC_RATE_LIMIT_WINDOW_SECONDS", "60"))
    public_quote_limit = int(os.getenv("FIGURINHAS_PUBLIC_QUOTE_LIMIT", "24"))
    public_export_limit = int(os.getenv("FIGURINHAS_PUBLIC_EXPORT_LIMIT", "8"))
    public_my_sticker_job_limit = int(os.getenv("FIGURINHAS_PUBLIC_MY_STICKER_JOB_LIMIT", "6"))
    public_cutout_job_limit = int(os.getenv("FIGURINHAS_PUBLIC_CUTOUT_JOB_LIMIT", "8"))
    public_unlock_limit = int(os.getenv("FIGURINHAS_PUBLIC_UNLOCK_LIMIT", "10"))
    public_order_limit = int(os.getenv("FIGURINHAS_PUBLIC_ORDER_LIMIT", "10"))
    public_catalog_limit = int(os.getenv("FIGURINHAS_PUBLIC_CATALOG_RATE_LIMIT", "120"))
    public_service_config_limit = int(os.getenv("FIGURINHAS_PUBLIC_SERVICE_CONFIG_RATE_LIMIT", "60"))
    public_public_job_status_limit = int(os.getenv("FIGURINHAS_PUBLIC_JOB_STATUS_RATE_LIMIT", "90"))
    public_public_file_limit = int(os.getenv("FIGURINHAS_PUBLIC_FILE_RATE_LIMIT", "120"))
    public_unlock_read_limit = int(os.getenv("FIGURINHAS_PUBLIC_UNLOCK_READ_RATE_LIMIT", "60"))
    public_download_limit = int(os.getenv("FIGURINHAS_PUBLIC_DOWNLOAD_RATE_LIMIT", "20"))
    public_job_worker_count = int(os.getenv("FIGURINHAS_PUBLIC_JOB_WORKER_COUNT", "3"))
    public_job_queue_limit = int(os.getenv("FIGURINHAS_PUBLIC_JOB_QUEUE_LIMIT", "20"))
    render_scale = float(os.getenv("FIGURINHAS_PAGE_RENDER_SCALE", "4.0"))
    export_render_scale = float(os.getenv("FIGURINHAS_EXPORT_RENDER_SCALE", "6.0"))
    public_collection_limit = int(os.getenv("FIGURINHAS_PUBLIC_COLLECTION_LIMIT", "50"))
    public_collection_limit_max = int(os.getenv("FIGURINHAS_PUBLIC_COLLECTION_LIMIT_MAX", "200"))
    public_sticker_limit = int(os.getenv("FIGURINHAS_PUBLIC_STICKER_LIMIT", "500"))
    public_sticker_limit_max = int(os.getenv("FIGURINHAS_PUBLIC_STICKER_LIMIT_MAX", "1000"))
    default_service_enabled = os.getenv("FIGURINHAS_SERVICE_ENABLED", "false").lower() == "true"
    default_pack_size = int(os.getenv("FIGURINHAS_PACK_SIZE", "7"))
    default_print_price_cents = int(os.getenv("FIGURINHAS_PRINT_PRICE_CENTS", "0"))
    default_pack_price_cents = int(os.getenv("FIGURINHAS_PACK_PRICE_CENTS", "0"))
    default_pix_key = os.getenv("FIGURINHAS_PIX_KEY", "")
    default_pix_holder = os.getenv("FIGURINHAS_PIX_HOLDER", "")
    default_donation_enabled = os.getenv("FIGURINHAS_DONATION_ENABLED", "false").lower() == "true"
    default_donation_message = os.getenv(
        "FIGURINHAS_DONATION_MESSAGE",
        "Se este material te ajudou, voce pode apoiar o projeto com uma doacao via Pix. O download continua gratuito.",
    )
    default_pickup_note = os.getenv(
        "FIGURINHAS_PICKUP_NOTE",
        "Pagamento via Pix e retirada combinada diretamente comigo.",
    )
    default_custom_sticker_unlock_enabled = (
        os.getenv("FIGURINHAS_CUSTOM_STICKER_UNLOCK_ENABLED", "false").lower() == "true"
    )
    default_custom_sticker_unlock_price_cents = int(
        os.getenv("FIGURINHAS_CUSTOM_STICKER_UNLOCK_PRICE_CENTS", "500")
    )
    default_custom_sticker_unlock_message = os.getenv(
        "FIGURINHAS_CUSTOM_STICKER_UNLOCK_MESSAGE",
        "Sua figurinha personalizada e um recurso especial. Voce pode baixar gratis sem ela ou liberar o PDF completo por R$ 5,00.",
    )
    default_custom_ai_unlock_enabled = os.getenv("FIGURINHAS_CUSTOM_AI_UNLOCK_ENABLED", "false").lower() == "true"
    default_custom_ai_unlock_price_cents = int(
        os.getenv("FIGURINHAS_CUSTOM_AI_UNLOCK_PRICE_CENTS", "500")
    )
    default_custom_ai_unlock_message = os.getenv(
        "FIGURINHAS_CUSTOM_AI_UNLOCK_MESSAGE",
        "A criacao com IA e um recurso premium. Pague primeiro para liberar a geracao da sua figurinha.",
    )
    mercadopago_access_token = os.getenv("FIGURINHAS_MP_ACCESS_TOKEN") or os.getenv("MP_ACCESS_TOKEN", "")
    openai_api_key = os.getenv("FIGURINHAS_OPENAI_API_KEY") or os.getenv("OPENAI_API_KEY", "")
    openai_image_model = os.getenv("FIGURINHAS_OPENAI_IMAGE_MODEL", "gpt-image-2")
    openai_image_quality = os.getenv("FIGURINHAS_OPENAI_IMAGE_QUALITY", "medium")
    custom_upload_limit_mb = int(os.getenv("FIGURINHAS_CUSTOM_UPLOAD_LIMIT_MB", "12"))


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    settings = Settings()
    settings.storage_root.mkdir(parents=True, exist_ok=True)
    for subdir in (
        "originals",
        "pages",
        "crops",
        "exports",
        "source_documents",
        "source_document_pages",
        "custom_uploads",
        "custom_portraits",
        "custom_stickers",
        "custom_bases",
    ):
        (settings.storage_root / subdir).mkdir(parents=True, exist_ok=True)
    return settings
