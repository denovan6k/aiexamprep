import { nanoid } from "nanoid";

import { parseMarkdownToTree, treeToMarkdown } from "./markdown";
import { DEFAULT_MIND_MAP_SETTINGS, type MindMapDocument, type MindMapNode } from "./types";

type LegacyNode = {
  label?: string;
  content?: string;
  children?: LegacyNode[];
};

function legacyToNode(value: LegacyNode): MindMapNode {
  const children = Array.isArray(value.children)
    ? value.children.map((child) => legacyToNode(child))
    : [];
  return {
    id: nanoid(8),
    content: String(value.label ?? value.content ?? "Untitled").trim() || "Untitled",
    children
  };
}

export function documentFromPreview(preview: Record<string, unknown>): MindMapDocument {
  const title = String(preview.title ?? "Mind map").trim() || "Mind map";
  const markdown = String(preview.markdown ?? "").trim();
  const settings = {
    ...DEFAULT_MIND_MAP_SETTINGS,
    ...(typeof preview.settings === "object" && preview.settings !== null
      ? (preview.settings as Partial<typeof DEFAULT_MIND_MAP_SETTINGS>)
      : {})
  };

  if (markdown) {
    return {
      title,
      markdown,
      settings,
      root: parseMarkdownToTree(markdown)
    };
  }

  const rootValue = preview.root;
  if (rootValue && typeof rootValue === "object") {
    const root = legacyToNode(rootValue as LegacyNode);
    const generatedMarkdown = treeToMarkdown(root, title);
    return {
      title,
      markdown: generatedMarkdown,
      settings,
      root: parseMarkdownToTree(generatedMarkdown)
    };
  }

  const fallbackMarkdown = `# ${title}`;
  return {
    title,
    markdown: fallbackMarkdown,
    settings,
    root: parseMarkdownToTree(fallbackMarkdown)
  };
}

export function documentToContent(document: MindMapDocument): Record<string, unknown> {
  return {
    title: document.title,
    markdown: document.markdown,
    settings: document.settings
  };
}
