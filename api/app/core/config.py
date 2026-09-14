from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(".env", "api/.env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "Knorvex API"
    app_version: str = "0.1.0"
    app_env: str = "development"

    postgres_db: str = "knorvex"
    postgres_user: str = "knorvex"
    postgres_password: str = ""
    postgres_host: str = "localhost"
    postgres_port: int = 5432
    database_url: str = ""
    redis_url: str = "redis://localhost:6379/0"
    enable_job_queue: bool = True
    # When true (and Redis is up), parse/chunk/embed run on Arq workers.
    # Default false so local API uploads stay searchable without a worker process.
    queue_material_processing: bool = False
    max_concurrent_global_jobs: int = 4
    max_pending_generation_jobs_per_user: int = 8
    stale_running_job_minutes: int = 4
    stale_queued_job_minutes: int = 30
    enable_queue_first_study_generation: bool = True
    intent_router_read_timeout_seconds: float = 30.0
    study_generation_read_timeout_seconds: float = 90.0
    image_understanding_model: str | None = None
    image_understanding_read_timeout_seconds: float = 45.0
    thread_title_model: str | None = None

    vision_model_prefixes: str = (
        "gpt-4o,gpt-4.1,openai/gpt-4o,openai/gpt-4.1,claude-3,gemini,google/gemini,llava,qwen-vl,pixtral"
    )
    api_cors_origins: str = Field(default="http://localhost:3000")

    auth_secret: str = "change-me"
    api_key_encryption_secret: str = ""
    auth_otp_ttl_seconds: int = 10 * 60
    auth_otp_max_attempts: int = 10
    auth_otp_resend_limit: int = 5
    auth_otp_resend_window_seconds: int = 15 * 60

    email_provider: str = ""
    email_from: str = ""
    email_reply_to: str = ""
    contact_inbox: str = ""
    app_public_url: str = "http://localhost:3000"
    resend_api_key: str = ""
    email_login_alerts_enabled: bool = True

    smtp_host: str = ""
    smtp_port: int = 587
    smtp_username: str = ""
    smtp_password: str = ""
    smtp_from_email: str = ""
    smtp_use_tls: bool = True

    openai_api_key: str = ""
    openrouter_api_key: str = ""
    gemini_api_key: str = ""
    anthropic_api_key: str = ""
    # Per-provider default model ids (empty = unset; resolved against live catalogs).
    openai_default_model: str = ""
    gemini_default_model: str = ""
    anthropic_default_model: str = ""
    openrouter_default_model: str = ""
    # Compat alias: if openrouter_default_model is empty, fall back to this.
    default_openrouter_model: str = ""
    # When multiple keys exist: preferred provider, then ordered priority walk.
    default_platform_provider: str = ""
    platform_provider_priority: str = ""
    # OpenRouter listing: all | free | paid
    openrouter_model_filter: str = "all"
    openrouter_provider_ignore: str = ""
    openrouter_service_tier: str = ""
    openrouter_cache_enabled: bool = True
    embedding_model: str = "text-embedding-3-small"
    embedding_dimension: int = 1536
    material_chunk_size: int = 1400
    material_chunk_overlap: int = 150

    # Headroom context compression (optional; fail-open when disabled or unavailable).
    headroom_enabled: bool = False
    headroom_compress_chat: bool = True
    headroom_compress_generation: bool = True
    headroom_compress_mcp_tools: bool = True
    headroom_compress_attachments: bool = False
    # Install hint only: core | ml — use headroom-ai[ml] in Docker if set to ml.
    headroom_extra: str = "core"

    stripe_secret_key: str = ""
    stripe_webhook_secret: str = ""
    stripe_pro_monthly_price_id: str = ""
    stripe_pro_yearly_price_id: str = ""
    stripe_enterprise_monthly_price_id: str = ""
    stripe_enterprise_yearly_price_id: str = ""

    credits_expiry_days: int = 365
    credits_usd_per_credit: float = 0.02
    credits_pricing_input_usd_per_million: float = 0.15
    credits_pricing_output_usd_per_million: float = 0.60
    credits_margin_multiplier: float = 1.25
    credits_min_charge_per_event: int = 1

    rate_limit_enabled: bool = True
    rate_limit_quiz_generations_per_hour: int = 20
    rate_limit_chat_generations_per_hour: int = 60
    rate_limit_contact_per_hour: int = 5

    super_admin_emails: str = Field(default="")
    upload_dir: str = "uploads"
    public_upload_base_url: str = "/uploads"
    storage_backend: str = "local"
    media_storage_provider: str = "local"
    cloudinary_cloud_name: str | None = None
    cloudinary_api_key: str | None = None
    cloudinary_api_secret: str | None = None
    s3_endpoint_url: str = ""
    s3_access_key_id: str = ""
    s3_secret_access_key: str = ""
    s3_region: str = "auto"
    s3_private_bucket: str = ""
    s3_public_bucket: str = ""
    s3_public_base_url: str = ""
    media_s3_bucket: str = ""
    media_s3_endpoint: str = ""
    media_s3_access_key: str = ""
    media_s3_secret_key: str = ""
    media_s3_cdn_url: str = ""

    @model_validator(mode="after")
    def assemble_database_url(self) -> "Settings":
        if self.database_url.strip():
            if self.database_url.startswith("postgresql://"):
                self.database_url = self.database_url.replace(
                    "postgresql://", "postgresql+psycopg://", 1
                )
            return self
        password = self.postgres_password.strip()
        if not password:
            return self
        self.database_url = (
            f"postgresql+psycopg://{self.postgres_user}:{password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )
        return self

    @property
    def cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.api_cors_origins.split(",") if origin.strip()]

    @property
    def encryption_secret(self) -> str:
        return (self.api_key_encryption_secret or self.auth_secret).strip()

    @property
    def effective_email_from(self) -> str:
        return (self.email_from or self.smtp_from_email).strip()

    @property
    def effective_email_reply_to(self) -> str:
        return self.email_reply_to.strip()

    @property
    def effective_contact_inbox(self) -> str:
        return (self.contact_inbox or self.effective_email_reply_to or "support@knorvex.com").strip()


settings = Settings()
