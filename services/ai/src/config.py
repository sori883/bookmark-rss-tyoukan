from functools import lru_cache

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    auth_service_url: str
    feed_service_url: str
    notification_service_url: str
    ai_client_id: str
    ai_client_secret: str
    aws_region: str = "us-east-1"
    bedrock_model_id: str = "anthropic.claude-haiku-4-5-20251001-v1:0"

    log_level: str = "info"
    max_articles_per_request: int = 100
    max_digest_articles: int = 10
    jwt_cache_margin_seconds: int = 300
    require_auth: bool = False

    model_config = {"env_prefix": "", "case_sensitive": False}


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
