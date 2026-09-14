from __future__ import annotations

import logging
import time
from dataclasses import dataclass, field
from http import HTTPStatus
from typing import Any
from uuid import uuid4

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

logger = logging.getLogger("knorvex.api")


@dataclass
class ApiError(Exception):
    message: str
    code: str = "request_failed"
    status_code: int = 400
    fields: dict[str, list[str]] | None = None
    headers: dict[str, str] = field(default_factory=dict)


class NotFoundError(ApiError):
    def __init__(self, message: str = "Resource not found.", *, code: str = "not_found") -> None:
        super().__init__(message=message, code=code, status_code=404)


class PermissionDeniedError(ApiError):
    def __init__(
        self,
        message: str = "You do not have access to this resource.",
        *,
        code: str = "permission_denied",
    ) -> None:
        super().__init__(message=message, code=code, status_code=403)


class ConflictError(ApiError):
    def __init__(self, message: str, *, code: str = "conflict") -> None:
        super().__init__(message=message, code=code, status_code=409)


class RateLimitError(ApiError):
    def __init__(
        self,
        message: str = "Too many requests. Please slow down and try again.",
        *,
        retry_after: int | None = None,
        code: str = "rate_limited",
    ) -> None:
        headers = {"Retry-After": str(retry_after)} if retry_after is not None else {}
        super().__init__(message=message, code=code, status_code=429, headers=headers)


def configure_logging() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )


def _request_id(request: Request) -> str:
    request_id = getattr(request.state, "request_id", None)
    if isinstance(request_id, str) and request_id:
        return request_id
    request_id = str(uuid4())
    request.state.request_id = request_id
    return request_id


def _reason_phrase(status_code: int) -> str:
    try:
        return HTTPStatus(status_code).phrase
    except ValueError:
        return "Request failed"


def _error_payload(
    *,
    request: Request,
    status_code: int,
    message: str,
    code: str,
    fields: dict[str, list[str]] | None = None,
) -> dict[str, Any]:
    error: dict[str, Any] = {
        "code": code,
        "message": message,
        "request_id": _request_id(request),
    }
    if fields:
        error["fields"] = fields
    return {"error": error}


def _validation_fields(exc: RequestValidationError) -> dict[str, list[str]]:
    fields: dict[str, list[str]] = {}
    for error in exc.errors():
        location = [str(part) for part in error.get("loc", ()) if part not in {"body", "query", "path"}]
        key = ".".join(location) or "request"
        message = str(error.get("msg") or "Invalid value.")
        fields.setdefault(key, []).append(message)
    return fields


async def request_context_middleware(request: Request, call_next):
    request_id = request.headers.get("x-request-id") or str(uuid4())
    request.state.request_id = request_id
    start = time.perf_counter()
    try:
        response = await call_next(request)
    except Exception:
        duration_ms = round((time.perf_counter() - start) * 1000, 2)
        logger.exception(
            "request_failed method=%s path=%s duration_ms=%s request_id=%s",
            request.method,
            request.url.path,
            duration_ms,
            request_id,
        )
        return JSONResponse(
            status_code=500,
            content=_error_payload(
                request=request,
                status_code=500,
                message="Something went wrong. Please try again.",
                code="internal_server_error",
            ),
            headers={"x-request-id": request_id},
        )

    duration_ms = round((time.perf_counter() - start) * 1000, 2)
    response.headers["x-request-id"] = request_id
    logger.info(
        "request_completed method=%s path=%s status_code=%s duration_ms=%s request_id=%s",
        request.method,
        request.url.path,
        response.status_code,
        duration_ms,
        request_id,
    )
    return response


async def http_exception_handler(request: Request, exc: StarletteHTTPException) -> JSONResponse:
    status_code = exc.status_code
    message = exc.detail if isinstance(exc.detail, str) else _reason_phrase(status_code)
    log_method = logger.warning if status_code < 500 else logger.error
    log_method(
        "http_error method=%s path=%s status_code=%s detail=%r request_id=%s",
        request.method,
        request.url.path,
        status_code,
        exc.detail,
        _request_id(request),
    )
    return JSONResponse(
        status_code=status_code,
        content=_error_payload(
            request=request,
            status_code=status_code,
            message=message,
            code="http_error",
        ),
        headers=getattr(exc, "headers", None),
    )


async def api_exception_handler(request: Request, exc: ApiError) -> JSONResponse:
    log_method = logger.warning if exc.status_code < 500 else logger.error
    log_method(
        "api_error method=%s path=%s status_code=%s code=%s request_id=%s",
        request.method,
        request.url.path,
        exc.status_code,
        exc.code,
        _request_id(request),
    )
    return JSONResponse(
        status_code=exc.status_code,
        content=_error_payload(
            request=request,
            status_code=exc.status_code,
            message=exc.message,
            code=exc.code,
            fields=exc.fields,
        ),
        headers=exc.headers,
    )


async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    fields = _validation_fields(exc)
    logger.warning(
        "validation_error method=%s path=%s fields=%s request_id=%s",
        request.method,
        request.url.path,
        sorted(fields),
        _request_id(request),
    )
    return JSONResponse(
        status_code=422,
        content=_error_payload(
            request=request,
            status_code=422,
            message="Please fix the highlighted fields and try again.",
            code="validation_error",
            fields=fields,
        ),
    )


async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.exception(
        "unhandled_error method=%s path=%s request_id=%s",
        request.method,
        request.url.path,
        _request_id(request),
    )
    return JSONResponse(
        status_code=500,
        content=_error_payload(
            request=request,
            status_code=500,
            message="Something went wrong. Please try again.",
            code="internal_server_error",
        ),
    )


def install_error_handlers(app: FastAPI) -> None:
    app.middleware("http")(request_context_middleware)
    app.add_exception_handler(ApiError, api_exception_handler)
    app.add_exception_handler(StarletteHTTPException, http_exception_handler)
    app.add_exception_handler(RequestValidationError, validation_exception_handler)
    app.add_exception_handler(Exception, unhandled_exception_handler)
