import pytest
from pydantic import ValidationError

from src.config import Settings


class TestSettings:
    def test_loads_with_all_env_vars(self, monkeypatch: pytest.MonkeyPatch) -> None:
        settings = Settings()  # type: ignore[call-arg]
        assert settings.auth_service_url == "http://auth:3000"
        assert settings.feed_service_url == "http://feed:3001"
        assert settings.ai_client_id == "test-client-id"

    def test_defaults(self) -> None:
        settings = Settings()  # type: ignore[call-arg]
        assert settings.log_level == "debug"
        assert settings.max_articles_per_request == 100
        assert settings.max_digest_articles == 10
        assert settings.jwt_cache_margin_seconds == 300
        assert settings.require_auth is False

    def test_missing_required_env_var(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.delenv("AUTH_SERVICE_URL")
        with pytest.raises(ValidationError):
            Settings()  # type: ignore[call-arg]
