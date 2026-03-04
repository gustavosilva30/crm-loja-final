from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    SUPABASE_URL: str
    SUPABASE_KEY: str  # Anon Key ou Service Role dependendo do contexto
    SUPABASE_SERVICE_ROLE_KEY: Optional[str] = None
    
    ML_APP_ID: str
    ML_CLIENT_SECRET: str
    ML_REDIRECT_URI: str
    
    # Aliases para compatibilidade se necessário
    # ML_SECRET_KEY: str = "" # Omitido para favorecer ML_CLIENT_SECRET
    
    REDIS_URL: str = "redis://localhost:6379/0"
    SECRET_KEY: str = "supersecretkey" # Mudar em produção
    ALGORITHM: str = "HS256"

    class Config:
        env_file = ".env"
        env_file_encoding = 'utf-8'
        # Permite carregar mesmo se algumas variáveis faltarem (trataremos com erro se necessário)
        extra = "ignore"

settings = Settings()
