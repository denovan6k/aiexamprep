from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field

ArtifactType = Literal[
    "chat",
    "quiz",
    "flashcards",
    "summary",
    "study_guide",
    "practice_exam",
    "notes",
    "mind_map",
    "clarify",
    "artifact_choice",
]

GenerationStage = Literal[
    "understanding",
    "reading_material",
    "generating",
    "persisting",
    "completed",
    "failed",
]


class ArtifactIntentParams(BaseModel):
    count: int | None = Field(default=None, ge=1, le=50)
    topic_focus: str | None = Field(default=None, max_length=200)
    question_types: list[str] | None = None
    timer_minutes: int | None = Field(default=None, ge=1, le=180)
    shuffle_questions: bool | None = None
    shuffle_options: bool | None = None
    options_count: int | None = Field(default=None, ge=2, le=6)
    model: str | None = Field(default=None, max_length=200)


class ArtifactIntentResult(BaseModel):
    artifact_type: ArtifactType
    confidence: float = Field(ge=0.0, le=1.0)
    params: ArtifactIntentParams = Field(default_factory=ArtifactIntentParams)
    clarification: str | None = None
    raw: dict[str, Any] | None = None

    def to_generation_intent(self) -> dict[str, Any]:
        """Map to legacy generation intent dict used by jobs/handlers."""
        params = self.params.model_dump(exclude_none=True)
        if self.artifact_type == "flashcards":
            return {"intent": "generate_flashcards", **params}
        if self.artifact_type in {"quiz", "practice_exam"}:
            intent: dict[str, Any] = {"intent": "generate_quiz", **params}
            if self.artifact_type == "practice_exam":
                intent["practice_exam"] = True
            return intent
        if self.artifact_type in {"summary", "study_guide", "notes", "mind_map"}:
            return {"intent": "generate_artifact", "artifact_type": self.artifact_type, **params}
        return {"intent": self.artifact_type, **params}
