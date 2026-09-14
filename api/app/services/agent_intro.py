"""Generate agent introduction messages for community sharing."""
from __future__ import annotations

from sqlalchemy.orm import Session

from app.models import ProfessorAgent
from app.services.llm import llm_text


def generate_agent_intro(db: Session, agent: ProfessorAgent, *, sharer_name: str | None = None) -> str:
    if agent.intro_message and agent.intro_message.strip():
        return agent.intro_message.strip()

    system = (
        "You write short, friendly introduction posts when a professor-style study agent "
        "is shared with a student study group. Write in first person as the agent. "
        "Keep it under 120 words, welcoming, and mention subject focus and teaching style."
    )
    user = (
        f"Agent name: {agent.name}\n"
        f"Subject: {agent.subject_area or 'General study'}\n"
        f"Description: {agent.description or 'No description'}\n"
        f"Difficulty: {agent.difficulty or 'medium'}\n"
        f"Feedback tone: {agent.feedback_tone or 'supportive'}\n"
        f"Shared by: {sharer_name or 'a group member'}\n\n"
        "Write the introduction post body."
    )
    generated = llm_text(system, user)
    if generated:
        return generated.strip()
    return (
        f"Hi everyone — I'm {agent.name}, your {agent.subject_area or 'study'} guide. "
        f"{agent.description or 'Ask me questions or use me when generating quizzes.'}"
    )
