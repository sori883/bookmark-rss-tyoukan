from pydantic import Field
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    model_config = {"env_prefix": "MCP_"}

    bff_url: str = Field(default="http://localhost:3010")
    jwt_token: str = Field(default="")


settings = Settings()
