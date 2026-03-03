import httpx
from datetime import datetime, timedelta
from app.config import settings

class MercadoLivreService:
    def __init__(self):
        self.base_url = "https://api.mercadolibre.com"
        self.auth_url = "https://auth.mercadolivre.com.br"

    def get_auth_url(self, state: str):
        """
        Retorna a URL de autorização do Mercado Livre.
        """
        return f"{self.auth_url}/authorization?response_type=code&client_id={settings.ML_APP_ID}&redirect_uri={settings.ML_REDIRECT_URI}&state={state}"

    async def exchange_code_for_token(self, code: str):
        """
        Troca o authorization code pelo access token.
        """
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/oauth/token",
                data={
                    "grant_type": "authorization_code",
                    "client_id": settings.ML_APP_ID,
                    "client_secret": settings.ML_CLIENT_SECRET,
                    "code": code,
                    "redirect_uri": settings.ML_REDIRECT_URI
                },
                headers={"Content-Type": "application/x-www-form-urlencoded"}
            )
            response.raise_for_status()
            return response.json()

    async def refresh_token(self, refresh_token: str):
        """
        Renova o access token usando o refresh token.
        """
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/oauth/token",
                data={
                    "grant_type": "refresh_token",
                    "client_id": settings.ML_APP_ID,
                    "client_secret": settings.ML_CLIENT_SECRET,
                    "refresh_token": refresh_token
                },
                headers={"Content-Type": "application/x-www-form-urlencoded"}
            )
            response.raise_for_status()
            return response.json()

    async def get_user_info(self, access_token: str):
        """
        Busca informações do usuário logado no ML.
        """
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.base_url}/users/me",
                headers={"Authorization": f"Bearer {access_token}"}
            )
            response.raise_for_status()
            return response.json()

ml_service = MercadoLivreService()
