from __future__ import annotations

from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import (
    create_otp_code,
    create_secure_token,
    hash_otp,
    hash_password,
    hash_token,
    verify_password,
)
from app.core.roles import effective_role, initial_role_for_email
from app.models import AuthSession, EmailVerificationToken, Institution, PasswordResetToken, User
from app.schemas.auth import (
    AuthResponse,
    InstitutionSummary,
    OAuthAuthorizeResponse,
    OtpChallengeResponse,
    RegisterRequest,
    UserResponse,
)
from app.services.auth_email import auth_mailer, send_auth_otp
from app.services.institutions import InstitutionNotFoundError, institutions_service


SESSION_TTL_SECONDS = 60 * 60 * 24 * 7
EMAIL_VERIFICATION_TTL_SECONDS = settings.auth_otp_ttl_seconds
PASSWORD_RESET_TTL_SECONDS = settings.auth_otp_ttl_seconds
EMAIL_VERIFICATION_PURPOSE = "email_verification"
PASSWORD_RESET_PURPOSE = "password_reset"
SUPPORTED_OAUTH_PROVIDERS = {"google", "github"}


class AuthError(Exception):
    pass


class EmailAlreadyRegisteredError(AuthError):
    pass


class InvalidCredentialsError(AuthError):
    pass


class InvalidTokenError(AuthError):
    pass


class UnsupportedOAuthProviderError(AuthError):
    pass


class AuthService:
    def register(self, db: Session, request: RegisterRequest) -> AuthResponse:
        existing_user = db.scalar(select(User).where(User.email == request.email))
        if existing_user is not None:
            raise EmailAlreadyRegisteredError("Email is already registered.")

        user = User(
            name=request.full_name or request.email.split("@", 1)[0],
            email=request.email,
            password_hash=hash_password(request.password),
            is_active=True,
            role=initial_role_for_email(request.email),
        )
        db.add(user)
        db.flush()
        try:
            auth_mailer.send_welcome(email=user.email, name=user.name)
        except Exception:
            pass
        return self._auth_response_for(db, user)

    def login(
        self,
        db: Session,
        email: str,
        password: str,
        *,
        ip_address: str | None = None,
        device: str | None = None,
        location: str | None = None,
    ) -> AuthResponse:
        user = db.scalar(select(User).where(User.email == email))
        if (
            user is None
            or user.password_hash is None
            or not user.is_active
            or not verify_password(password, user.password_hash)
        ):
            raise InvalidCredentialsError("Invalid email or password.")

        response = self._auth_response_for(db, user)
        try:
            auth_mailer.send_login_alert(
                email=user.email,
                recipient_name=user.name,
                ip_address=ip_address,
                device=device,
                location=location,
            )
        except Exception:
            pass
        return response

    def logout(self, db: Session, token: str) -> None:
        session = self._session_for_token(db, token, allow_revoked=True)
        if session is not None and session.revoked_at is None:
            session.revoked_at = utc_now()
            db.add(session)

    def current_user(self, db: Session, token: str) -> UserResponse:
        session = self._session_for_token(db, token)
        if session is None or session.user is None or not session.user.is_active:
            raise InvalidTokenError("Invalid or expired access token.")
        return self._user_response_for(session.user, db)

    def request_password_reset_otp(self, db: Session, email: str) -> OtpChallengeResponse:
        user = db.scalar(select(User).where(User.email == email))
        if user is not None and user.is_active:
            self._invalidate_password_reset_tokens(db, user.id)
            code = create_otp_code()
            db.add(
                PasswordResetToken(
                    user_id=user.id,
                    token_hash=self._otp_hash(email, code, PASSWORD_RESET_PURPOSE),
                    expires_at=utc_now() + timedelta(seconds=PASSWORD_RESET_TTL_SECONDS),
                )
            )
            send_auth_otp(
                email=email,
                code=code,
                purpose=PASSWORD_RESET_PURPOSE,
                recipient_name=user.name,
            )

        return OtpChallengeResponse(
            email=email,
            message="If an account exists, a password reset code has been sent.",
            expires_in=PASSWORD_RESET_TTL_SECONDS,
        )

    def reset_password_with_otp(
        self, db: Session, email: str, code: str, new_password: str
    ) -> None:
        user = db.scalar(select(User).where(User.email == email))
        if user is None or not user.is_active:
            raise InvalidTokenError("Invalid or expired reset code.")

        reset_token = self._latest_password_reset_token(db, user.id)
        if reset_token is None:
            raise InvalidTokenError("Invalid or expired reset code.")

        reset_token.attempt_count += 1
        if reset_token.attempt_count > settings.auth_otp_max_attempts:
            reset_token.consumed_at = utc_now()
            db.add(reset_token)
            raise InvalidTokenError("Too many invalid attempts. Request a new reset code.")

        if reset_token.token_hash != self._otp_hash(email, code, PASSWORD_RESET_PURPOSE):
            db.add(reset_token)
            raise InvalidTokenError("Invalid or expired reset code.")

        user.password_hash = hash_password(new_password)
        reset_token.consumed_at = utc_now()
        db.add(user)
        db.add(reset_token)

    def request_email_verification_otp(self, db: Session, email: str) -> OtpChallengeResponse:
        user = db.scalar(select(User).where(User.email == email))
        if user is not None and user.is_active and user.email_verified_at is None:
            self._invalidate_email_verification_tokens(db, user.id)
            code = create_otp_code()
            db.add(
                EmailVerificationToken(
                    user_id=user.id,
                    token_hash=self._otp_hash(email, code, EMAIL_VERIFICATION_PURPOSE),
                    expires_at=utc_now() + timedelta(seconds=EMAIL_VERIFICATION_TTL_SECONDS),
                )
            )
            send_auth_otp(
                email=email,
                code=code,
                purpose=EMAIL_VERIFICATION_PURPOSE,
                recipient_name=user.name,
            )

        return OtpChallengeResponse(
            email=email,
            message="If an account exists, a verification code has been sent.",
            expires_in=EMAIL_VERIFICATION_TTL_SECONDS,
        )

    def confirm_email_verification(self, db: Session, email: str, code: str) -> UserResponse:
        user = db.scalar(select(User).where(User.email == email))
        if user is None or not user.is_active or user.email_verified_at is not None:
            raise InvalidTokenError("Invalid or expired verification code.")

        verification_token = self._latest_email_verification_token(db, user.id)
        if verification_token is None:
            raise InvalidTokenError("Invalid or expired verification code.")

        verification_token.attempt_count += 1
        if verification_token.attempt_count > settings.auth_otp_max_attempts:
            verification_token.consumed_at = utc_now()
            db.add(verification_token)
            raise InvalidTokenError("Too many invalid attempts. Request a new verification code.")

        if verification_token.token_hash != self._otp_hash(
            email, code, EMAIL_VERIFICATION_PURPOSE
        ):
            db.add(verification_token)
            raise InvalidTokenError("Invalid or expired verification code.")

        user.email_verified_at = utc_now()
        verification_token.consumed_at = utc_now()
        db.add(user)
        db.add(verification_token)
        return self._user_response_for(user, db)

    def oauth_authorize(self, provider: str) -> OAuthAuthorizeResponse:
        normalized_provider = provider.strip().lower()
        if normalized_provider not in SUPPORTED_OAUTH_PROVIDERS:
            raise UnsupportedOAuthProviderError(f"OAuth provider '{provider}' is not supported.")

        state = create_secure_token()
        return OAuthAuthorizeResponse(
            provider=normalized_provider,
            authorization_url=f"https://oauth.local/{normalized_provider}/authorize?state={state}",
            state=state,
            message="OAuth provider calls are scaffolded for local development.",
        )

    def _auth_response_for(self, db: Session, user: User) -> AuthResponse:
        token = create_secure_token()
        db.add(
            AuthSession(
                user_id=user.id,
                token_hash=hash_token(token),
                expires_at=utc_now() + timedelta(seconds=SESSION_TTL_SECONDS),
            )
        )
        db.flush()
        return AuthResponse(
            user=self._user_response_for(user, db),
            access_token=token,
            expires_in=SESSION_TTL_SECONDS,
        )

    def _session_for_token(
        self, db: Session, token: str, *, allow_revoked: bool = False
    ) -> AuthSession | None:
        session = db.scalar(select(AuthSession).where(AuthSession.token_hash == hash_token(token)))
        if session is None:
            return None
        if not allow_revoked and session.revoked_at is not None:
            return None
        if is_expired(session.expires_at):
            return None
        return session

    def _otp_hash(self, email: str, code: str, purpose: str) -> str:
        return hash_otp(
            code,
            email=email,
            purpose=purpose,
            secret=settings.auth_secret,
        )

    def _invalidate_email_verification_tokens(self, db: Session, user_id) -> None:
        tokens = db.scalars(
            select(EmailVerificationToken).where(
                EmailVerificationToken.user_id == user_id,
                EmailVerificationToken.consumed_at.is_(None),
            )
        ).all()
        now = utc_now()
        for token in tokens:
            token.consumed_at = now
            db.add(token)

    def _invalidate_password_reset_tokens(self, db: Session, user_id) -> None:
        tokens = db.scalars(
            select(PasswordResetToken).where(
                PasswordResetToken.user_id == user_id,
                PasswordResetToken.consumed_at.is_(None),
            )
        ).all()
        now = utc_now()
        for token in tokens:
            token.consumed_at = now
            db.add(token)

    def _latest_email_verification_token(
        self, db: Session, user_id
    ) -> EmailVerificationToken | None:
        tokens = db.scalars(
            select(EmailVerificationToken)
            .where(
                EmailVerificationToken.user_id == user_id,
                EmailVerificationToken.consumed_at.is_(None),
            )
            .order_by(EmailVerificationToken.created_at.desc())
        ).all()
        for token in tokens:
            if not is_expired(token.expires_at):
                return token
        return None

    def _latest_password_reset_token(
        self, db: Session, user_id
    ) -> PasswordResetToken | None:
        tokens = db.scalars(
            select(PasswordResetToken)
            .where(
                PasswordResetToken.user_id == user_id,
                PasswordResetToken.consumed_at.is_(None),
            )
            .order_by(PasswordResetToken.created_at.desc())
        ).all()
        for token in tokens:
            if not is_expired(token.expires_at):
                return token
        return None

    def _user_response_for(self, user: User, db: Session | None = None) -> UserResponse:
        institution = user.institution
        if institution is None and user.institution_id is not None and db is not None:
            institution = db.get(Institution, user.institution_id)
        institution_summary = None
        if institution is not None:
            institution_summary = InstitutionSummary(
                id=str(institution.id),
                name=institution.name,
                slug=institution.slug,
            )
        is_admin = False
        if db is not None:
            is_admin = institutions_service._is_institution_admin(
                db, user.id, user.institution_id
            )
        return UserResponse(
            id=str(user.id),
            email=user.email,
            full_name=user.name,
            is_active=user.is_active,
            is_email_verified=user.email_verified_at is not None,
            institution=institution_summary,
            is_institution_admin=is_admin,
            role=effective_role(user),
        )


def utc_now() -> datetime:
    return datetime.now(UTC)


def is_expired(expires_at: datetime) -> bool:
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=UTC)
    return expires_at <= utc_now()
