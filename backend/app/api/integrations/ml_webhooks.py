from fastapi import APIRouter, Request, BackgroundTasks
from typing import Dict, Any

router = APIRouter()

def process_ml_webhook(payload: Dict[Any, Any]):
    # Lógica para processar o webhook (ex: novo pedido, nova pergunta)
    # Idealmente, isso iria para uma fila Celery/Redis
    topic = payload.get("topic")
    resource = payload.get("resource")
    print(f"Processando webhook ML: Topic={topic}, Resource={resource}")
    # Se topic == 'orders', buscar detalhes do pedido e inserir na tabela vendas

@router.post("/")
async def receive_webhook(request: Request, background_tasks: BackgroundTasks):
    payload = await request.json()
    
    # Responder rapidamente ao ML (HTTP 200) e processar em background
    background_tasks.add_task(process_ml_webhook, payload)
    
    return {"status": "received"}
