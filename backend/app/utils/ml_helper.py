from datetime import datetime, timedelta
from app.services.supabase_service import supabase_service
from app.services.mercadolivre import ml_service

async def get_valid_ml_token(account_id: str, system_user_id: str):
    """
    Recupera um access token válido para uma conta. 
    Se expirou, renova automaticamente.
    """
    # 1. Busca a conta no banco
    response = supabase_service.get_ml_account_by_id(account_id, system_user_id)
    if not response or not response.data:
        raise Exception("Conta não encontrada ou sem acesso.")
    
    account = response.data
    expires_at = datetime.fromisoformat(account["token_expires_at"].replace("Z", "+00:00"))
    
    # 2. Verifica se expirou (com margem de 1 minuto)
    if datetime.utcnow() + timedelta(minutes=1) < expires_at.replace(tzinfo=None):
        return account["access_token"]
    
    # 3. Se expirou, renova
    print(f"Token expirado para conta {account_id}, renovando...")
    new_tokens = await ml_service.refresh_token(account["refresh_token"])
    
    # 4. Salva no banco
    new_expires_at = datetime.utcnow() + timedelta(seconds=new_tokens["expires_in"])
    update_data = {
        "access_token": new_tokens["access_token"],
        "refresh_token": new_tokens["refresh_token"],
        "token_expires_at": new_expires_at.isoformat(),
        "updated_at": datetime.utcnow().isoformat()
    }
    supabase_service.client.table("mercadolivre_accounts").update(update_data).eq("id", account_id).execute()
    
    return new_tokens["access_token"]
