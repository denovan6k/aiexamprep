from __future__ import annotations

import logging

from app.services.email.base import EmailProvider, OutboundEmail


logger = logging.getLogger(__name__)


class ConsoleEmailProvider:
    def send(self, message: OutboundEmail) -> None:
        logger.warning(
            "DEV_EMAIL to=%s subject=%s\n--- text ---\n%s",
            message.to,
            message.subject,
            message.text,
        )
