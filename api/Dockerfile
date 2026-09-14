FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libmupdf-dev \
    && rm -rf /var/lib/apt/lists/*

COPY pyproject.toml .
COPY app ./app
COPY migrations ./migrations
COPY alembic.ini .
COPY scripts/docker-entrypoint.sh /docker-entrypoint.sh

RUN pip install --no-cache-dir . \
    && chmod +x /docker-entrypoint.sh

ENV PYTHONUNBUFFERED=1
EXPOSE 8000

ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
