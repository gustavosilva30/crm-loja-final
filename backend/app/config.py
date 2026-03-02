from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    SUPABASE_URL: str
    SUPABASE_KEY: str
    ML_APP_ID: str
    ML_SECRET_KEY: str
    ML_REDIRECT_URI: str
    REDIS_URL: str = "redis://localhost:6379/0"
    SECRET_KEY: str = "supersecretkey" # Mudar em produção
    ALGORITHM: str = "HS256"

    class Config:
        env_file = ".env"

settings = Settings()
