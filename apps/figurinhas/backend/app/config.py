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
    admin_token = os.getenv("FIGURINHAS_ADMIN_TOKEN", "change-me")
    render_scale = float(os.getenv("FIGURINHAS_PAGE_RENDER_SCALE", "4.0"))
    export_render_scale = float(os.getenv("FIGURINHAS_EXPORT_RENDER_SCALE", "6.0"))
    public_collection_limit = int(os.getenv("FIGURINHAS_PUBLIC_COLLECTION_LIMIT", "50"))
    default_service_enabled = os.getenv("FIGURINHAS_SERVICE_ENABLED", "false").lower() == "true"
    default_pack_size = int(os.getenv("FIGURINHAS_PACK_SIZE", "7"))
    default_print_price_cents = int(os.getenv("FIGURINHAS_PRINT_PRICE_CENTS", "0"))
    default_pack_price_cents = int(os.getenv("FIGURINHAS_PACK_PRICE_CENTS", "0"))
    default_pix_key = os.getenv("FIGURINHAS_PIX_KEY", "")
    default_pix_holder = os.getenv("FIGURINHAS_PIX_HOLDER", "")
    default_pickup_note = os.getenv(
        "FIGURINHAS_PICKUP_NOTE",
        "Pagamento via Pix e retirada combinada diretamente comigo.",
    )


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    settings = Settings()
    settings.storage_root.mkdir(parents=True, exist_ok=True)
    for subdir in ("originals", "pages", "crops", "exports"):
        (settings.storage_root / subdir).mkdir(parents=True, exist_ok=True)
    return settings
