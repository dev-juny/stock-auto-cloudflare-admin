from __future__ import annotations

import httpx
from app.config import settings

BASE = settings.kis_base_url


class KISClient:
    def __init__(self) -> None:
        self._token: str | None = None
        self._http = httpx.AsyncClient(timeout=10)

    async def _ensure_token(self) -> str:
        if self._token:
            return self._token
        url = f"{BASE}/oauth2/tokenP"
        payload = {
            "grant_type": "client_credentials",
            "appkey": settings.kis_api_key,
            "appsecret": settings.kis_api_secret,
        }
        resp = await self._http.post(url, json=payload)
        data = resp.json()
        self._token = data.get("access_token", "")
        return self._token

    async def get_current_price(self, ticker: str) -> float | None:
        token = await self._ensure_token()
        url = f"{BASE}/uapi/domestic-stock/v1/quotations/inquire-price"
        headers = {
            "authorization": f"Bearer {token}",
            "appkey": settings.kis_api_key,
            "appsecret": settings.kis_api_secret,
            "tr_id": "FHKST01010100",
        }
        params = {"FID_COND_MRKT_DIV_CODE": "J", "FID_INPUT_ISCD": ticker}
        resp = await self._http.get(url, headers=headers, params=params)
        data = resp.json()
        if data.get("rt_cd") != "0":
            return None
        return float(data["output"]["stck_prpr"])

    async def market_sell(self, ticker: str, quantity: int) -> dict | None:
        token = await self._ensure_token()
        url = f"{BASE}/uapi/domestic-stock/v1/trading/order-cash"
        headers = {
            "authorization": f"Bearer {token}",
            "appkey": settings.kis_api_key,
            "appsecret": settings.kis_api_secret,
            "tr_id": "VTTC0801U" if settings.kis_is_mock else "TTTC0801U",
        }
        payload = {
            "CANO": settings.kis_account_number[:8],
            "ACNT_PRDT_CD": settings.kis_account_number[8:] or "01",
            "PDNO": ticker,
            "ORD_DVSN": "01",  # market price
            "ORD_QTY": str(quantity),
            "ORD_UNPR": "0",
        }
        resp = await self._http.post(url, headers=headers, json=payload)
        data = resp.json()
        if data.get("rt_cd") != "0":
            return None
        return data["output"]

    async def close(self) -> None:
        await self._http.aclose()


kis_client = KISClient()
