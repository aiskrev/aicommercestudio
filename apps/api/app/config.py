"""Application settings loaded from environment variables (12-factor style)."""

from __future__ import annotations

from functools import lru_cache
from typing import Literal

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_WEAK_SECRET_MARKERS = ("change-me", "changeme", "secret", "password", "example")


class Settings(BaseSettings):
    model_config = SettingsConfigDict(extra="ignore", case_sensitive=False)

    app_env: Literal["development", "test", "production"] = "development"
    app_name: str = "A.I. Commerce Studio API"
    log_level: str = "INFO"

    database_url: str = "postgresql+psycopg://acs:acs@localhost:5433/acs"

    # Required: there is intentionally no default secret.
    secret_key: str = Field(min_length=32)
    cors_origins: str = "http://localhost:3000"
    cookie_secure: bool | None = None
    session_cookie_name: str = "acs_session"
    csrf_cookie_name: str = "acs_csrf"
    session_ttl_hours: int = Field(default=8, ge=1, le=72)
    # Sessions without activity for this long are revoked (absolute TTL still applies).
    session_idle_minutes: int = Field(default=60, ge=5, le=24 * 60)
    # Persistent account lockout after consecutive failed logins.
    login_lockout_threshold: int = Field(default=5, ge=3, le=50)
    login_lockout_minutes: int = Field(default=15, ge=1, le=24 * 60)
    trust_proxy_headers: bool = True
    enable_api_docs: bool | None = None
    max_request_body_bytes: int = 64 * 1024

    contact_rate_limit: int = Field(default=5, ge=1)
    contact_rate_window_seconds: int = Field(default=600, ge=1)
    # Backstop across all clients (per window) in case per-IP limits are bypassed via spoofed headers.
    contact_global_rate_limit: int = Field(default=60, ge=1)
    login_rate_limit: int = Field(default=10, ge=1)
    login_rate_window_seconds: int = Field(default=900, ge=1)
    form_token_min_seconds: int = Field(default=3, ge=0)
    form_token_max_age_seconds: int = Field(default=7200, ge=60)

    lead_retention_days: int = Field(default=730, ge=30)
    audit_retention_days: int = Field(default=1095, ge=30)
    privacy_notice_version: str = "2026-10-draft"
    # Version of the marketing-consent wording shown next to the opt-in checkbox (recorded with consent).
    marketing_consent_version: str = "2026-10-v1"

    admin_bootstrap_email: str | None = None
    admin_bootstrap_password: str | None = None
    admin_bootstrap_name: str = "Администратор"
    seed_sample_data: bool = False

    ai_provider: Literal["mock", "anthropic"] = "mock"
    anthropic_api_key: str | None = None
    anthropic_model: str = "claude-opus-5-5"
    anthropic_timeout_seconds: float = 30.0

    # AI Business Automation Advisor (public, anonymous).
    advisor_rate_limit: int = Field(default=5, ge=1)
    advisor_rate_window_seconds: int = Field(default=3600, ge=1)
    advisor_global_rate_limit: int = Field(default=120, ge=1)
    # Per-attempt timeout for the AI provider; at most one retry (~2× worst case).
    advisor_timeout_seconds: float = Field(default=45.0, ge=5, le=120)
    # Unlinked assessments are deleted after this many days; linked ones follow the lead.
    advisor_retention_days: int = Field(default=30, ge=1, le=365)

    # AI Readiness Assessment: anonymous PDF reports (CPU-bound, so rate-limited) and submissions.
    readiness_report_rate_limit: int = Field(default=10, ge=1)
    readiness_report_rate_window_seconds: int = Field(default=600, ge=1)
    readiness_report_global_rate_limit: int = Field(default=300, ge=1)
    # Leads created from the assessment are deleted after this many days without activity
    # (shorter than LEAD_RETENTION_DAYS; whichever applies first wins).
    readiness_retention_days: int = Field(default=365, ge=30, le=3650)

    # AI team configurator: cost estimates, PDF reports, saved configurations and consultations.
    # Optional path to an alternative cost assumptions document (default: app/team/pricing/2026-10.1.json).
    team_cost_assumptions_file: str | None = None
    team_estimate_rate_limit: int = Field(default=60, ge=1)
    team_report_rate_limit: int = Field(default=10, ge=1)
    team_save_rate_limit: int = Field(default=10, ge=1)
    team_lookup_rate_limit: int = Field(default=30, ge=1)
    team_rate_window_seconds: int = Field(default=600, ge=1)
    team_global_rate_limit: int = Field(default=600, ge=1)
    # Saved configurations without a consultation request are deleted after this many days;
    # those attached to a lead follow the lead (and READINESS-style shorter retention below).
    team_configuration_retention_days: int = Field(default=90, ge=1, le=730)
    # Leads created from the configurator are deleted after this many days without activity.
    team_lead_retention_days: int = Field(default=365, ge=30, le=3650)

    smtp_host: str | None = None
    smtp_port: int = 587
    smtp_username: str | None = None
    smtp_password: str | None = None
    smtp_starttls: bool = True
    smtp_from: str | None = None
    lead_notification_email: str | None = None

    shopify_store_domain: str | None = None
    shopify_admin_api_token: str | None = None
    woocommerce_url: str | None = None
    woocommerce_consumer_key: str | None = None
    woocommerce_consumer_secret: str | None = None
    crm_provider: str | None = None
    automation_webhook_url: str | None = None
    seo_data_provider: str | None = None

    site_url: str = "http://localhost:3000"

    @property
    def is_production(self) -> bool:
        return self.app_env == "production"

    @property
    def secure_cookies(self) -> bool:
        if self.is_production:
            return True
        return bool(self.cookie_secure)

    @property
    def docs_enabled(self) -> bool:
        if self.enable_api_docs is None:
            return not self.is_production
        return self.enable_api_docs

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip().rstrip("/") for o in self.cors_origins.split(",") if o.strip()]

    @property
    def email_enabled(self) -> bool:
        return bool(self.smtp_host and self.smtp_from and self.lead_notification_email)

    @model_validator(mode="after")
    def _validate_production(self) -> Settings:
        if not self.is_production:
            return self
        problems: list[str] = []
        lowered = self.secret_key.lower()
        if any(marker in lowered for marker in _WEAK_SECRET_MARKERS):
            problems.append("SECRET_KEY looks like a placeholder")
        if "*" in self.cors_origins:
            problems.append("CORS_ORIGINS must not contain '*' in production")
        if self.cookie_secure is False:
            problems.append("COOKIE_SECURE=false is not allowed in production")
        if self.seed_sample_data:
            problems.append("SEED_SAMPLE_DATA must be false in production")
        if not self.site_url.startswith("https://"):
            problems.append("SITE_URL must use https:// in production")
        if any(not origin.startswith("https://") for origin in self.cors_origin_list):
            problems.append("CORS_ORIGINS must only contain https:// origins in production")
        if problems:
            raise ValueError("Unsafe production configuration: " + "; ".join(problems))
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
