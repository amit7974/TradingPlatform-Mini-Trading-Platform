"""
Auth Endpoints
==============
POST /auth/login  – Authenticate with ACT Trader credentials, receive internal JWT
POST /auth/logout – Invalidate ACT Trader token
GET  /auth/status – Check current token/connection status
"""
import logging
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel

from app.core.security import create_access_token
from app.services.act_auth_service import act_auth_service
from app.services.market_data_service import market_data_service

logger = logging.getLogger("trading.api.auth")
router = APIRouter()


class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    message: str


@router.post("/login", response_model=LoginResponse)
async def login(req: LoginRequest):
    """
    Authenticate with ACT Trader REST endpoint.
    On success, caches the upstream token and returns an internal JWT
    for subsequent API calls.
    """
    act_auth_service.set_credentials(req.username, req.password)

    try:
        act_token = await act_auth_service.get_token()
    except ValueError as exc:
        logger.warning("Login failed for user '%s': %s", req.username, exc)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exc),
        )
    except ConnectionError as exc:
        logger.error("Auth endpoint unreachable: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="ACT Trader auth endpoint is currently unreachable. "
                   "Using demo mode – market data will be simulated.",
        )

    # Start market data streaming once we have credentials
    await market_data_service.connect()

    internal_token = create_access_token({"sub": req.username})
    return LoginResponse(
        access_token=internal_token,
        message="Authenticated with ACT Trader successfully",
    )


@router.post("/logout")
async def logout():
    await act_auth_service.invalidate()
    return {"message": "Logged out"}


@router.get("/status")
async def auth_status():
    return {
        "has_credentials": act_auth_service.has_credentials,
        "token_active": act_auth_service.current_token is not None,
        "ws_connected": market_data_service.is_connected,
    }
