from pydantic import Field
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    model_config = {"env_prefix": "MCP_"}

    api_url: str = Field(default="http://localhost:3001")
    jwt_token: str = Field(default="")


settings = Settings()
