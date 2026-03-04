"""
Módulo de Leilões — Router FastAPI isolado
Endpoints REST para o n8n e para o frontend.
NÃO modifica nenhum serviço ou rota existente.
"""

from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional
from pydantic import BaseModel, field_validator
from datetime import datetime
from app.config import settings
from supabase import create_client, Client

router = APIRouter()
supabase: Client = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)

# ---------------------------------------------------------------------------
# Constantes
# ---------------------------------------------------------------------------
VALID_SCRAP_TYPES = {"aproveitavel", "inservivel"}

def normalize_scrap_type(value: str) -> str:
    """
    Tenta normalizar o scrap_type recebido para 'aproveitavel' ou 'inservivel'.
    Remove acentos comuns e faz lowercase.
    """
    mapping = {
        "aproveitavel": "aproveitavel",
        "aproveitável": "aproveitavel",
        "reaproveitavel": "aproveitavel",
        "reaproveitável": "aproveitavel",
        "inservivel": "inservivel",
        "inservível": "inservivel",
        "inutilizavel": "inservivel",
        "inutilizável": "inservivel",
        "sucata": "inservivel",
    }
    normalized = mapping.get(value.strip().lower())
    if not normalized:
        raise ValueError(
            f"scrap_type inválido: '{value}'. "
            f"Valores aceitos: {sorted(VALID_SCRAP_TYPES)}"
        )
    return normalized


# ---------------------------------------------------------------------------
# Schemas Pydantic
# ---------------------------------------------------------------------------

class AuctionSourceCreate(BaseModel):
    name: str
    source_url: str
    is_active: bool = True
    notes: Optional[str] = None


class AuctionSourceUpdate(BaseModel):
    name: Optional[str] = None
    source_url: Optional[str] = None
    is_active: Optional[bool] = None
    notes: Optional[str] = None


class AuctionLotItem(BaseModel):
    lot_number: str
    lot_name: str
    lot_url: str
    scrap_type: str
    city: Optional[str] = None
    auction_start_at: Optional[datetime] = None
    auction_end_at: Optional[datetime] = None
    external_hash: Optional[str] = None

    @field_validator("scrap_type", mode="before")
    @classmethod
    def validate_scrap_type(cls, v):
        return normalize_scrap_type(v)


class AuctionLotsUpsertPayload(BaseModel):
    source_id: str
    lots: List[AuctionLotItem]


class AuctionLogCreate(BaseModel):
    source_id: Optional[str] = None
    status: str
    message: Optional[str] = None
    items_found: int = 0


class AuctionSearchRequest(BaseModel):
    term: str


# ---------------------------------------------------------------------------
# SOURCES
# ---------------------------------------------------------------------------

@router.get("/sources", tags=["Leilões - Fontes"])
def list_sources():
    """Lista todas as fontes de leilão."""
    result = supabase.table("auction_sources").select("*").order("name").execute()
    return {"data": result.data}


@router.post("/sources", tags=["Leilões - Fontes"])
def create_source(payload: AuctionSourceCreate):
    """Cria uma nova fonte de leilão."""
    result = supabase.table("auction_sources").insert(payload.model_dump()).execute()
    if not result.data:
        raise HTTPException(status_code=400, detail="Erro ao criar fonte")
    return {"data": result.data[0]}


@router.put("/sources/{source_id}", tags=["Leilões - Fontes"])
def update_source(source_id: str, payload: AuctionSourceUpdate):
    """Atualiza uma fonte de leilão existente."""
    updates = {k: v for k, v in payload.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="Nenhum campo para atualizar")
    result = (
        supabase.table("auction_sources")
        .update(updates)
        .eq("id", source_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Fonte não encontrada")
    return {"data": result.data[0]}


# ---------------------------------------------------------------------------
# LOTS
# ---------------------------------------------------------------------------

@router.get("/lots", tags=["Leilões - Lotes"])
def list_lots(
    source_id:  Optional[str] = Query(None),
    city:       Optional[str] = Query(None),
    scrap_type: Optional[str] = Query(None),
    lot_number: Optional[str] = Query(None),
    lot_name:   Optional[str] = Query(None),
    limit:      int = Query(100, le=500),
    offset:     int = Query(0),
):
    """Lista lotes com filtros opcionais."""
    query = (
        supabase.table("auction_lots")
        .select("*, auction_sources(name, source_url)")
        .order("auction_end_at", desc=False)
    )
    if source_id:
        query = query.eq("source_id", source_id)
    if city:
        query = query.ilike("city", f"%{city}%")
    if scrap_type:
        try:
            st = normalize_scrap_type(scrap_type)
            query = query.eq("scrap_type", st)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
    if lot_number:
        query = query.ilike("lot_number", f"%{lot_number}%")
    if lot_name:
        query = query.ilike("lot_name", f"%{lot_name}%")

    result = query.range(offset, offset + limit - 1).execute()
    return {"data": result.data, "count": len(result.data)}


@router.post("/lots/upsert", tags=["Leilões - Lotes"])
def upsert_lots(payload: AuctionLotsUpsertPayload):
    """
    Endpoint principal para o n8n.
    Recebe uma lista de lotes e faz upsert no banco.
    Aceita lote único ou lista.
    Evita duplicatas via constraint UNIQUE(source_id, lot_number).
    """
    if not payload.lots:
        raise HTTPException(status_code=400, detail="Lista de lotes está vazia")

    rows = []
    for lot in payload.lots:
        row = lot.model_dump()
        row["source_id"] = payload.source_id
        # Converte datetime para ISO string para o Supabase
        for dt_field in ("auction_start_at", "auction_end_at"):
            if row.get(dt_field) and hasattr(row[dt_field], "isoformat"):
                row[dt_field] = row[dt_field].isoformat()
        rows.append(row)

    result = (
        supabase.table("auction_lots")
        .upsert(rows, on_conflict="source_id,lot_number")
        .execute()
    )

    return {
        "message": f"{len(result.data)} lotes processados com sucesso",
        "upserted": len(result.data),
        "data": result.data,
    }


# ---------------------------------------------------------------------------
# SEARCH
# ---------------------------------------------------------------------------

@router.post("/search", tags=["Leilões - Busca"])
def search_lots(payload: AuctionSearchRequest):
    """
    Busca lotes por nome, número ou cidade.
    Retorna resultados ordenados por data de fim do leilão.
    """
    term = payload.term.strip()
    if not term:
        raise HTTPException(status_code=400, detail="Termo de busca não pode ser vazio")

    result = (
        supabase.table("auction_lots")
        .select("*, auction_sources(name, source_url)")
        .or_(
            f"lot_name.ilike.%{term}%,"
            f"lot_number.ilike.%{term}%,"
            f"city.ilike.%{term}%"
        )
        .order("auction_end_at", desc=False)
        .limit(200)
        .execute()
    )

    return {"data": result.data, "count": len(result.data), "term": term}


# ---------------------------------------------------------------------------
# LOGS
# ---------------------------------------------------------------------------

@router.get("/logs", tags=["Leilões - Logs"])
def list_logs(
    source_id: Optional[str] = Query(None),
    limit: int = Query(50, le=200),
):
    """Lista logs de coleta do n8n, mais recentes primeiro."""
    query = (
        supabase.table("auction_logs")
        .select("*, auction_sources(name)")
        .order("created_at", desc=True)
        .limit(limit)
    )
    if source_id:
        query = query.eq("source_id", source_id)
    result = query.execute()
    return {"data": result.data}


@router.post("/logs", tags=["Leilões - Logs"])
def create_log(payload: AuctionLogCreate):
    """Registra um log de coleta."""
    result = supabase.table("auction_logs").insert(payload.model_dump()).execute()
    if not result.data:
        raise HTTPException(status_code=400, detail="Erro ao registrar log")
    return {"data": result.data[0]}
