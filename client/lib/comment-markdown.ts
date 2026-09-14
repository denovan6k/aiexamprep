import TurndownService from "turndown";
import { marked } from "marked";

const turndown = new TurndownService({
  headingStyle: "atx",
  bulletListMarker: "-",
  codeBlockStyle: "fenced"
});

turndown.addRule("strikethrough", {
  filter: ["del", "s"],
  replacement: (content) => `~~${content}~~`
});

export function markdownToHtml(markdown: string): string {
  if (!markdown.trim()) return "";
  return marked.parse(markdown, { async: false }) as string;
}

export function htmlToMarkdown(html: string): string {
  if (!html.trim() || html === "<p></p>") return "";
  return turndown.turndown(html).trim();
}

export function authorInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}
