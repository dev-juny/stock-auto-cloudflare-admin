from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path


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

    @property
    def oracle_available(self) -> bool:
        return bool(self.oracle_wallet_path and self.oracle_dsn and self.db_user)


settings = Settings()
