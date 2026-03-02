from fastapi import APIRouter, HTTPException
from typing import List
from app.models import VendaCreate, VendaResponse
from app.config import settings
from supabase import create_client, Client

router = APIRouter()
supabase: Client = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)

@router.get("/", response_model=List[VendaResponse])
def listar_vendas():
    response = supabase.table("vendas").select("*").execute()
    return response.data

@router.post("/", response_model=VendaResponse)
def criar_venda(venda: VendaCreate):
    # 1. Inserir Venda
    venda_data = venda.model_dump(exclude={"itens"})
    venda_res = supabase.table("vendas").insert(venda_data).execute()
    
    if not venda_res.data:
        raise HTTPException(status_code=400, detail="Erro ao criar venda")
        
    venda_id = venda_res.data[0]["id"]
    
    # 2. Inserir Itens
    itens_data = [{"venda_id": venda_id, **item.model_dump()} for item in venda.itens]
    supabase.table("vendas_itens").insert(itens_data).execute()
    
    # 3. Atualizar Estoque (Simplificado)
    for item in venda.itens:
        # Lógica para decrementar estoque_atual na tabela produtos
        pass
        
    return venda_res.data[0]
