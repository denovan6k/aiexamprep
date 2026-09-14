#!/bin/sh
set -e

if [ "${RUN_MIGRATIONS:-false}" = "true" ]; then
  echo "Running Alembic migrations..."
  alembic upgrade head
fi

# Railway startCommand is exec'd without a shell, so "$PORT" is passed literally.
# Normalize uvicorn startup to bind the injected PORT env var.
if [ "$1" = "uvicorn" ]; then
  exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}"
fi

if [ $# -eq 0 ]; then
  exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}"
fi

exec "$@"
