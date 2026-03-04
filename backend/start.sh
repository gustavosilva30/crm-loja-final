#!/bin/bash
# Entrypoint script para produção no Render
# Garante que a porta seja lida corretamente de $PORT (Render injeta automaticamente)
# e que o módulo app.main:app seja encontrado com o rootDir = backend/

set -e

PORT="${PORT:-8000}"

echo "🚀 Iniciando ERP B2B Backend na porta $PORT..."
exec uvicorn app.main:app --host 0.0.0.0 --port "$PORT" --workers 1
