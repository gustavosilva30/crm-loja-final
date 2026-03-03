from fastapi import APIRouter, Request, HTTPException, Depends, Query
from fastapi.responses import RedirectResponse
from datetime import datetime, timedelta
from app.services.mercadolivre import ml_service
from app.services.supabase_service import supabase_service
from app.utils.auth import get_system_user_id_from_request, generate_state
from app.utils.ml_helper import get_valid_ml_token
from app.config import settings

router = APIRouter()

@router.get("/connect")
async def ml_connect(system_user_id: str = Depends(get_system_user_id_from_request)):
    """
    Gera a URL de autorização do Mercado Livre.
    """
    if not system_user_id:
        raise HTTPException(status_code=400, detail="system_user_id é obrigatório")
    
    state = generate_state()
    # No futuro, podemos salvar este state no Redis/DB para validar no callback
    auth_url = ml_service.get_auth_url(state=state)
    
    return {
        "authUrl": auth_url,
        "state": state
    }

@router.get("/callback")
async def ml_callback(request: Request, code: str, state: str = None):
    """
    Recebe o código do ML, troca por token e salva a conta.
    """
    # Recupera o system_user_id (provisório via query ou futuramente via state/session)
    system_user_id = get_system_user_id_from_request(request)
    
    if not system_user_id:
        raise HTTPException(status_code=400, detail="system_user_id não identificado no callback")

    try:
        # 1. Troca code por token
        token_data = await ml_service.exchange_code_for_token(code)
        
        # 2. Busca info do usuário no ML
        ml_user = await ml_service.get_user_info(token_data["access_token"])
        
        # 3. Prepara dados para o Supabase
        expires_at = datetime.utcnow() + timedelta(seconds=token_data["expires_in"])
        account_data = {
            "system_user_id": system_user_id,
            "ml_user_id": ml_user["id"],
            "ml_nickname": ml_user["nickname"],
            "ml_site_id": ml_user["site_id"],
            "access_token": token_data["access_token"],
            "refresh_token": token_data["refresh_token"],
            "token_expires_at": expires_at.isoformat(),
            "scope": token_data["scope"],
            "is_active": True
        }
        
        # 4. Salva no banco (Upsert)
        supabase_service.upsert_ml_account(account_data)
        
        # 5. Redireciona para o painel (ajuste a URL conforme necessário)
        dashboard_url = "/configuracoes/integracoes?success=true"
        return RedirectResponse(url=dashboard_url)

    except Exception as e:
        print(f"Erro no ML Callback: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Erro ao processar integração: {str(e)}")

@router.get("/accounts")
async def list_ml_accounts(system_user_id: str = Depends(get_system_user_id_from_request)):
    """
    Lista as contas do Mercado Livre conectadas.
    """
    if not system_user_id:
        raise HTTPException(status_code=400, detail="system_user_id não identificado")
    
    try:
        response = supabase_service.get_ml_accounts(system_user_id)
        return response.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/refresh")
async def refresh_account_token(
    account_id: str, 
    system_user_id: str = Depends(get_system_user_id_from_request)
):
    """
    Força a renovação do token de uma conta específica.
    """
    if not system_user_id:
        raise HTTPException(status_code=400, detail="system_user_id não identificado")
    
    try:
        # O helper já faz o refresh se necessário, mas aqui forçamos o uso dele
        # para retornar o estado atualizado.
        token = await get_valid_ml_token(account_id, system_user_id)
        
        # Busca os dados atualizados para retornar
        response = supabase_service.get_ml_account_by_id(account_id, system_user_id)
        return response.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
