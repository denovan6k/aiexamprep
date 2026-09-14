import { apiRequest, ApiError } from "@/lib/api";
import { buildListQuery, type ListParams, type PaginatedResult } from "@/lib/pagination";

export const QUIZ_QUESTION_TYPE_OPTIONS = [
  { id: "mcq", label: "Multiple choice" },
  { id: "multi_select", label: "Multi-select" },
  { id: "true_false", label: "True / false" },
  { id: "matching", label: "Matching" },
  { id: "short_answer", label: "Short answer" },
  { id: "theory", label: "Theory / essay" }
] as const;

export type QuizQuestion = {
  id: string;
  type: string;
  prompt: string;
  options:
    | Array<{ id?: string; label?: string; text?: string }>
    | { left?: Array<{ id: string; text: string }>; right?: Array<{ id: string; text: string }> }
    | null;
  correct_answers?: unknown[] | null;
  explanation?: string | null;
  topic: string | null;
  difficulty: string | null;
  source_refs?: Array<Record<string, unknown>> | null;
};

export type Quiz = {
  id: string;
  title: string;
  status: string;
  professor_agent_id: string | null;
  config: Record<string, unknown> | null;
  questions: QuizQuestion[];
  created_at: string;
};

export type QuizListItem = {
  id: string;
  title: string;
  status: string;
  professor_agent_id: string | null;
  course_id: string | null;
  config: Record<string, unknown> | null;
  question_count: number;
  created_at: string;
  updated_at: string;
};

export type QuizAttempt = {
  id: string;
  quiz_id: string;
  status: string;
  started_at: string;
  submitted_at: string | null;
  score: string | null;
  max_score: string | null;
  timer_seconds?: number | null;
  seconds_remaining?: number | null;
  timer_expired?: boolean;
  deadline_at?: string | null;
};

export type QuizAnswer = {
  id: string;
  attempt_id: string;
  question_id: string;
  answer: unknown;
  is_correct?: boolean | null;
  score?: string | null;
  feedback?: string | null;
  flagged: boolean;
};

export type TopicScore = {
  topic: string;
  score_pct: number;
};

export type QuizSessionContext = {
  agent: {
    id: string;
    name: string;
    subject_area: string | null;
    style_summary: string | null;
  } | null;
  average_score: number;
  cards_due: number;
  next_up: {
    deck_id: string;
    card_id: string;
    topic: string | null;
    label: string;
  } | null;
  topic_focus: TopicScore[];
  agent_insight: string | null;
  answered_count: number;
  flagged_count: number;
  correct_count: number;
  graded_count: number;
  elapsed_seconds: number;
  pace_estimate_minutes: number | null;
  timer_seconds?: number | null;
  seconds_remaining?: number | null;
  timer_expired?: boolean;
  deadline_at?: string | null;
};

export type QuizAttemptDetail = {
  attempt: QuizAttempt;
  answers: QuizAnswer[];
};

export type FlashcardStudyStats = {
  cards_due: number;
  total_cards: number;
  next_up: QuizSessionContext["next_up"];
};

export type QuizReview = {
  attempt: QuizAttempt;
  answers: QuizAnswer[];
  questions: QuizQuestion[];
  weak_topics: string[];
  incorrect_question_ids?: string[];
};

export type Agent = {
  id: string;
  name: string;
  description: string | null;
  subject_area: string | null;
  difficulty: string | null;
  marking_strictness: string | null;
  feedback_tone: string | null;
  question_style: Record<string, unknown> | null;
  favorite_topics: string[] | null;
  common_traps: string[] | null;
  rubric_preferences: Record<string, unknown> | null;
  avatar_url: string | null;
  intro_message: string | null;
  capabilities_summary: string | null;
  mcp_connection_count: number;
  created_at: string;
  updated_at: string;
};

export type AgentUpdateInput = {
  name?: string;
  description?: string;
  subject_area?: string;
  difficulty?: string;
  marking_strictness?: string;
  feedback_tone?: string;
  favorite_topics?: string[];
  common_traps?: string[];
  intro_message?: string;
  capabilities_summary?: string;
  avatar_url?: string;
};

export type AgentMcpConnection = {
  id: string;
  agent_id: string;
  name: string;
  server_url: string;
  transport: string;
  auth_type: string;
  enabled: boolean;
  discovered_tools: Array<Record<string, unknown>> | null;
  oauth_expires_at: string | null;
  created_at: string;
  updated_at: string;
};

export type Flashcard = {
  id: string;
  front: string;
  back: string;
  topic: string | null;
  difficulty: string | null;
};

export type FlashcardDeck = {
  id: string;
  title: string;
  course_id: string | null;
  flashcards: Flashcard[];
  created_at: string;
  updated_at: string;
};

export type FlashcardDeckListItem = {
  id: string;
  title: string;
  course_id: string | null;
  card_count: number;
  created_at: string;
  updated_at: string;
};

export type Course = {
  id: string;
  title: string;
  description: string | null;
  exam_date: string | null;
  confidence_level: "low" | "medium" | "high" | null;
  created_at: string;
  updated_at: string;
};

export type ProgressOverview = {
  quizzes_taken: number;
  average_score: number;
  mastered_topics: string[];
  weak_topics: string[];
  recommendations: string[];
  topic_scores: TopicScore[];
};

export type UsageSummary = {
  plan_code: string;
  courses_used: number;
  material_uploads_used: number;
  quiz_generations_used: number;
  professor_agents_used: number;
  chat_prompts_used: number;
  generations_used: number;
  generation_limit: number | null;
  upload_limit: number | null;
  reset_at: string | null;
  credits_balance: number;
  credits_next_expiry_at: string | null;
  entitlements: {
    course_limit: number | null;
    material_upload_limit: number | null;
    quiz_generation_limit: number | null;
    professor_agent_limit: number | null;
    features: string[];
  };
};

export type UsageHistoryDayPoint = {
  date: string;
  total: number;
  chat_prompts: number;
  material_uploads: number;
  course_creates: number;
  agent_creates: number;
  cv_tailorings: number;
  other: number;
};

export type UsageHistoryTypePoint = {
  event_type: string;
  label: string;
  total: number;
};

export type UsageHistory = {
  days: number;
  series: UsageHistoryDayPoint[];
  by_type: UsageHistoryTypePoint[];
  total_events: number;
};

export type BillingPlan = {
  code: "free" | "pro_monthly" | "pro_yearly" | "enterprise_monthly" | "enterprise_yearly";
  name: string;
  interval: "none" | "month" | "year";
  price_cents: number | null;
  stripe_price_id: string | null;
  features: string[];
  is_current: boolean;
};

export type BillingCycle = "monthly" | "yearly";

function planRank(code: BillingPlan["code"]): number {
  if (code === "free") return 0;
  if (code.startsWith("pro_")) return 1;
  if (code.startsWith("enterprise_")) return 2;
  return 99;
}

export function plansForBillingCycle(plans: BillingPlan[], cycle: BillingCycle): BillingPlan[] {
  const free = plans.find((plan) => plan.code === "free");
  const cycleInterval = cycle === "monthly" ? "month" : "year";
  const cyclePlans = plans
    .filter((plan) => plan.interval === cycleInterval)
    .sort((a, b) => planRank(a.code) - planRank(b.code));

  return free ? [free, ...cyclePlans] : cyclePlans;
}

export type CheckoutResponse = {
  checkout_url: string;
  plan_code: BillingPlan["code"];
  stripe_price_id: string | null;
  is_placeholder: boolean;
};

export type PortalResponse = {
  portal_url: string;
  is_placeholder: boolean;
};

export type CreditPurchaseResponse = {
  granted_credits: number;
  credits_balance: number;
  expires_at: string;
};

export type QuizGenerationSettings = {
  count?: number;
  question_types?: string[];
  timer_minutes?: number;
  shuffle_questions?: boolean;
  shuffle_options?: boolean;
  options_count?: number;
  topic_focus?: string;
  model?: string | null;
};

export type QuizGenerationInput = QuizGenerationSettings & {
  course_id?: string;
  material_ids?: string[];
  professor_agent_id?: string;
  title?: string;
  difficulty?: string;
};

export type QuizUpdateSettings = {
  title?: string;
  timer_minutes?: number | null;
  shuffle_questions?: boolean;
  shuffle_options?: boolean;
  options_count?: number;
  professor_agent_id?: string | null;
};

export type QuizRegenerateSettings = {
  count?: number;
  question_types?: string[];
  difficulty?: string;
  topic_focus?: string;
  options_count?: number;
  professor_agent_id?: string | null;
  model?: string;
  timer_minutes?: number | null;
  shuffle_questions?: boolean;
  shuffle_options?: boolean;
};

export type ShortAnswerGradingMode = "provided_answers" | "ai_correctness";

export type QuizManualMCQOptionInput = {
  id: string;
  text: string;
};

export type QuizManualMCQQuestionInput = {
  type: "mcq";
  prompt: string;
  options: QuizManualMCQOptionInput[];
  correct_option_id: string;
  explanation?: string | null;
  topic?: string | null;
  difficulty?: string | null;
};

export type QuizManualShortAnswerQuestionInput = {
  type: "short_answer";
  prompt: string;
  model_answers: string[];
  explanation?: string | null;
  topic?: string | null;
  difficulty?: string | null;
};

export type QuizManualQuestionInput = QuizManualMCQQuestionInput | QuizManualShortAnswerQuestionInput;

export type QuizManualCreateInput = {
  course_id?: string | null;
  title: string;
  questions: QuizManualQuestionInput[];
  short_answer_grading?: ShortAnswerGradingMode;
  options_count?: number | null;
  shuffle_questions?: boolean;
  shuffle_options?: boolean;
  timer_minutes?: number | null;
  professor_agent_id?: string | null;
};

export type QuizManualContentUpdateInput = {
  title?: string | null;
  status: "draft" | "ready";
  short_answer_grading?: ShortAnswerGradingMode;
  options_count?: number | null;
  shuffle_questions?: boolean | null;
  shuffle_options?: boolean | null;
  timer_minutes?: number | null;
  questions: QuizManualQuestionInput[];
};

export type QuizPopulateInput = {
  material_ids: string[];
  count?: number;
  question_types?: string[];
  difficulty?: string | null;
  options_count?: number | null;
  topic_focus?: string | null;
  model?: string | null;
};

export async function generateQuiz(
  token: string,
  input: QuizGenerationInput
) {
  return apiRequest<Quiz>("/quizzes/generate", {
    method: "POST",
    token,
    body: JSON.stringify(input)
  });
}

export async function listQuizzes(token: string, params?: ListParams) {
  return apiRequest<PaginatedResult<QuizListItem>>(`/quizzes${buildListQuery(params)}`, { token });
}

export async function listAllQuizzes(token: string) {
  const result = await listQuizzes(token, { limit: 100, offset: 0 });
  return result.items;
}

export async function getQuiz(token: string, quizId: string) {
  return apiRequest<Quiz>(`/quizzes/${quizId}`, { token });
}

export async function updateQuiz(token: string, quizId: string, settings: QuizUpdateSettings) {
  return apiRequest<Quiz>(`/quizzes/${quizId}`, {
    method: "PATCH",
    token,
    body: JSON.stringify(settings)
  });
}

export async function regenerateQuiz(
  token: string,
  quizId: string,
  settings: QuizRegenerateSettings = {}
) {
  return apiRequest<Quiz>(`/quizzes/${quizId}/regenerate`, {
    method: "POST",
    token,
    body: JSON.stringify(settings)
  });
}

export async function startQuizAttempt(token: string, quizId: string) {
  return apiRequest<QuizAttempt>(`/quizzes/${quizId}/attempts`, { method: "POST", token });
}

export async function createManualQuiz(token: string, input: QuizManualCreateInput) {
  return apiRequest<Quiz>(`/quizzes`, { method: "POST", token, body: JSON.stringify(input) });
}

export async function getQuizEditor(token: string, quizId: string) {
  return apiRequest<Quiz>(`/quizzes/${quizId}/editor`, { token });
}

export async function updateQuizContent(
  token: string,
  quizId: string,
  input: QuizManualContentUpdateInput
) {
  return apiRequest<Quiz>(`/quizzes/${quizId}/content`, {
    method: "PUT",
    token,
    body: JSON.stringify(input)
  });
}

export async function populateQuiz(
  token: string,
  quizId: string,
  input: QuizPopulateInput
) {
  return apiRequest<Quiz>(`/quizzes/${quizId}/populate`, {
    method: "POST",
    token,
    body: JSON.stringify(input)
  });
}

export async function getActiveQuizAttempt(token: string, quizId: string): Promise<QuizAttempt | null> {
  try {
    return await apiRequest<QuizAttempt>(`/quizzes/${quizId}/attempts/active`, {
      token,
      cache: "no-store"
    });
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return null;
    }
    throw error;
  }
}

export async function getQuizAttempt(token: string, attemptId: string) {
  return apiRequest<QuizAttemptDetail>(`/quizzes/attempts/${attemptId}`, { token });
}

export async function getQuizSessionContext(
  token: string,
  attemptId: string,
  currentTopic?: string | null
) {
  const query = currentTopic ? `?current_topic=${encodeURIComponent(currentTopic)}` : "";
  return apiRequest<QuizSessionContext>(`/quizzes/attempts/${attemptId}/context${query}`, { token });
}

export async function flagQuizAnswer(
  token: string,
  attemptId: string,
  questionId: string,
  flagged: boolean
) {
  return apiRequest<QuizAnswer>(`/quizzes/attempts/${attemptId}/answers/${questionId}/flag`, {
    method: "PATCH",
    token,
    body: JSON.stringify({ flagged })
  });
}

export async function saveQuizAnswer(
  token: string,
  attemptId: string,
  questionId: string,
  answer: unknown
) {
  return apiRequest<QuizAnswer>(`/quizzes/attempts/${attemptId}/answers/${questionId}`, {
    method: "PUT",
    token,
    body: JSON.stringify({ answer })
  });
}

export async function submitQuizAttempt(token: string, attemptId: string) {
  return apiRequest<QuizReview>(`/quizzes/attempts/${attemptId}/submit`, {
    method: "POST",
    token
  });
}

export async function getQuizReview(token: string, attemptId: string) {
  return apiRequest<QuizReview>(`/quizzes/attempts/${attemptId}/review`, { token });
}

export async function listAgents(token: string, params?: ListParams) {
  return apiRequest<PaginatedResult<Agent>>(`/agents${buildListQuery(params)}`, { token });
}

export async function listAllAgents(token: string) {
  const result = await listAgents(token, { limit: 100, offset: 0 });
  return result.items;
}

export async function createAgent(token: string, description: string, name?: string) {
  return apiRequest<Agent>("/agents", {
    method: "POST",
    token,
    body: JSON.stringify({ description, name })
  });
}

export async function getAgent(token: string, agentId: string) {
  return apiRequest<Agent>(`/agents/${agentId}`, { token });
}

export async function updateAgent(token: string, agentId: string, payload: AgentUpdateInput) {
  return apiRequest<Agent>(`/agents/${agentId}`, {
    method: "PATCH",
    token,
    body: JSON.stringify(payload)
  });
}

export async function uploadAgentAvatar(token: string, agentId: string, file: File) {
  const formData = new FormData();
  formData.append("file", file);
  return apiRequest<{ avatar_url: string }>(`/agents/${agentId}/avatar`, {
    method: "POST",
    token,
    body: formData
  });
}

export async function listAgentMcpConnections(token: string, agentId: string) {
  return apiRequest<AgentMcpConnection[]>(`/agents/${agentId}/mcp-connections`, { token });
}

export async function createAgentMcpConnection(
  token: string,
  agentId: string,
  payload: {
    name: string;
    server_url: string;
    transport?: string;
    auth_type?: string;
    bearer_token?: string;
    enabled?: boolean;
  }
) {
  return apiRequest<AgentMcpConnection>(`/agents/${agentId}/mcp-connections`, {
    method: "POST",
    token,
    body: JSON.stringify(payload)
  });
}

export async function updateAgentMcpConnection(
  token: string,
  agentId: string,
  connectionId: string,
  payload: Partial<{
    name: string;
    server_url: string;
    transport: string;
    auth_type: string;
    bearer_token: string;
    enabled: boolean;
  }>
) {
  return apiRequest<AgentMcpConnection>(`/agents/${agentId}/mcp-connections/${connectionId}`, {
    method: "PATCH",
    token,
    body: JSON.stringify(payload)
  });
}

export async function deleteAgentMcpConnection(token: string, agentId: string, connectionId: string) {
  return apiRequest<void>(`/agents/${agentId}/mcp-connections/${connectionId}`, {
    method: "DELETE",
    token
  });
}

export async function syncAgentMcpConnection(token: string, agentId: string, connectionId: string) {
  return apiRequest<{ connection: AgentMcpConnection; tool_count: number }>(
    `/agents/${agentId}/mcp-connections/${connectionId}/sync`,
    { method: "POST", token }
  );
}

export async function testAgentMcpConnection(token: string, agentId: string, connectionId: string) {
  return apiRequest<{ ok: boolean; message: string; tool_count: number }>(
    `/agents/${agentId}/mcp-connections/${connectionId}/test`,
    { method: "POST", token }
  );
}

export async function deleteAgent(token: string, agentId: string) {
  return apiRequest<void>(`/agents/${agentId}`, { method: "DELETE", token });
}

export async function rateQuestion(token: string, questionId: string, rating: "up" | "down") {
  return apiRequest<{ id: string; question_id: string; rating: "up" | "down" }>(
    `/agents/questions/${questionId}/rating`,
    {
      method: "POST",
      token,
      body: JSON.stringify({ rating })
    }
  );
}

export async function getFlashcardStudyStats(token: string, topic?: string) {
  const query = topic ? `?topic=${encodeURIComponent(topic)}` : "";
  return apiRequest<FlashcardStudyStats>(`/flashcard-decks/study-stats${query}`, { token });
}

export async function reviewFlashcard(
  token: string,
  deckId: string,
  cardId: string,
  confidence: "again" | "known"
) {
  return apiRequest<{ flashcard_id: string; confidence: string; reviewed_at: string }>(
    `/flashcard-decks/${deckId}/cards/${cardId}/review`,
    {
      method: "POST",
      token,
      body: JSON.stringify({ confidence })
    }
  );
}

export async function listFlashcardDecks(token: string, params?: ListParams) {
  return apiRequest<PaginatedResult<FlashcardDeckListItem>>(
    `/flashcard-decks${buildListQuery(params)}`,
    { token }
  );
}

export type FlashcardManualCardInput = {
  front: string;
  back: string;
  topic?: string | null;
  difficulty?: string | null;
};

export type FlashcardDeckCreateInput = {
  course_id?: string | null;
  title: string;
  cards: FlashcardManualCardInput[];
};

export type FlashcardDeckUpdateInput = {
  title?: string | null;
  cards: FlashcardManualCardInput[];
};

export type FlashcardDeckPopulateInput = {
  material_ids: string[];
  count?: number;
  title?: string | null;
};

export async function createManualFlashcardDeck(token: string, input: FlashcardDeckCreateInput) {
  return apiRequest<FlashcardDeck>(`/flashcard-decks`, {
    method: "POST",
    token,
    body: JSON.stringify(input)
  });
}

export async function updateManualFlashcardDeck(
  token: string,
  deckId: string,
  input: FlashcardDeckUpdateInput
) {
  return apiRequest<FlashcardDeck>(`/flashcard-decks/${deckId}`, {
    method: "PUT",
    token,
    body: JSON.stringify(input)
  });
}

export async function populateManualFlashcardDeck(
  token: string,
  deckId: string,
  input: FlashcardDeckPopulateInput
) {
  return apiRequest<FlashcardDeck>(`/flashcard-decks/${deckId}/populate`, {
    method: "POST",
    token,
    body: JSON.stringify(input)
  });
}

export async function listAllFlashcardDecks(token: string) {
  const result = await listFlashcardDecks(token, { limit: 100, offset: 0 });
  return result.items;
}

export async function getFlashcardDeck(token: string, deckId: string) {
  return apiRequest<FlashcardDeck>(`/flashcard-decks/${deckId}`, { token });
}

export async function listDeckCards(token: string, deckId: string) {
  return apiRequest<Flashcard[]>(`/flashcard-decks/${deckId}/cards`, { token });
}

export async function listCourses(token: string) {
  return apiRequest<Course[]>("/courses", { token });
}

export async function createCourse(token: string, title: string, description?: string) {
  return apiRequest<Course>("/courses", {
    method: "POST",
    token,
    body: JSON.stringify({ title, description })
  });
}

export async function getProgressOverview(token: string) {
  return apiRequest<ProgressOverview>("/progress/overview", { token });
}

export async function getBillingUsage(token: string) {
  return apiRequest<UsageSummary>("/billing/usage", { token });
}

export async function getBillingUsageHistory(token: string, days = 30) {
  return apiRequest<UsageHistory>(`/billing/usage/history?days=${days}`, { token });
}

export async function listBillingPlans(token: string) {
  return apiRequest<BillingPlan[]>("/billing/plans", { token });
}

export async function createBillingCheckout(token: string, planCode: BillingPlan["code"], customerEmail?: string | null) {
  return apiRequest<CheckoutResponse>("/billing/checkout", {
    method: "POST",
    token,
    body: JSON.stringify({
      plan_code: planCode,
      success_url: `${window.location.origin}/settings/billing`,
      cancel_url: `${window.location.origin}/settings/billing`,
      customer_email: customerEmail ?? undefined
    })
  });
}

export async function createBillingPortal(token: string, customerEmail?: string | null) {
  return apiRequest<PortalResponse>("/billing/portal", {
    method: "POST",
    token,
    body: JSON.stringify({
      return_url: `${window.location.origin}/settings/billing`,
      customer_email: customerEmail ?? undefined
    })
  });
}

export async function purchaseCredits(token: string, credits: number, description?: string) {
  return apiRequest<CreditPurchaseResponse>("/billing/credits/purchase", {
    method: "POST",
    token,
    body: JSON.stringify({
      credits,
      description
    })
  });
}

