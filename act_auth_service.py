"""
ACT Trader Auth Service
=======================
Handles REST token acquisition and refresh from the ACT Trader auth endpoint.
Token is cached and reused until expiry, with automatic refresh on 401.
"""
import asyncio
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

import httpx

from app.core.config import settings

logger = logging.getLogger("trading.auth")

_TOKEN_REFRESH_BUFFER_SECONDS = 60  # refresh 60 s before expiry


class ActAuthService:
    """Thread-safe singleton for ACT Trader token management."""

    def __init__(self):
        self._token: Optional[str] = None
        self._expires_at: Optional[datetime] = None
        self._lock = asyncio.Lock()
        self._credentials: dict = {}

    def set_credentials(self, username: str, password: str) -> None:
        self._credentials = {"username": username, "password": password}

    @property
    def has_credentials(self) -> bool:
        return bool(self._credentials)

    @property
    def current_token(self) -> Optional[str]:
        return self._token

    def _is_token_valid(self) -> bool:
        if not self._token or not self._expires_at:
            return False
        buffer = timedelta(seconds=_TOKEN_REFRESH_BUFFER_SECONDS)
        return datetime.now(timezone.utc) < (self._expires_at - buffer)

    async def get_token(self) -> str:
        """Return a valid token, fetching a new one if necessary."""
        async with self._lock:
            if self._is_token_valid():
                return self._token  # type: ignore
            return await self._fetch_token()

    async def _fetch_token(self) -> str:
        """Call ACT Trader REST auth endpoint and cache the token."""
        if not self._credentials:
            raise RuntimeError("ACT Trader credentials not set – call /api/v1/auth/login first")

        logger.info("Fetching new ACT Trader token for user '%s'", self._credentials.get("username"))

        async with httpx.AsyncClient(timeout=10.0) as client:
            try:
                resp = await client.post(
                    settings.ACT_AUTH_URL,
                    json=self._credentials,
                    headers={"Content-Type": "application/json"},
                )
                resp.raise_for_status()
            except httpx.HTTPStatusError as exc:
                logger.error("ACT auth HTTP error %s: %s", exc.response.status_code, exc.response.text)
                raise ValueError(f"ACT Trader authentication failed: {exc.response.status_code}") from exc
            except httpx.RequestError as exc:
                logger.error("ACT auth network error: %s", exc)
                raise ConnectionError(f"Cannot reach ACT Trader auth endpoint: {exc}") from exc

        data = resp.json()
        logger.debug("ACT auth response keys: %s", list(data.keys()))

        # ACT Trader may return the token under different key names
        token = (
            data.get("token")
            or data.get("access_token")
            or data.get("accessToken")
            or data.get("jwt")
        )
        if not token:
            raise ValueError(f"Token not found in auth response. Keys: {list(data.keys())}")

        # Try to parse expiry; default to 55 minutes if not provided
        expires_in = data.get("expires_in") or data.get("expiresIn") or 3300
        self._token = token
        self._expires_at = datetime.now(timezone.utc) + timedelta(seconds=int(expires_in))

        logger.info(
            "ACT Trader token acquired, expires at %s",
            self._expires_at.strftime("%H:%M:%S UTC"),
        )
        return self._token  # type: ignore

    async def invalidate(self) -> None:
        async with self._lock:
            self._token = None
            self._expires_at = None
            logger.info("ACT Trader token invalidated")


act_auth_service = ActAuthService()
