from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from uuid import UUID

# --- Modelos de Produto ---
class ProdutoBase(BaseModel):
    sku: str
    sku_ml: Optional[str] = None
    nome: str
    descricao: Optional[str] = None
    estoque_atual: int = 0
    estoque_minimo: int = 5
    custo: float = 0.0
    preco: float = 0.0
    categoria_id: Optional[UUID] = None

class ProdutoCreate(ProdutoBase):
    pass

class ProdutoResponse(ProdutoBase):
    id: UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# --- Modelos de Venda ---
class VendaItemBase(BaseModel):
    produto_id: UUID
    quantidade: int
    preco_unitario: float

class VendaBase(BaseModel):
    cliente_id: Optional[UUID] = None
    total: float
    status: str = "Pendente"
    origem_ml: bool = False
    ml_order_id: Optional[str] = None

class VendaCreate(VendaBase):
    itens: List[VendaItemBase]

class VendaResponse(VendaBase):
    id: UUID
    data_venda: datetime
    created_at: datetime

    class Config:
        from_attributes = True
