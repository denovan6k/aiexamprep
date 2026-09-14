from __future__ import annotations

from collections.abc import Generator

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from sqlalchemy.orm import Session

try:
    from app.core.database import get_db
except ImportError:
    def get_db() -> Generator[Session, None, None]:
        raise RuntimeError("Database dependency is not configured.")

from app.core.client_context import build_login_client_info
from app.core.config import settings
from app.core.rate_limit import check_email_rate_limit
from app.schemas.auth import (
    AuthResponse,
    EmailVerificationConfirmRequest,
    EmailVerificationRequest,
    ForgotPasswordRequest,
    LoginRequest,
    LogoutResponse,
    MessageResponse,
    OAuthAuthorizeResponse,
    OAuthCallbackResponse,
    OtpChallengeResponse,
    RegisterRequest,
    ResetPasswordRequest,
    UserResponse,
)
from app.services.auth import (
    AuthService,
    EmailAlreadyRegisteredError,
    InvalidCredentialsError,
    InvalidTokenError,
    PASSWORD_RESET_PURPOSE,
    EMAIL_VERIFICATION_PURPOSE,
    UnsupportedOAuthProviderError,
)
from app.services.institutions import InstitutionNotFoundError

router = APIRouter()
auth_service = AuthService()


@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
def register(request: RegisterRequest, db: Session = Depends(get_db)) -> AuthResponse:
    try:
        response = auth_service.register(db, request)
        db.commit()
        return response
    except EmailAlreadyRegisteredError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        ) from exc
    except InstitutionNotFoundError as exc:
        db.rollback()
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.post("/login", response_model=AuthResponse)
def login(
    request: LoginRequest,
    http_request: Request,
    db: Session = Depends(get_db),
) -> AuthResponse:
    try:
        client_info = build_login_client_info(http_request)
        response = auth_service.login(
            db,
            request.email,
            request.password,
            ip_address=client_info["ip_address"],
            device=client_info["device"],
            location=client_info["location"],
        )
        db.commit()
        return response
    except InvalidCredentialsError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exc),
        ) from exc


@router.post("/logout", response_model=LogoutResponse)
def logout(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> LogoutResponse:
    token = _bearer_token_from(authorization)
    auth_service.logout(db, token)
    db.commit()
    return LogoutResponse(message="Logged out.")


@router.get("/me", response_model=UserResponse)
def current_user(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> UserResponse:
    token = _bearer_token_from(authorization)
    try:
        return auth_service.current_user(db, token)
    except InvalidTokenError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exc),
        ) from exc


@router.post("/forgot-password", response_model=OtpChallengeResponse)
def forgot_password(
    request: ForgotPasswordRequest,
    db: Session = Depends(get_db),
) -> OtpChallengeResponse:
    _enforce_otp_resend_limit(request.email, PASSWORD_RESET_PURPOSE)
    response = auth_service.request_password_reset_otp(db, request.email)
    db.commit()
    return response


@router.post("/reset-password", response_model=MessageResponse)
def reset_password(
    request: ResetPasswordRequest,
    db: Session = Depends(get_db),
) -> MessageResponse:
    try:
        auth_service.reset_password_with_otp(
            db, request.email, request.code, request.new_password
        )
        db.commit()
        return MessageResponse(message="Password has been reset.")
    except InvalidTokenError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exc),
        ) from exc


@router.post("/email-verification/request", response_model=OtpChallengeResponse)
def request_email_verification(
    request: EmailVerificationRequest,
    db: Session = Depends(get_db),
) -> OtpChallengeResponse:
    _enforce_otp_resend_limit(request.email, EMAIL_VERIFICATION_PURPOSE)
    response = auth_service.request_email_verification_otp(db, request.email)
    db.commit()
    return response


@router.post("/email-verification/confirm", response_model=UserResponse)
def confirm_email_verification(
    request: EmailVerificationConfirmRequest,
    db: Session = Depends(get_db),
) -> UserResponse:
    try:
        response = auth_service.confirm_email_verification(db, request.email, request.code)
        db.commit()
        return response
    except InvalidTokenError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exc),
        ) from exc


@router.get("/oauth/{provider}/authorize", response_model=OAuthAuthorizeResponse)
def oauth_authorize(provider: str) -> OAuthAuthorizeResponse:
    try:
        return auth_service.oauth_authorize(provider)
    except UnsupportedOAuthProviderError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.get("/oauth/{provider}/callback", response_model=OAuthCallbackResponse)
def oauth_callback(provider: str, state: str) -> OAuthCallbackResponse:
    try:
        auth_service.oauth_authorize(provider)
    except UnsupportedOAuthProviderError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return OAuthCallbackResponse(
        provider=provider.strip().lower(),
        state=state,
        message="OAuth callback is scaffolded; provider token exchange is not implemented yet.",
    )


def _enforce_otp_resend_limit(email: str, purpose: str) -> None:
    check_email_rate_limit(
        email,
        f"otp_resend:{purpose}",
        limit=settings.auth_otp_resend_limit,
        window_seconds=settings.auth_otp_resend_window_seconds,
    )


def _bearer_token_from(authorization: str | None) -> str:
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing bearer token.",
        )

    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authorization header.",
        )
    return token
