from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "sqlite:///./dev.db"
    jwt_secret: str = "change-me-in-production"
    jwt_ttl_minutes: int = 60 * 12
    cors_origins: str = "http://localhost:3000"
    environment: str = "development"

    # Optional integrations — each degrades gracefully when unset.
    whatsapp_token: str | None = None          # WhatsApp Business Platform (Cloud API) access token
    whatsapp_phone_number_id: str | None = None
    whatsapp_template_new_request: str = "new_part_request"
    anthropic_api_key: str | None = None       # optional LLM query extraction
    anthropic_model: str = "claude-opus-5-5"
    nhtsa_base_url: str = "https://vpic.nhtsa.dot.gov/api/vehicles"
    storage_bucket_url: str | None = None      # e.g. Supabase Storage / S3 public base URL

    rate_limit_per_minute: int = 120
    catalog_path: str = str(Path(__file__).resolve().parents[2] / "shared" / "catalog.json")

    @property
    def cors_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    s = Settings()
    if s.environment == "production" and s.jwt_secret == "change-me-in-production":
        raise RuntimeError("JWT_SECRET must be set in production")
    return s
