from fastapi import APIRouter, HTTPException
from typing import List
from app.models import ProdutoCreate, ProdutoResponse
from app.config import settings
from supabase import create_client, Client

router = APIRouter()
supabase: Client = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)

@router.get("/", response_model=List[ProdutoResponse])
def listar_produtos():
    response = supabase.table("produtos").select("*").execute()
    return response.data

@router.post("/", response_model=ProdutoResponse)
def criar_produto(produto: ProdutoCreate):
    response = supabase.table("produtos").insert(produto.model_dump()).execute()
    if not response.data:
        raise HTTPException(status_code=400, detail="Erro ao criar produto")
    return response.data[0]
