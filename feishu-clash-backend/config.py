import os
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Configs(BaseSettings):

    GOOGLE_CLOUD_PROJECT: str = ""
    GOOGLE_CLOUD_LOCATION: str = "global"
    GOOGLE_CLOUD_GCS_BUCKET: str = ""
    GOOGLE_SERVICE_ACCOUNT: str = ""
    GOOGLE_APPLICATION_CREDENTIALS: str = ""

    API_KEY: str = "sk-5eW9L2pR8xK3mN7qB4vD1cF6gH8jM2nQ4tY7wZ0"

    model_config = SettingsConfigDict(
        env_file=Path(__file__).parent / f".env.{os.getenv("ENV", "development")}",
        env_file_encoding="utf-8",
        env_nested_delimiter="__",
        extra="ignore",
    )


env = os.getenv("ENV", "development")
env_file_path = Path(__file__).parent / f".env.{env}"
print(f"ENV: {env}")
print(f"ENV file: {env_file_path} ENV file exists: {env_file_path.exists()}")
configs = Configs()
print(configs)