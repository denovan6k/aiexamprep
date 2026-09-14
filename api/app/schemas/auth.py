from pydantic import BaseModel, Field, field_validator


class RegisterRequest(BaseModel):
    email: str = Field(..., min_length=3, max_length=254)
    password: str = Field(..., min_length=8, max_length=128)
    full_name: str | None = Field(default=None, max_length=120)
    # institution_slug: str | None = Field(default=None, max_length=255)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        email = value.strip().lower()
        if "@" not in email or email.startswith("@") or email.endswith("@"):
            raise ValueError("Enter a valid email address.")
        return email

    @field_validator("full_name")
    @classmethod
    def normalize_full_name(cls, value: str | None) -> str | None:
        if value is None:
            return None
        name = value.strip()
        return name or None

    # @field_validator("institution_slug")
    # @classmethod
    # def normalize_institution_slug(cls, value: str | None) -> str | None:
    #     if value is None:
    #         return None
    #     slug = value.strip().lower()
    #     return slug or None


class LoginRequest(BaseModel):
    email: str = Field(..., min_length=3, max_length=254)
    password: str = Field(..., min_length=1, max_length=128)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        return value.strip().lower()


class InstitutionSummary(BaseModel):
    id: str
    name: str
    slug: str


class UserResponse(BaseModel):
    id: str
    email: str
    full_name: str | None = None
    is_active: bool = True
    is_email_verified: bool = False
    institution: InstitutionSummary | None = None
    is_institution_admin: bool = False
    role: str = "user"


class AuthResponse(BaseModel):
    user: UserResponse
    access_token: str
    token_type: str = "bearer"
    expires_in: int


class OtpChallengeResponse(BaseModel):
    status: str = "pending_verification"
    email: str
    message: str
    expires_in: int


class LogoutResponse(BaseModel):
    status: str = "ok"
    message: str


class TokenResponse(BaseModel):
    status: str = "ok"
    token: str
    expires_in: int


class MessageResponse(BaseModel):
    status: str = "ok"
    message: str


class ForgotPasswordRequest(BaseModel):
    email: str = Field(..., min_length=3, max_length=254)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        return value.strip().lower()


class ResetPasswordRequest(BaseModel):
    email: str = Field(..., min_length=3, max_length=254)
    code: str = Field(..., pattern=r"^\d{6}$")
    new_password: str = Field(..., min_length=8, max_length=128)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        return value.strip().lower()


class EmailVerificationRequest(BaseModel):
    email: str = Field(..., min_length=3, max_length=254)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        return value.strip().lower()


class EmailVerificationConfirmRequest(BaseModel):
    email: str = Field(..., min_length=3, max_length=254)
    code: str = Field(..., pattern=r"^\d{6}$")

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        return value.strip().lower()


class OAuthAuthorizeResponse(BaseModel):
    provider: str
    authorization_url: str
    state: str
    message: str


class OAuthCallbackResponse(BaseModel):
    provider: str
    state: str
    message: str
