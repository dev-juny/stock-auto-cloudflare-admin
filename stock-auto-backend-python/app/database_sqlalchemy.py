from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.config import settings

_engine = None
_SessionLocal = None


def init_sqlalchemy():
    global _engine, _SessionLocal
    if _engine is not None:
        return
    _engine = create_engine(
        f"oracle+oracledb://{settings.db_user}:{settings.db_password}@{settings.oracle_dsn}",
        pool_size=5,
        max_overflow=5,
        pool_pre_ping=True,
        pool_recycle=3600,
    )
    _SessionLocal = sessionmaker(bind=_engine, expire_on_commit=False)


def get_session_sync():
    if _SessionLocal is None:
        raise RuntimeError("SQLAlchemy not initialized - call init_sqlalchemy() first")
    return _SessionLocal()


def close_sqlalchemy():
    global _engine, _SessionLocal
    if _engine:
        _engine.dispose()
    _engine = None
    _SessionLocal = None
