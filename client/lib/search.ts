import { API_BASE_URL, apiRequest, parseApiError } from "@/lib/api";

export type SearchRequest = {
  query: string;
  course_id?: string | null;
  material_ids?: string[];
  limit?: number;
};

export type SearchResult = {
  chunk_id: string;
  material_title: string;
  source: string;
  excerpt: string;
  score: number;
};

export type SearchResponse = {
  query: string;
  results: SearchResult[];
};

export type SearchCitation = {
  index: number;
  chunk_id: string;
  material_title: string;
  source: string;
  excerpt: string;
};

export type AskSearchResponse = {
  query: string;
  plan: Array<{ query: string; reason: string }>;
  answer: string;
  citations: SearchCitation[];
  token_estimate: number;
  truncated: boolean;
  used_fallback: boolean;
};

export type AskSearchEvent =
  | { type: "retrieval_plan"; query: string; plan: AskSearchResponse["plan"] }
  | { type: "answer"; answer: string; used_fallback: boolean }
  | {
      type: "citations";
      citations: SearchCitation[];
      token_estimate: number;
      truncated: boolean;
    }
  | { type: "done" };

export function searchMaterials(token: string, request: SearchRequest) {
  return apiRequest<SearchResponse>("/search", {
    method: "POST",
    token,
    body: JSON.stringify(request)
  });
}

export async function askMaterials(token: string, request: SearchRequest & { max_subqueries?: number }) {
  const response: AskSearchResponse = {
    query: request.query,
    plan: [],
    answer: "",
    citations: [],
    token_estimate: 0,
    truncated: false,
    used_fallback: false
  };
  await askMaterialsStream(token, request, (event) => {
    if (event.type === "retrieval_plan") {
      response.query = event.query;
      response.plan = event.plan;
    } else if (event.type === "answer") {
      response.answer = event.answer;
      response.used_fallback = event.used_fallback;
    } else if (event.type === "citations") {
      response.citations = event.citations;
      response.token_estimate = event.token_estimate;
      response.truncated = event.truncated;
    }
  });
  return response;
}

export async function askMaterialsStream(
  _token: string,
  request: SearchRequest & { max_subqueries?: number },
  onEvent: (event: AskSearchEvent) => void
) {
  const response = await fetch(`${API_BASE_URL}/search/ask`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(request)
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw parseApiError(body, response.status, response.statusText);
  }

  if (!response.body) {
    throw new Error("Search response stream was empty.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) continue;
      onEvent(JSON.parse(line) as AskSearchEvent);
    }
  }

  const tail = buffer.trim();
  if (tail) {
    onEvent(JSON.parse(tail) as AskSearchEvent);
  }
}
