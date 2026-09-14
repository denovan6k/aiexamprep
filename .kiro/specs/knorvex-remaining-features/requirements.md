# Requirements: Knorvex Remaining Features

**Feature Name:** knorvex-remaining-features  
**Workflow:** design-first  
**Created:** 2025-01-13

## Problem Statement

The Knorvex build plan Phases 0-2 and partial Phase 3 are complete. Five remaining features need implementation to reach full Phase 3 completion:

1. **Material-scoped chat** backend exists but has no UI entry point
2. **Search/Ask streaming** uses structured JSON, not SSE (optional enhancement)
3. **Generation profiles** work sync on upload, need async Arq fan-out + UI controls
4. **Model defaults** backend exists, settings UI missing
5. **Professor agent insights** need automatic generation from materials + feedback loop

---

## User Stories

### Material-Scoped Chat UI

**As a student**, I want to click "Chat about this file" on an uploaded PDF  
**So that** I can ask questions grounded only in that specific material  
**Without** seeing answers from my other course materials

**Acceptance Criteria:**
- [ ] "Chat about this file" button appears on material cards/detail view
- [ ] Clicking opens a drawer/modal with material-scoped chat interface
- [ ] Chat messages show which chunks were used (context indicators)
- [ ] User can return to main chat thread from scoped chat
- [ ] Empty state shows "Ask me anything about [filename]"

---

### Search/Ask SSE Streaming (Optional)

**As a student**, I want to see the AI's answer stream in real-time  
**So that** I get immediate feedback instead of waiting for full response  
**Like** ChatGPT's typewriter effect

**Acceptance Criteria:**
- [ ] `/search/ask` endpoint supports SSE streaming
- [ ] Events: retrieval_plan → answer_chunks → citations → done
- [ ] Frontend displays progressive typewriter effect
- [ ] Fallback to structured response if streaming fails
- [ ] **OR** mark as "won't do" if structured response is sufficient

**Priority:** Low (nice-to-have, not required)

---

### Generation Profile Async Fan-Out

**As a student**, I want my default profiles (quiz, flashcards, summary) applied automatically  
**So that** generated content appears after upload without manual commands  
**And** I can customize which profiles run on upload

**Acceptance Criteria:**

**Backend:**
- [ ] Material processing completion triggers `profile_fanout` Arq job
- [ ] Worker enqueues quiz/flashcard jobs or creates summary insights
- [ ] Only profiles with `apply_on_upload=true` are executed
- [ ] Profile execution respects billing limits
- [ ] Maximum 3 profiles per upload (configurable)

**Frontend:**
- [ ] Upload dialog has "Apply default profiles" checkbox
- [ ] Settings page shows "Generation Profiles" section
- [ ] User can create/edit/delete profiles
- [ ] Profile editor includes:
  - Name (string)
  - Prompt template (textarea)
  - Output type (quiz | flashcards | summary)
  - "Apply on upload" toggle
- [ ] Profiles list shows which are active on upload

---

### Model Defaults Settings UI

**As a student**, I want to choose which AI models are used for different tasks  
**So that** I can optimize for quality vs speed vs cost  
**Without** manually selecting model each time

**Acceptance Criteria:**
- [ ] Settings page has "AI Model Defaults" section
- [ ] Three dropdowns:
  - Chat & Explanations
  - Quiz & Flashcard Generation  
  - Embeddings (for search)
- [ ] Dropdown options show model name + description (e.g., "GPT-4o (Recommended)")
- [ ] "Save Defaults" button persists choices
- [ ] Section is hidden/disabled when BYOK is active (show "Using your API key" notice)
- [ ] Integrates with existing `GET/PUT /settings/model-defaults` API

---

### Professor Agent Insights Loop

**As a student**, I want the AI to extract key concepts from my materials  
**So that** professor agents generate more relevant quiz questions  
**And** the agent's style improves based on my ratings

**Acceptance Criteria:**

**Insight Generation:**
- [ ] After material processing, generate `MaterialInsight` records
- [ ] Insight types: key_concepts, exam_topics, question_seeds
- [ ] Insights shown in material detail "Insights" tab
- [ ] "Generate quiz from these topics" button in insights view

**Insights in Generation:**
- [ ] Quiz generation with agent injects material insights into prompt
- [ ] Generation context shows "Using insights from N materials"
- [ ] Questions focus on identified exam topics

**Feedback Loop:**
- [ ] `POST /agents/{id}/apply-feedback` endpoint analyzes question ratings
- [ ] Identifies patterns (e.g., too many downvotes on hard questions)
- [ ] Returns suggestions (e.g., "Reduce difficulty to medium")
- [ ] User confirms or rejects suggested adjustments
- [ ] Agent profile updated only after user approval

**UI:**
- [ ] Material detail page has "Insights" tab
- [ ] Agent settings page has "Apply Feedback" button
- [ ] Feedback shows rating analysis + suggestions
- [ ] Confirmation dialog before applying adjustments

---

## Functional Requirements

### FR1: Material-Scoped Chat
- System shall provide a "Chat about this file" button on material UI
- System shall create material-scoped chat sessions via existing backend API
- System shall display chunk citations with each reply
- System shall allow navigation back to main chat

### FR2: Search/Ask Streaming (Optional)
- System may implement SSE streaming for `/search/ask`
- System shall fall back to structured response if streaming unavailable
- If not implemented, mark as "won't do" in this spec

### FR3: Generation Profile Fan-Out
- System shall trigger async profile execution after material processing
- System shall respect `apply_on_upload` flag on profiles
- System shall limit to 3 active profiles per upload
- System shall provide UI for managing profiles in settings

### FR4: Model Defaults Settings
- System shall provide UI for setting default models per task type
- System shall hide model settings when BYOK is active
- System shall apply user defaults before platform defaults

### FR5: Agent Insights
- System shall generate insights from processed materials
- System shall inject insights into agent quiz generation
- System shall analyze question ratings and suggest profile adjustments
- System shall require user confirmation before applying feedback

---

## Non-Functional Requirements

### Performance
- Material chat session creation < 500ms
- Profile fan-out job triggers within 2s of processing completion
- Insight generation should not block material processing (<10s added)
- Model defaults cached in session (no DB query per generation)

### Scalability
- Profile fan-out handles 100+ concurrent material uploads
- Material chat supports 10K+ sessions per user
- Insight generation scales to 100-page documents

### Usability
- Material chat drawer opens in <300ms
- Profile settings load in <500ms
- Model defaults persist immediately (optimistic update)
- Agent feedback suggestions clear and actionable

### Reliability
- Profile fan-out gracefully degrades when Redis unavailable
- Material chat works offline (local session storage)
- Insight generation failures don't block material processing

---

## Technical Constraints

1. **No breaking changes** to existing APIs
2. **Use existing job queue** (Arq) for profile fan-out
3. **Match existing code style** in backend and frontend
4. **No new external dependencies** unless absolutely necessary
5. **SSE streaming** only if product explicitly requests it

---

## Out of Scope

1. Real-time collaborative chat (single-user only)
2. Voice input for material chat
3. Multi-material chat (one material per session)
4. Automatic profile creation (user creates manually)
5. Agent profile A/B testing
6. Advanced insight types (stick to key_concepts, exam_topics, question_seeds)

---

## Assumptions

1. Backend APIs for material chat, profiles, model defaults exist and work
2. User has at least one material uploaded before using scoped chat
3. Redis/Arq workers are running for async profile fan-out
4. LLM provider (OpenAI/Anthropic) supports insight generation prompts
5. Users understand difference between main chat and material-scoped chat

---

## Dependencies

**External:**
- OpenAI or Anthropic API for insight generation
- Redis for profile fan-out queue

**Internal:**
- Existing material processing pipeline
- Existing chat service
- Existing generation profiles CRUD
- Existing model defaults backend
- Existing agent + question rating tables

---

## Success Criteria

### Material-Scoped Chat
- [ ] 50%+ of users try material chat within 1 week of upload
- [ ] Average 5+ messages per material chat session
- [ ] <5% error rate on session creation

### Generation Profiles
- [ ] 30%+ of users enable at least 1 default profile
- [ ] Auto-generated content appears within 30s of upload (p95)
- [ ] <10% job failure rate

### Model Defaults
- [ ] 20%+ of users customize defaults
- [ ] Settings save success rate >99%
- [ ] No perceived lag when saving

### Agent Insights
- [ ] Insights generated for 90%+ of processed materials
- [ ] 40%+ of users view insights tab
- [ ] 10%+ of users apply feedback suggestions

---

## Risk Assessment

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Profile fan-out overwhelms job queue | High | Medium | Throttle to 3 profiles, add rate limiting |
| Insight generation produces low-quality results | Medium | Medium | Test with diverse materials, refine prompts |
| Material chat UI confusing vs main chat | Medium | Low | Clear labels, "Back to chat" button |
| SSE streaming implementation complex | Low | High | Mark as optional, skip if unnecessary |
| Model defaults conflict with BYOK | Medium | Low | Hide settings when BYOK active |

---

## Open Questions

1. **Search/Ask streaming:** Implement or skip?
   - **Recommendation:** Skip unless product explicitly requests it

2. **Profile fan-out throttling:** What's the max profiles per upload?
   - **Recommendation:** 3 (configurable in settings)

3. **Insight generation:** Run sync or async?
   - **Recommendation:** Async (add 10s to processing time is acceptable)

4. **Agent feedback:** Auto-apply or require confirmation?
   - **Recommendation:** Require confirmation (avoid unexpected changes)

5. **Material chat:** Drawer vs dedicated page?
   - **Recommendation:** Drawer (keeps material context visible)

---

## Definition of Done

- [ ] All user stories have acceptance criteria met
- [ ] Backend tests pass for new endpoints/workers
- [ ] Frontend components render correctly
- [ ] Integration tests pass end-to-end
- [ ] Code review completed
- [ ] Documentation updated (API docs, user guides)
- [ ] PROGRESS.md updated with completion status
- [ ] No regressions in existing features

---

## Timeline Estimate

**Phase 1:** Model Defaults UI (1-2 days)  
**Phase 2:** Material Chat UI (2-3 days)  
**Phase 3:** Profile Fan-Out (3-4 days)  
**Phase 4:** Agent Insights (5-7 days)  

**Total:** 11-16 days of implementation + 3-4 days testing/polish

**Critical Path:** Agent insights (most complex, longest estimate)
