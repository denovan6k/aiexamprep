"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";

export type MindMapNode = {
  label?: string;
  children?: MindMapNode[];
};

function normalizeMindMapNode(value: unknown): MindMapNode | undefined {
  if (!value || typeof value !== "object") return undefined;

  const record = value as Record<string, unknown>;
  const label = typeof record.label === "string" ? record.label : undefined;
  const rawChildren = Array.isArray(record.children) ? record.children : undefined;
  const children = rawChildren
    ?.map((child) => normalizeMindMapNode(child))
    .filter((child): child is MindMapNode => child !== undefined);

  if (!label && !children?.length) return undefined;
  return { label, children: children?.length ? children : undefined };
}

export function normalizeMindMapRoot(preview: Record<string, unknown>): MindMapNode | undefined {
  return normalizeMindMapNode(preview.root);
}

type MindMapRendererProps = {
  root?: MindMapNode;
  className?: string;
  defaultExpandedDepth?: number;
};

function MindMapNodeView({
  node,
  depth,
  defaultExpandedDepth
}: {
  node: MindMapNode;
  depth: number;
  defaultExpandedDepth: number;
}) {
  const children = node.children ?? [];
  const [expanded, setExpanded] = useState(depth < defaultExpandedDepth);
  const hasChildren = children.length > 0;
  const label = (node.label || "Untitled").trim();

  return (
    <li className="relative">
      <div className="flex items-start gap-2">
        {hasChildren ? (
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded border border-border/70 text-[10px] text-muted-foreground hover:bg-muted/60"
            aria-expanded={expanded}
            aria-label={expanded ? "Collapse branch" : "Expand branch"}
          >
            {expanded ? "−" : "+"}
          </button>
        ) : (
          <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center text-muted-foreground">
            •
          </span>
        )}
        <span
          className={cn(
            "text-sm leading-snug",
            depth === 0 ? "font-semibold text-foreground" : "text-foreground/90"
          )}
        >
          {label}
        </span>
      </div>
      {hasChildren && expanded ? (
        <ul className="ml-5 mt-1 space-y-1 border-l border-border/60 pl-3">
          {children.map((child, index) => (
            <MindMapNodeView
              key={`${child.label ?? "node"}-${depth}-${index}`}
              node={child}
              depth={depth + 1}
              defaultExpandedDepth={defaultExpandedDepth}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export function MindMapRenderer({
  root,
  className,
  defaultExpandedDepth = 2
}: MindMapRendererProps) {
  if (!root?.label && !(root?.children?.length ?? 0)) {
    return (
      <p className="text-sm text-muted-foreground">No mind map nodes to display.</p>
    );
  }

  return (
    <ul className={cn("space-y-2", className)}>
      <MindMapNodeView node={root ?? { label: "Mind map", children: [] }} depth={0} defaultExpandedDepth={defaultExpandedDepth} />
    </ul>
  );
}
