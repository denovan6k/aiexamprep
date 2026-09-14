"use client";

import {
  Bold,
  Code,
  Eye,
  ImageIcon,
  Italic,
  Link2,
  List,
  Quote
} from "lucide-react";
import { useRef, useState } from "react";

import { Markdown } from "@/components/markdown";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type MarkdownComposerProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minRows?: number;
  disabled?: boolean;
  className?: string;
};

function wrapSelection(
  textarea: HTMLTextAreaElement,
  before: string,
  after: string,
  placeholder: string
) {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const selected = textarea.value.slice(start, end) || placeholder;
  const next =
    textarea.value.slice(0, start) + before + selected + after + textarea.value.slice(end);
  const cursor = start + before.length + selected.length + after.length;
  return { next, cursor };
}

function insertAtCursor(textarea: HTMLTextAreaElement, snippet: string) {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const next = textarea.value.slice(0, start) + snippet + textarea.value.slice(end);
  return { next, cursor: start + snippet.length };
}

export function MarkdownComposer({
  value,
  onChange,
  placeholder = "Write in Markdown — **bold**, `code`, links, lists, and images supported.",
  minRows = 5,
  disabled,
  className
}: MarkdownComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [mode, setMode] = useState<"write" | "preview">("write");
  const [imageUrl, setImageUrl] = useState("");
  const [showImageInput, setShowImageInput] = useState(false);

  function applyTransform(transform: (el: HTMLTextAreaElement) => { next: string; cursor: number }) {
    const el = textareaRef.current;
    if (!el || disabled) return;
    const { next, cursor } = transform(el);
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(cursor, cursor);
    });
  }

  function handleToolbar(action: string) {
    const el = textareaRef.current;
    if (!el) return;

    switch (action) {
      case "bold":
        applyTransform((t) => wrapSelection(t, "**", "**", "bold"));
        break;
      case "italic":
        applyTransform((t) => wrapSelection(t, "_", "_", "italic"));
        break;
      case "code":
        applyTransform((t) => wrapSelection(t, "`", "`", "code"));
        break;
      case "codeblock":
        applyTransform((t) => wrapSelection(t, "\n```\n", "\n```\n", "code here"));
        break;
      case "quote":
        applyTransform((t) => wrapSelection(t, "\n> ", "\n", "quote"));
        break;
      case "list":
        applyTransform((t) => wrapSelection(t, "\n- ", "\n", "item"));
        break;
      case "link": {
        const url = window.prompt("Link URL", "https://");
        if (!url) return;
        applyTransform((t) => wrapSelection(t, "[", `](${url})`, "link text"));
        break;
      }
      case "image":
        setShowImageInput((prev) => !prev);
        break;
      default:
        break;
    }
  }

  function insertImageMarkdown() {
    if (!imageUrl.trim()) return;
    applyTransform((t) =>
      insertAtCursor(t, `\n![image](${imageUrl.trim()})\n`)
    );
    setImageUrl("");
    setShowImageInput(false);
  }

  const tools = [
    { id: "bold", icon: Bold, label: "Bold" },
    { id: "italic", icon: Italic, label: "Italic" },
    { id: "link", icon: Link2, label: "Link" },
    { id: "code", icon: Code, label: "Inline code" },
    { id: "codeblock", icon: Code, label: "Code block" },
    { id: "quote", icon: Quote, label: "Quote" },
    { id: "list", icon: List, label: "List" },
    { id: "image", icon: ImageIcon, label: "Image URL" }
  ];

  return (
    <div className={cn("overflow-hidden rounded-lg border border-border bg-card", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-muted/30 px-2 py-1.5">
        <div className="flex flex-wrap items-center gap-0.5">
          {tools.map((tool) => (
            <Button
              key={tool.id}
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              disabled={disabled || mode === "preview"}
              aria-label={tool.label}
              onClick={() => handleToolbar(tool.id)}
            >
              <tool.icon className="h-4 w-4" />
            </Button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant={mode === "write" ? "secondary" : "ghost"}
            size="sm"
            className="h-8"
            onClick={() => setMode("write")}
          >
            Write
          </Button>
          <Button
            type="button"
            variant={mode === "preview" ? "secondary" : "ghost"}
            size="sm"
            className="h-8"
            onClick={() => setMode("preview")}
          >
            <Eye className="mr-1 h-3.5 w-3.5" />
            Preview
          </Button>
        </div>
      </div>

      {showImageInput ? (
        <div className="flex flex-wrap items-center gap-2 border-b border-border bg-muted/20 px-3 py-2">
          <Input
            value={imageUrl}
            onChange={(event) => setImageUrl(event.target.value)}
            placeholder="https://example.com/image.png"
            className="h-8 flex-1 text-sm"
            disabled={disabled}
          />
          <Button type="button" size="sm" disabled={!imageUrl.trim() || disabled} onClick={insertImageMarkdown}>
            Insert image
          </Button>
        </div>
      ) : null}

      {mode === "write" ? (
        <Textarea
          ref={textareaRef}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          rows={minRows}
          disabled={disabled}
          className="min-h-[120px] resize-y rounded-none border-0 bg-transparent shadow-none focus-visible:ring-0"
        />
      ) : (
        <div className="prose prose-sm prose-neutral dark:prose-invert max-w-none px-4 py-3">
          {value.trim() ? <Markdown>{value}</Markdown> : <p className="text-muted-foreground">Nothing to preview yet.</p>}
        </div>
      )}

      <div className="border-t border-border px-3 py-1.5 text-[11px] text-muted-foreground">
        Markdown supported · paste code in ``` fences · images via URL
      </div>
    </div>
  );
}
