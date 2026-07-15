from __future__ import annotations

import logging
import os
from dataclasses import dataclass, field
from pathlib import Path

_logger = logging.getLogger(__name__)

_DEFAULT_JWT_SECRET = "development-secret-change-in-production"


def _check_jwt_secret(v: str) -> str:
    if v == _DEFAULT_JWT_SECRET:
        _logger.critical(
            "JWT_SECRET is not set! Using insecure default. "
            "Set the JWT_SECRET environment variable immediately!"
        )
    return v


@dataclass
class Settings:
    port: int = int(os.getenv("PORT", "5000"))
    env: str = os.getenv("ENV", "development")

    oracle_wallet_path: str = os.getenv("ORACLE_WALLET_PATH", "")
    oracle_dsn: str = os.getenv("ORACLE_DSN", "")
    db_user: str = os.getenv("DB_USER", "")
    db_password: str = os.getenv("DB_PASSWORD", "")

    kis_base_url: str = os.getenv("KIS_BASE_URL", "https://openapi.koreainvestment.com:9443")
    kis_api_key: str = os.getenv("KIS_API_KEY", "")
    kis_api_secret: str = os.getenv("KIS_API_SECRET", "")
    kis_account_number: str = os.getenv("KIS_ACCOUNT_NUMBER", "")
    kis_market: str = os.getenv("KIS_MARKET", "K")
    kis_is_mock: bool = os.getenv("KIS_MODE", "mock") != "real"

    max_concurrent_positions: int = int(os.getenv("MAX_CONCURRENT_POSITIONS", "10"))

    jwt_secret: str = field(
        default_factory=lambda: _check_jwt_secret(
            os.getenv("JWT_SECRET", _DEFAULT_JWT_SECRET)
        )
    )

    allowed_origins: list[str] = field(default_factory=lambda: (
        os.getenv("ALLOWED_ORIGINS", "http://localhost:5173,http://localhost:3001,https://stock-admin.hjjun1006.workers.dev,https://stock-admin-production.hjjun1006.workers.dev").split(",")
    ))

    @property
    def oracle_available(self) -> bool:
        return bool(self.oracle_wallet_path and self.oracle_dsn and self.db_user)


settings = Settings()
