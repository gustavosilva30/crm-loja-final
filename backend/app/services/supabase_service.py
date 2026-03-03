from datetime import datetime, timedelta
from supabase import create_client, Client
from app.config import settings

class SupabaseService:
    def __init__(self):
        self.client: Client = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)

    def upsert_ml_account(self, account_data: dict):
        """
        Salva ou atualiza uma conta do Mercado Livre.
        A chave de conflito é (system_user_id, ml_user_id) definida no SQL.
        """
        # Adiciona timestamp de atualização
        account_data["updated_at"] = datetime.utcnow().isoformat()
        
        return self.client.table("mercadolivre_accounts").upsert(
            account_data, 
            on_conflict="system_user_id, ml_user_id"
        ).execute()

    def get_ml_accounts(self, system_user_id: str):
        """
        Lista todas as contas do ML vinculadas a um usuário do sistema.
        """
        return self.client.table("mercadolivre_accounts")\
            .select("id, ml_user_id, ml_nickname, ml_site_id, is_active, token_expires_at, created_at")\
            .eq("system_user_id", system_user_id)\
            .execute()

    def get_ml_account_by_id(self, account_id: str, system_user_id: str):
        """
        Busca uma conta específica do ML.
        """
        return self.client.table("mercadolivre_accounts")\
            .select("*")\
            .eq("id", account_id)\
            .eq("system_user_id", system_user_id)\
            .single()\
            .execute()

supabase_service = SupabaseService()
