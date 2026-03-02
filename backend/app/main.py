from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api import auth, estoque, vendas
from app.api.integrations import ml_auth, ml_webhooks

app = FastAPI(
    title="ERP B2B Moderno API",
    description="API para o sistema ERP com integração Mercado Livre",
    version="1.0.0"
)

# Configuração de CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Em produção, especificar os domínios permitidos
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Inclusão dos roteadores (Routers)
app.include_router(auth.router, prefix="/api/auth", tags=["Autenticação"])
app.include_router(estoque.router, prefix="/api/estoque", tags=["Estoque"])
app.include_router(vendas.router, prefix="/api/vendas", tags=["Vendas"])
app.include_router(ml_auth.router, prefix="/api/integrations/ml", tags=["Mercado Livre Auth"])
app.include_router(ml_webhooks.router, prefix="/api/webhooks/ml", tags=["Mercado Livre Webhooks"])

@app.get("/")
def read_root():
    return {"message": "Bem-vindo à API do ERP B2B Moderno"}
