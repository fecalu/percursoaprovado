from __future__ import annotations

from sqlalchemy import create_engine, event
from sqlalchemy.engine import make_url
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from .config import get_settings


settings = get_settings()
database_url = make_url(settings.database_url)
is_sqlite = database_url.get_backend_name() == "sqlite"


class Base(DeclarativeBase):
    pass


engine_kwargs = {
    "pool_pre_ping": True,
}
if is_sqlite:
    engine_kwargs["connect_args"] = {
        "check_same_thread": False,
        "timeout": 60,
    }
else:
    engine_kwargs.update(
        {
            "pool_size": settings.database_pool_size,
            "max_overflow": settings.database_max_overflow,
            "pool_timeout": settings.database_pool_timeout_seconds,
            "pool_recycle": settings.database_pool_recycle_seconds,
        }
    )

engine = create_engine(settings.database_url, **engine_kwargs)


@event.listens_for(engine, "connect")
def configure_sqlite_connection(dbapi_connection, connection_record):
    if not is_sqlite:
        return
    cursor = dbapi_connection.cursor()
    try:
        cursor.execute("PRAGMA journal_mode=WAL;")
        cursor.execute("PRAGMA synchronous=NORMAL;")
        cursor.execute("PRAGMA busy_timeout=60000;")
        cursor.execute("PRAGMA foreign_keys=ON;")
    finally:
        cursor.close()


SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
