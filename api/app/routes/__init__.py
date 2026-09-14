from fastapi import APIRouter

from app.routes import (
    admin,
    agent_mcp,
    agents,
    ai,
    analytics,
    auth,
    billing,
    blog,
    chat,
    community,
    contact,
    courses,
    cv,
    flashcards,
    generation_profiles,
    health,
    institutions,
    jobs,
    materials,
    media,
    moderation,
    onboarding,
    progress,
    quizzes,
    search,
    settings as settings_routes,
    study,
    study_artifacts,
    support,
)

api_router = APIRouter()
api_router.include_router(health.router, tags=["health"])
api_router.include_router(ai.router, prefix="/ai", tags=["ai"])
api_router.include_router(analytics.router, prefix="/analytics", tags=["analytics"])
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(chat.router, prefix="/chat", tags=["chat"])
api_router.include_router(courses.router, prefix="/courses", tags=["courses"])
api_router.include_router(cv.router, prefix="/cv", tags=["cv"])
api_router.include_router(materials.router, prefix="/materials", tags=["materials"])
api_router.include_router(media.router, prefix="/chat/media", tags=["media"])
api_router.include_router(jobs.router, prefix="/jobs", tags=["jobs"])
api_router.include_router(institutions.router, prefix="/institutions", tags=["institutions"])
api_router.include_router(agents.router, prefix="/agents", tags=["agents"])
api_router.include_router(agent_mcp.router, prefix="/agents", tags=["agent-mcp"])
api_router.include_router(quizzes.router, prefix="/quizzes", tags=["quizzes"])
api_router.include_router(search.router, prefix="/search", tags=["search"])
api_router.include_router(flashcards.router, prefix="/flashcard-decks", tags=["flashcards"])
api_router.include_router(
    generation_profiles.router,
    prefix="/generation-profiles",
    tags=["generation-profiles"],
)
api_router.include_router(progress.router, prefix="/progress", tags=["progress"])
api_router.include_router(blog.router, prefix="/blog", tags=["blog"])
api_router.include_router(community.router, prefix="/community", tags=["community"])
api_router.include_router(moderation.router, prefix="/moderation", tags=["moderation"])
api_router.include_router(contact.router, prefix="/contact", tags=["contact"])
api_router.include_router(onboarding.router, prefix="/onboarding", tags=["onboarding"])
api_router.include_router(billing.router, prefix="/billing", tags=["billing"])
api_router.include_router(settings_routes.router, prefix="/settings", tags=["settings"])
api_router.include_router(study.router, prefix="/study", tags=["study"])
api_router.include_router(
    study_artifacts.router,
    prefix="/study-artifacts",
    tags=["study-artifacts"],
)
api_router.include_router(admin.router, prefix="/admin", tags=["admin"])
api_router.include_router(support.router, prefix="/support", tags=["support"])
