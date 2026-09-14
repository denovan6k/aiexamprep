from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy.orm import Session

from app.models import AdminAuditLog, User


class AdminAuditService:
    def log(
        self,
        db: Session,
        *,
        admin: User,
        action: str,
        target_type: str,
        target_id: uuid.UUID | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> AdminAuditLog:
        entry = AdminAuditLog(
            admin_user_id=admin.id,
            action=action,
            target_type=target_type,
            target_id=target_id,
            audit_metadata=metadata,
        )
        db.add(entry)
        return entry
