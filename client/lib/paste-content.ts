export type PastedContentKind = "text" | "code";

export type PastedContent = {
  kind: PastedContentKind;
  label: string;
  content: string;
  lineCount: number;
};

const CODE_KEYWORDS =
  /\b(?:async|await|class|const|def|export|from|function|import|interface|let|public|return|SELECT|INSERT|UPDATE|DELETE|CREATE|WHERE)\b/;

function looksLikeCode(content: string, lines: string[]) {
  if (/```/.test(content) || CODE_KEYWORDS.test(content)) return true;

  const punctuationCount = (content.match(/[{}[\];]/g) ?? []).length;
  if (punctuationCount >= 4) return true;

  return lines.filter((line) => /^(?:\t| {2,})\S/.test(line)).length >= 2;
}

export function getPastedContent(content: string): PastedContent | null {
  const normalizedContent = content.replace(/\r\n?/g, "\n");
  if (!normalizedContent.trim() || !normalizedContent.includes("\n")) return null;

  const lines = normalizedContent.split("\n");
  const kind = looksLikeCode(normalizedContent, lines) ? "code" : "text";
  const shouldChip =
    lines.length >= 3 || normalizedContent.length >= 120 || kind === "code";

  if (!shouldChip) return null;

  return {
    kind,
    label: `${kind === "code" ? "Code" : "TXT"} · ${lines.length} ${lines.length === 1 ? "line" : "lines"}`,
    content: normalizedContent,
    lineCount: lines.length
  };
}
