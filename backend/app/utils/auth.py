import secrets
from fastapi import Request, Header

def get_system_user_id_from_request(request: Request, x_system_user_id: str = Header(None)):
    """
    Helper provisório para obter o ID do usuário do sistema.
    Pode ser obtido via header 'x-system-user-id' ou futuramente via JWT.
    """
    # Se não vier no header, tenta ver se está na querystring (útil para callback)
    user_id = x_system_user_id or request.query_params.get("system_user_id")
    return user_id

def generate_state():
    """
    Gera um state seguro para o fluxo OAuth.
    """
    return secrets.token_hex(16)
