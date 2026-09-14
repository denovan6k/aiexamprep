"use client";

import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { EditorContent, useEditor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import StarterKit from "@tiptap/starter-kit";
import { Bold, Code, Italic, Link2, List, Quote } from "lucide-react";
import { useEffect, useRef } from "react";

import { Button } from "@/components/ui/button";
import { htmlToMarkdown, markdownToHtml } from "@/lib/comment-markdown";
import { cn } from "@/lib/utils";

type CommentComposerProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minHeight?: number;
  disabled?: boolean;
  autoFocus?: boolean;
  className?: string;
};

function BubbleToolbarButton({
  label,
  active,
  disabled,
  onClick,
  children
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      variant={active ? "secondary" : "ghost"}
      size="icon"
      className="h-7 w-7"
      disabled={disabled}
      aria-label={label}
      onMouseDown={(event) => {
        event.preventDefault();
        onClick();
      }}
    >
      {children}
    </Button>
  );
}

export function CommentComposer({
  value,
  onChange,
  placeholder = "Add a comment…",
  minHeight = 88,
  disabled,
  autoFocus,
  className
}: CommentComposerProps) {
  const syncingRef = useRef(false);
  const lastExternalValue = useRef(value);

  const editor = useEditor({
    immediatelyRender: false,
    editable: !disabled,
    extensions: [
      StarterKit.configure({
        heading: false,
        horizontalRule: false,
        codeBlock: false,
        link: false
      }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: { class: "text-primary underline underline-offset-2" }
      }),
      Placeholder.configure({ placeholder })
    ],
    content: markdownToHtml(value),
    editorProps: {
      attributes: {
        class: cn(
          "prose prose-sm prose-neutral dark:prose-invert max-w-none px-3 py-2.5 outline-none",
          "prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-blockquote:my-1",
          "[&_.is-editor-empty:first-child]:before:pointer-events-none [&_.is-editor-empty:first-child]:before:float-left",
          "[&_.is-editor-empty:first-child]:before:h-0 [&_.is-editor-empty:first-child]:before:text-muted-foreground",
          `[&_.is-editor-empty:first-child]:before:content-[attr(data-placeholder)]`
        ),
        style: `min-height: ${minHeight}px`
      }
    },
    onUpdate: ({ editor: currentEditor }) => {
      if (syncingRef.current) return;
      const markdown = htmlToMarkdown(currentEditor.getHTML());
      lastExternalValue.current = markdown;
      onChange(markdown);
    }
  });

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!disabled);
  }, [disabled, editor]);

  useEffect(() => {
    if (!editor || value === lastExternalValue.current) return;
    syncingRef.current = true;
    editor.commands.setContent(markdownToHtml(value), { emitUpdate: false });
    lastExternalValue.current = value;
    syncingRef.current = false;
  }, [editor, value]);

  useEffect(() => {
    if (autoFocus && editor) {
      editor.commands.focus("end");
    }
  }, [autoFocus, editor]);

  function setLink() {
    if (!editor) return;
    const previous = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("Link URL", previous ?? "https://");
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  }

  return (
    <div
      className={cn(
        "overflow-hidden rounded-lg border border-border bg-card focus-within:ring-1 focus-within:ring-ring",
        disabled && "opacity-60",
        className
      )}
    >
      {editor ? (
        <BubbleMenu
          editor={editor}
          className="flex items-center gap-0.5 rounded-md border border-border bg-popover p-0.5 shadow-md"
        >
          <BubbleToolbarButton
            label="Bold"
            active={editor.isActive("bold")}
            disabled={disabled}
            onClick={() => editor.chain().focus().toggleBold().run()}
          >
            <Bold className="h-3.5 w-3.5" />
          </BubbleToolbarButton>
          <BubbleToolbarButton
            label="Italic"
            active={editor.isActive("italic")}
            disabled={disabled}
            onClick={() => editor.chain().focus().toggleItalic().run()}
          >
            <Italic className="h-3.5 w-3.5" />
          </BubbleToolbarButton>
          <BubbleToolbarButton
            label="Link"
            active={editor.isActive("link")}
            disabled={disabled}
            onClick={setLink}
          >
            <Link2 className="h-3.5 w-3.5" />
          </BubbleToolbarButton>
          <BubbleToolbarButton
            label="Inline code"
            active={editor.isActive("code")}
            disabled={disabled}
            onClick={() => editor.chain().focus().toggleCode().run()}
          >
            <Code className="h-3.5 w-3.5" />
          </BubbleToolbarButton>
          <BubbleToolbarButton
            label="Quote"
            active={editor.isActive("blockquote")}
            disabled={disabled}
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
          >
            <Quote className="h-3.5 w-3.5" />
          </BubbleToolbarButton>
          <BubbleToolbarButton
            label="Bullet list"
            active={editor.isActive("bulletList")}
            disabled={disabled}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
          >
            <List className="h-3.5 w-3.5" />
          </BubbleToolbarButton>
        </BubbleMenu>
      ) : null}
      <EditorContent editor={editor} />
    </div>
  );
}
