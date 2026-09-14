from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.core.config import settings
from app.core.errors import configure_logging, install_error_handlers
from app.routes import api_router
from app.services.worker_readiness import log_generation_runtime


def create_app() -> FastAPI:
    configure_logging()
    app = FastAPI(
        title=settings.app_name,
        version=settings.app_version,
        description="Agentic exam preparation API.",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    install_error_handlers(app)

    @app.on_event("startup")
    def _log_api_generation_runtime() -> None:
        log_generation_runtime("api")

    app.include_router(api_router)
    Path(settings.upload_dir).mkdir(parents=True, exist_ok=True)
    app.mount(settings.public_upload_base_url, StaticFiles(directory=settings.upload_dir), name="uploads")
    return app


app = create_app()
