# Design: Knorvex Remaining Features

**Feature Name:** knorvex-remaining-features  
**Workflow:** design-first  
**Created:** 2025-01-13

## Overview

Complete the remaining features from the Knorvex build plan Phases 2 and 3:
- Material-scoped chat UI entry point
- Search/Ask SSE streaming (optional)
- Generation profile async fan-out + UI controls
- Model defaults settings UI
- Professor agent insights loop

## Architecture

### 1. Material-Scoped Chat UI Entry Point

**Current State:**
- Backend `/materials/{id}/chat/sessions` and messages endpoints exist
- Scoped grounded replies work
- No frontend entry point

**Design:**
```
Material List/Detail → "Chat about this file" button
                     ↓
                Opens chat drawer/modal
                     ↓
                Material-scoped chat session
                     ↓
                Shows context indicators (which chunks used)
```

**Components:**
- `MaterialChatButton` — trigger in material card/detail view
- `MaterialChatDrawer` — dedicated chat interface for single material
- `MaterialChatMessage` — message component showing chunk citations
- Hook: `useMaterialChat(materialId)` — manages session + messages

**API Endpoints (existing):**
- `POST /materials/{id}/chat/sessions` → create session
- `POST /materials/{id}/chat/sessions/{sid}/messages` → send message
- Response includes `context_indicators: [{chunk_id, excerpt, page}]`

**UX Flow:**
1. User clicks "Chat about this file" on material card
2. Drawer opens with material title in header
3. Empty state: "Ask me anything about [filename]"
4. User types question → scoped reply with chunk citations
5. Context indicators show as footnotes/badges

---

### 2. Search/Ask SSE Streaming (Optional)

**Current State:**
- `/search/ask` returns structured JSON with retrieval plan + answer + citations
- No streaming

**Design (if implementing):**
```
POST /search/ask → SSE stream
                ↓
        Event: retrieval_plan
        data: {sub_queries: [...]}
                ↓
        Event: answer_chunk
        data: {text: "...", index: 0}
                ↓
        Event: citations
        data: [{material_id, excerpt, ...}]
                ↓
        Event: done
```

**Decision Point:**
- If product wants streaming UX (typewriter effect), implement SSE
- If structured response works fine, mark as "won't do" and move on

**Implementation:**
- Convert `search.py` `ask()` function to async generator
- Use FastAPI `StreamingResponse` with NDJSON
- Frontend: `EventSource` or `fetch` with streaming body reader

**Skip Recommendation:** The structured response is simpler and less likely to have edge cases. Only implement streaming if there's clear product value.

---

### 3. Generation Profile Async Fan-Out + UI

**Current State:**
- Backend: CRUD complete, upload hook exists (best-effort sync)
- Missing: dedicated Arq jobs for parallel profile execution
- Missing: upload UI checkbox + settings UI

**Design:**

**Backend Changes:**
```python
# In materials.py _process() after status=processed
if material.status == "processed":
    db.flush()
    # Enqueue profile fan-out job
    jobs_service.enqueue_profile_fanout(db, user.id, material.id)

# New worker task in workers/tasks.py
def execute_profile_fanout_job(job_id: str):
    # Load material + user default profiles
    profiles = get_upload_profiles(db, user_id)
    for profile in profiles:
        if profile.output_type == "quiz":
            jobs_service.enqueue_quiz_generation(...)
        elif profile.output_type == "flashcards":
            jobs_service.enqueue_flashcard_generation(...)
        elif profile.output_type == "summary":
            # Generate MaterialInsight
            create_material_insight(db, material, profile)
```

**Frontend Changes:**

**Upload UI (Material Upload Dialog):**
```tsx
// In material upload dialog/form
<Checkbox 
  checked={applyDefaultProfiles}
  onCheckedChange={setApplyDefaultProfiles}
>
  Auto-generate content from my default profiles
</Checkbox>

// If checked, POST /materials includes ?apply_profiles=true
```

**Settings UI (New Section):**
```tsx
// /settings/generation-profiles
<Card>
  <CardHeader>
    <CardTitle>Generation Profiles</CardTitle>
    <CardDescription>
      Auto-generate quizzes, flashcards, or summaries when you upload materials.
    </CardDescription>
  </CardHeader>
  <CardContent>
    {profiles.map(profile => (
      <ProfileItem
        key={profile.id}
        profile={profile}
        onToggle={() => toggleApplyOnUpload(profile.id)}
        onEdit={() => editProfile(profile.id)}
        onDelete={() => deleteProfile(profile.id)}
      />
    ))}
    <Button onClick={createProfile}>+ New Profile</Button>
  </CardContent>
</Card>

// Profile editor modal
<Dialog>
  <Input label="Name" value={name} />
  <Textarea label="Prompt Template" value={promptTemplate} />
  <Select label="Output Type" options={["quiz", "flashcards", "summary"]} />
  <Checkbox checked={applyOnUpload}>
    Apply automatically when I upload materials
  </Checkbox>
</Dialog>
```

**API Endpoints (existing):**
- `GET /generation-profiles` — list user profiles
- `POST /generation-profiles` — create
- `PATCH /generation-profiles/{id}` — update (including `apply_on_upload`)
- `DELETE /generation-profiles/{id}` — delete

---

### 4. Model Defaults Settings UI

**Current State:**
- Backend: `User.default_chat_model`, `default_generation_model`, `default_embedding_model`
- `GET/PUT /settings/model-defaults` exists
- `provision_model(task_type)` helper exists
- No frontend settings UI

**Design:**

**Settings Page Section:**
```tsx
// /settings/models or /settings/ai
<Card>
  <CardHeader>
    <CardTitle>AI Model Defaults</CardTitle>
    <CardDescription>
      Choose which AI model to use for different tasks.
      These are used when BYOK is not enabled.
    </CardDescription>
  </CardHeader>
  <CardContent>
    <div className="space-y-4">
      <div>
        <Label>Chat & Explanations</Label>
        <Select value={chatModel} onValueChange={setChatModel}>
          <SelectItem value="gpt-4o">GPT-4o (Recommended)</SelectItem>
          <SelectItem value="gpt-4o-mini">GPT-4o Mini (Faster)</SelectItem>
          <SelectItem value="gpt-3.5-turbo">GPT-3.5 Turbo (Economy)</SelectItem>
          <SelectItem value="claude-3-5-sonnet">Claude 3.5 Sonnet</SelectItem>
        </Select>
      </div>
      
      <div>
        <Label>Quiz & Flashcard Generation</Label>
        <Select value={generationModel} onValueChange={setGenerationModel}>
          <SelectItem value="gpt-4o">GPT-4o (Recommended)</SelectItem>
          <SelectItem value="gpt-4o-mini">GPT-4o Mini</SelectItem>
          <SelectItem value="claude-3-5-sonnet">Claude 3.5 Sonnet</SelectItem>
        </Select>
      </div>
      
      <div>
        <Label>Embeddings (for search)</Label>
        <Select value={embeddingModel} onValueChange={setEmbeddingModel}>
          <SelectItem value="text-embedding-3-small">
            OpenAI Small (Recommended)
          </SelectItem>
          <SelectItem value="text-embedding-3-large">
            OpenAI Large (Higher Quality)
          </SelectItem>
        </Select>
      </div>
    </div>
    
    <Button onClick={saveDefaults}>Save Defaults</Button>
  </CardContent>
</Card>
```

**API Integration:**
```typescript
// client/lib/api/models.ts
export const getModelDefaults = async () => {
  const res = await apiClient.get('/settings/model-defaults');
  return res.data;
};

export const updateModelDefaults = async (defaults: {
  default_chat_model?: string;
  default_generation_model?: string;
  default_embedding_model?: string;
}) => {
  const res = await apiClient.put('/settings/model-defaults', defaults);
  return res.data;
};
```

---

### 5. Professor Agent Insights Loop

**Current State:**
- Professor agents exist with profile attributes
- Question ratings exist
- No automatic insight generation from materials
- No feedback loop adjusting agent profiles

**Design:**

**Phase A: Material Insights Generation**

After material processing completes, generate `MaterialInsight` records:

```python
# In materials.py after chunks embedded
def generate_material_insights(db: Session, material: Material):
    """Extract key concepts, exam topics, question seeds from material."""
    chunks_text = "\n\n".join(chunk.text for chunk in material.chunks[:10])
    
    prompt = f"""
    Analyze this study material and extract:
    1. Key concepts (5-10 main ideas)
    2. Likely exam topics (3-5 areas professors test)
    3. Question seeds (potential quiz question subjects)
    
    Material: {material.title}
    Content preview:
    {chunks_text[:2000]}
    """
    
    result = llm_json(system_prompt, prompt)
    
    # Store as MaterialInsight
    insight = MaterialInsight(
        material_id=material.id,
        user_id=material.user_id,
        insight_type="key_concepts",
        title=f"Key Concepts: {material.title}",
        body=json.dumps(result.get("key_concepts", [])),
    )
    db.add(insight)
    # ... repeat for exam_topics, question_seeds
```

**Phase B: Insights in Generation**

When generating quizzes with professor agent, inject material insights:

```python
# In generation.py generate_questions()
if agent and material_ids:
    # Load material insights
    insights = db.scalars(
        select(MaterialInsight).where(
            MaterialInsight.material_id.in_(material_ids),
            MaterialInsight.insight_type == "exam_topics",
        )
    ).all()
    
    # Add to generation prompt
    agent_context = f"""
    Agent: {agent.name}
    Style: {agent.question_style}
    Identified exam topics from materials: {insights_summary}
    
    Generate questions focusing on these topics using the agent's style.
    """
```

**Phase C: Feedback Loop (Question Ratings → Agent Profile)**

When users rate questions, adjust agent profile weights:

```python
# New route: POST /agents/{id}/apply-feedback
def apply_question_feedback(agent_id: uuid.UUID):
    """Analyze question ratings and suggest agent profile adjustments."""
    
    # Get ratings for agent's questions
    ratings = db.scalars(
        select(QuestionRating).where(
            QuestionRating.professor_agent_id == agent_id
        )
    ).all()
    
    # Analyze patterns
    positive = [r for r in ratings if r.rating == "up"]
    negative = [r for r in ratings if r.rating == "down"]
    
    # Load rated questions to find patterns
    # ... analyze question types, difficulty, topics
    
    # Suggest adjustments (or auto-apply with user confirmation)
    if len(negative) > len(positive) * 0.5:
        # Too many downvotes on hard questions
        return {"suggestion": "Reduce difficulty from 'hard' to 'medium'"}
```

**UI Changes:**

1. **Material Detail Page:**
   - Show "Insights" tab with key concepts, exam topics
   - "Generate Quiz from These Topics" button

2. **Agent Settings:**
   - "Apply Feedback" button shows rating analysis
   - Suggests profile adjustments
   - User confirms or rejects

3. **Quiz Generation:**
   - When agent + materials attached, show "Using insights from 3 materials"

---

## Data Flow

### Material-Scoped Chat
```
User clicks "Chat" on material
   ↓
Create material chat session
   ↓
User types question
   ↓
Backend retrieves chunks from ONLY that material
   ↓
LLM generates grounded reply
   ↓
Response shows chunk citations
```

### Generation Profile Fan-Out
```
User uploads material → processing job completes
   ↓
Enqueue profile_fanout job
   ↓
Worker loads user's default profiles (apply_on_upload=true)
   ↓
For each profile:
   - quiz → enqueue quiz generation
   - flashcards → enqueue flashcard generation
   - summary → create MaterialInsight inline
   ↓
User sees generated content appear as jobs complete
```

### Agent Insights Loop
```
Material processing completes
   ↓
Generate MaterialInsight records (key concepts, exam topics, questions seeds)
   ↓
Quiz generation with agent
   ↓
Load material insights + agent profile
   ↓
Generate questions focused on insight topics, using agent style
   ↓
User rates questions
   ↓
Analyze ratings → suggest agent profile adjustments
```

---

## UI/UX Considerations

1. **Material-Scoped Chat:**
   - Drawer vs modal vs dedicated page? → **Drawer** (keeps context visible)
   - Show material title + page count in header
   - Chunk citations as expandable footnotes
   - "Back to main chat" button

2. **Generation Profiles:**
   - Simple toggle switches for existing profiles
   - Profile editor uses JSON schema for complex prompts
   - Preview what each profile will generate
   - Apply profiles retroactively to existing materials?

3. **Model Defaults:**
   - Group by use case, not model family
   - Show cost/speed tradeoffs
   - "Reset to Recommended" button
   - Only show when NOT using BYOK (disable/hide when BYOK active)

4. **Agent Insights:**
   - Don't overwhelm with too many insights
   - Show top 5 key concepts, 3 exam topics
   - "Generate quiz from these" CTA
   - Feedback loop suggestions should be optional, not automatic

---

## Edge Cases

1. **Material-scoped chat with no chunks:** Show "This material couldn't be processed" empty state

2. **Profile fan-out when Redis down:** Fall back to best-effort sync generation, log warning

3. **Model defaults when BYOK enabled:** Hide/disable settings, show "Using your API key" notice

4. **Agent insights with insufficient material:** Skip insight generation if < 3 chunks or < 500 tokens

5. **Feedback loop with < 10 ratings:** Don't suggest adjustments until statistically meaningful

---

## Performance Considerations

1. **Material chat sessions:** Index on `(material_id, created_at)` for fast session lookup

2. **Profile fan-out:** Process profiles sequentially, not all at once (rate limit protection)

3. **Insight generation:** Only run once per material, cache results, regenerate on reprocess

4. **Model defaults:** Cache in user session/context to avoid DB hit per generation

---

## Security & Privacy

1. **Material chat:** Verify user owns material before creating session

2. **Profile fan-out:** Respect user's billing limits when auto-generating

3. **Insights:** Material insights inherit material's privacy (don't share institutional insights)

4. **Agent feedback:** Aggregate ratings before showing patterns (privacy-preserving)

---

## Testing Strategy

1. **Material chat:** Integration test creating session + sending message + verifying chunk citations

2. **Profile fan-out:** Test profile execution order, job creation, artifact linking

3. **Model defaults:** Test provision_model() respects user defaults > platform defaults

4. **Agent insights:** Test insight generation quality, feedback loop suggestions

---

## Success Metrics

1. **Material chat:** % of users who try material-scoped chat after upload

2. **Profile fan-out:** Average time from upload to first auto-generated content appearing

3. **Model defaults:** % of users who change from recommended defaults

4. **Agent insights:** Improvement in question ratings after applying feedback

---

## Open Questions

1. Should `/search/ask` streaming be implemented, or is structured response sufficient?
   - **Decision:** Skip streaming unless product explicitly requests it

2. Should profile fan-out be throttled (max N profiles per upload)?
   - **Decision:** Yes, limit to 3 active profiles per upload

3. Should model defaults be per-course or global per-user?
   - **Decision:** Global per-user for simplicity

4. Should agent feedback loop auto-apply adjustments or require confirmation?
   - **Decision:** Require user confirmation (show suggestions, user clicks "Apply")

---

## Dependencies

**External:**
- None (all infrastructure exists)

**Internal:**
- Existing material processing pipeline
- Existing job queue (Arq)
- Existing BYOK infrastructure
- Existing agent + rating tables

---

## Migration Path

1. **Material chat:** No migration needed (new feature)

2. **Profile fan-out:** Existing profiles work as-is, fan-out is additive

3. **Model defaults:** Add default_*_model columns if not exist (nullable, use platform default if null)

4. **Agent insights:** MaterialInsight table exists, insights generation is additive

---

## Rollout Plan

**Phase 1:** Model defaults settings UI (easiest, no backend changes)
**Phase 2:** Material-scoped chat UI (backend exists, frontend only)
**Phase 3:** Generation profile fan-out (backend + minimal frontend)
**Phase 4:** Agent insights loop (most complex, phased rollout)

Each phase can ship independently.
