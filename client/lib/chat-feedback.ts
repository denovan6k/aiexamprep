const SESSION_KEY = "knorvex.chat.feedback.session";
const DISMISS_KEY = "knorvex.chat.feedback.dismissed-until";

type FeedbackSession = {
  assistantReplies: number;
  prompted: boolean;
};

function readSession(): FeedbackSession {
  if (typeof window === "undefined") {
    return { assistantReplies: 0, prompted: false };
  }
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return { assistantReplies: 0, prompted: false };
    const parsed = JSON.parse(raw) as Partial<FeedbackSession>;
    return {
      assistantReplies: parsed.assistantReplies ?? 0,
      prompted: parsed.prompted ?? false
    };
  } catch {
    return { assistantReplies: 0, prompted: false };
  }
}

function writeSession(state: FeedbackSession) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(state));
}

/** Call when a new assistant reply lands in the active thread. */
export function noteAssistantReply() {
  const state = readSession();
  writeSession({
    assistantReplies: state.assistantReplies + 1,
    prompted: state.prompted
  });
}

/** Hide prompts until the timestamp (ms) or for the rest of the session. */
export function dismissFeedbackPrompt(untilMs?: number) {
  if (typeof window === "undefined") return;
  const state = readSession();
  writeSession({ ...state, prompted: true });
  const until = untilMs ?? Date.now() + 7 * 24 * 60 * 60 * 1000;
  localStorage.setItem(DISMISS_KEY, String(until));
}

function isDismissed(): boolean {
  if (typeof window === "undefined") return true;
  const raw = localStorage.getItem(DISMISS_KEY);
  if (!raw) return false;
  const until = Number(raw);
  if (!Number.isFinite(until) || until <= Date.now()) {
    localStorage.removeItem(DISMISS_KEY);
    return false;
  }
  return true;
}

/** Show roughly every 5th assistant reply, at most once per session. */
export function shouldPromptForFeedback(): boolean {
  if (isDismissed()) return false;
  const state = readSession();
  if (state.prompted) return false;
  return state.assistantReplies > 0 && state.assistantReplies % 5 === 0;
}
