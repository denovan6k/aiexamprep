import { apiRequest } from "@/lib/api";

export type JobStatus = "queued" | "running" | "completed" | "failed";
export type JobType =
  | "quiz_generation"
  | "flashcard_generation"
  | "study_artifact_generation"
  | "material_processing";

export type GenerationJob = {
  id: string;
  job_type: JobType;
  status: JobStatus;
  queue_position: number | null;
  thread_id: string | null;
  material_id: string | null;
  message_id: string | null;
  progress_stage?: string | null;
  result: {
    quiz_id?: string;
    deck_id?: string;
    artifact_id?: string;
    message_id?: string;
    question_count?: number;
    card_count?: number;
    material_id?: string;
    status?: string;
    chunk_count?: number;
    artifact_type?: string;
  } | null;
  error_message: string | null;
  duration_ms: number | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export async function getJob(token: string, jobId: string) {
  return apiRequest<GenerationJob>(`/jobs/${jobId}`, { token });
}

export async function pollJobUntilComplete(
  token: string,
  jobId: string,
  options: {
    timeoutMs?: number;
    onUpdate?: (job: GenerationJob) => void;
    signal?: AbortSignal;
  } = {}
): Promise<GenerationJob> {
  const timeoutMs = options.timeoutMs ?? 300_000;
  const started = Date.now();
  let intervalMs = 1000;

  while (Date.now() - started < timeoutMs) {
    if (options.signal?.aborted) {
      throw new Error("Job polling aborted");
    }
    const job = await getJob(token, jobId);
    options.onUpdate?.(job);
    if (job.status === "completed" || job.status === "failed") {
      return job;
    }
    await new Promise((resolve, reject) => {
      const timeoutId = window.setTimeout(() => resolve(undefined), intervalMs);
      const abortListener = () => {
        window.clearTimeout(timeoutId);
        reject(new Error("Job polling aborted"));
      };
      options.signal?.addEventListener("abort", abortListener, { once: true });
      window.setTimeout(() => {
        options.signal?.removeEventListener("abort", abortListener);
      }, intervalMs + 5);
    });
    intervalMs = Math.min(5000, intervalMs * 2);
  }

  throw new Error("Job polling timed out");
}
