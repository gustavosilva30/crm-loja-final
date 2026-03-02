from fastapi import APIRouter, Request, HTTPException
import httpx
from app.config import settings
from supabase import create_client, Client

router = APIRouter()
supabase: Client = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)

@router.get("/login")
def ml_login():
    url = f"https://auth.mercadolivre.com.br/authorization?response_type=code&client_id={settings.ML_APP_ID}&redirect_uri={settings.ML_REDIRECT_URI}"
    return {"auth_url": url}

@router.get("/callback")
async def ml_callback(code: str, state: str = None):
    async with httpx.AsyncClient() as client:
        response = await client.post(
            "https://api.mercadolibre.com/oauth/token",
            data={
                "grant_type": "authorization_code",
                "client_id": settings.ML_APP_ID,
                "client_secret": settings.ML_SECRET_KEY,
                "code": code,
                "redirect_uri": settings.ML_REDIRECT_URI
            }
        )
        
        if response.status_code != 200:
            raise HTTPException(status_code=400, detail="Erro ao obter token do ML")
            
        data = response.json()
        
        # Salvar no Supabase (Exemplo simplificado, requer user_id no contexto)
        # supabase.table('ml_integracoes').insert({...}).execute()
        
        return {"message": "Integração com Mercado Livre realizada com sucesso", "data": data}
