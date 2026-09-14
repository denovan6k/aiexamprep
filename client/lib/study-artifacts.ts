import { apiRequest } from "@/lib/api";

export type StudyArtifact = {
  id: string;
  artifact_type: string;
  title: string;
  content: Record<string, unknown>;
  schema_version: number;
  thread_id: string | null;
  message_id: string | null;
  material_id: string | null;
  created_at: string;
  updated_at: string;
};

export type StudyArtifactUpdateInput = {
  title?: string;
  content?: Record<string, unknown>;
};

export function getStudyArtifact(token: string, artifactId: string) {
  return apiRequest<StudyArtifact>(`/study-artifacts/${artifactId}`, { token });
}

export function updateStudyArtifact(
  token: string,
  artifactId: string,
  input: StudyArtifactUpdateInput
) {
  return apiRequest<StudyArtifact>(`/study-artifacts/${artifactId}`, {
    method: "PATCH",
    token,
    body: JSON.stringify(input)
  });
}
