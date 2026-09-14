import { nanoid } from "nanoid";

import type { MindMapNode } from "./types";

type StackEntry = {
  kind: "heading" | "list";
  level: number;
  indent?: number;
  node: MindMapNode;
};

function createNode(content: string): MindMapNode {
  return { id: nanoid(8), content, children: [] };
}

export function parseMarkdownToTree(markdown: string): MindMapNode {
  const lines = String(markdown || "").split(/\r?\n/);
  let rootContent = "Mind map";
  let firstHeadingIndex = -1;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]?.trim() ?? "";
    if (!line) continue;
    const match = line.match(/^(#{1,6})\s+(.*)$/);
    if (match) {
      rootContent = match[2]?.trim() || rootContent;
      firstHeadingIndex = i;
      break;
    }
  }

  const root = createNode(rootContent);
  const stack: StackEntry[] = [{ kind: "heading", level: 1, node: root }];

  lines.forEach((raw, index) => {
    const line = raw.trim();
    if (!line || index === firstHeadingIndex) return;

    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      const level = heading[1]?.length ?? 1;
      const text = heading[2]?.trim() ?? "";
      const node = createNode(text);
      while (stack.length > 0 && (stack[stack.length - 1]?.kind === "list" || (stack[stack.length - 1]?.level ?? 0) >= level)) {
        stack.pop();
      }
      const parent = stack[stack.length - 1]?.node ?? root;
      parent.children.push(node);
      stack.push({ kind: "heading", level, node });
      return;
    }

    const bullet = raw.match(/^(\s*)([-*+]|\d+\.)\s+(.*)$/);
    if (bullet) {
      const indent = Math.floor((bullet[1]?.replace(/\t/g, "  ") ?? "").length / 2);
      const text = bullet[3]?.trim() ?? "";
      const node = createNode(text);
      let parent = stack[stack.length - 1]?.node ?? root;
      const last = stack[stack.length - 1];
      if (last?.kind === "list") {
        if (indent > (last.indent ?? 0)) {
          parent = last.node;
        } else {
          while (
            stack.length > 1 &&
            stack[stack.length - 1]?.kind === "list" &&
            (stack[stack.length - 1]?.indent ?? 0) >= indent
          ) {
            stack.pop();
          }
          parent = stack[stack.length - 1]?.node ?? root;
        }
      }
      parent.children.push(node);
      stack.push({ kind: "list", level: 0, indent, node });
      return;
    }

    const node = createNode(line);
    const parent = stack[stack.length - 1]?.node ?? root;
    parent.children.push(node);
  });

  return root;
}

export function treeToMarkdown(root: MindMapNode, title?: string): string {
  const lines: string[] = [];
  const headingTitle = title?.trim() || root.content.trim() || "Mind map";
  lines.push(`# ${headingTitle}`);

  function walk(node: MindMapNode, depth: number, isRoot: boolean) {
    if (!isRoot) {
      if (depth <= 2) {
        lines.push(`\n${"#".repeat(depth + 1)} ${node.content.trim()}`);
      } else {
        lines.push(`- ${node.content.trim()}`);
      }
    }
    for (const child of node.children) {
      walk(child, isRoot ? 1 : depth + 1, false);
    }
  }

  walk(root, 0, true);
  return lines.join("\n").trim();
}
