from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol


@dataclass(frozen=True)
class OutboundEmail:
    to: str
    subject: str
    html: str
    text: str
    reply_to: str | None = None


class EmailProvider(Protocol):
    def send(self, message: OutboundEmail) -> None:
        ...
