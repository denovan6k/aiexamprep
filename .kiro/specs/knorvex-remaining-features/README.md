# Knorvex Remaining Features Spec

**Status:** Ready for implementation  
**Workflow:** Design-first  
**Created:** 2025-01-13

## Quick Summary

This spec completes the remaining features from the Knorvex build plan:

1. **Material-Scoped Chat UI** - "Chat about this file" entry point (backend exists)
2. **Generation Profile Async Fan-Out** - Move to Arq workers + settings UI
3. **Model Defaults Settings UI** - Frontend for existing backend
4. **Professor Agent Insights** - Auto-extract concepts + feedback loop
5. **Search/Ask SSE Streaming** - Optional enhancement

## Current State

From `docs/PROGRESS.md`:
- ✅ Phases 0, 1, most of 2, and 3.1 complete
- ⏳ Phases 2.5, 2.6, 2.7, 2.8 partially complete (backend done, UI pending)
- ⏳ Phase 3.2 not started (agent insights loop)

## What's Left

**Backend:**
- Profile fan-out worker (Task 3)
- Insights generation (Task 6)
- Insights in generation (Task 8)
- Agent feedback analysis (Task 9)

**Frontend:**
- Model defaults UI (Task 1)
- Material chat UI (Task 2)
- Profile settings UI (Task 4, 5)
- Insights UI (Task 7)
- Agent feedback UI (Task 10)

**Optional:**
- SSE streaming for `/search/ask` (Task 11 - recommend skipping)

## Timeline

**Wave 1 (3-4 days):**
- Model defaults UI
- Material insights backend

**Wave 2 (4-6 days):**
- Material chat UI
- Profile fan-out backend + UI
- Insights UI

**Wave 3 (4-6 days):**
- Insights in generation
- Agent feedback backend + UI

**Total:** 11-16 days + 3 days testing/docs = **14-19 days**

## Critical Path

Agent insights (Task 6) → Insights UI (Task 7) → Insights in Gen (Task 8) → Feedback (Tasks 9-10)

This is the longest dependency chain.

## Key Decisions

1. **SSE Streaming:** Recommend skipping unless product explicitly requests it
2. **Profile Fan-Out:** Limit to 3 profiles per upload
3. **Agent Feedback:** Require user confirmation (no auto-apply)
4. **Material Chat:** Use drawer (not dedicated page)
5. **Model Defaults:** Hide when BYOK active

## Files Structure

```
.kiro/specs/knorvex-remaining-features/
├── README.md (this file)
├── design.md (architecture, data flow, UI/UX)
├── requirements.md (user stories, acceptance criteria)
└── tasks.md (13 tasks with execution order)
```

## Next Steps

1. Review this spec
2. Decide on SSE streaming (Task 11)
3. Start with Wave 1 (Tasks 1 + 6 in parallel)
4. Execute remaining waves sequentially

## Success Metrics

- Material chat: 50%+ of users try within 1 week
- Profiles: 30%+ enable at least 1 default profile
- Model defaults: 20%+ customize settings
- Insights: 90%+ of materials get insights
- Agent feedback: 10%+ apply suggestions

## References

- Build Plan: `docs/KNORVEX_BUILD_PLAN.md`
- Progress: `docs/PROGRESS.md`
- Backend: `api/app/services/`, `api/app/routes/`
- Frontend: `client/components/`, `client/app/`
