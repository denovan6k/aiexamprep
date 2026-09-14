import { nanoid } from "nanoid";

import { treeToMarkdown } from "./markdown";
import type { MindMapDocument, MindMapNode } from "./types";

export function findNode(root: MindMapNode, nodeId: string): MindMapNode | null {
  if (root.id === nodeId) return root;
  for (const child of root.children) {
    const found = findNode(child, nodeId);
    if (found) return found;
  }
  return null;
}

export function updateNode(
  root: MindMapNode,
  nodeId: string,
  updater: (node: MindMapNode) => MindMapNode
): MindMapNode {
  if (root.id === nodeId) {
    return updater(root);
  }
  return {
    ...root,
    children: root.children.map((child) => updateNode(child, nodeId, updater))
  };
}

export function deleteNode(root: MindMapNode, nodeId: string): MindMapNode | null {
  if (root.id === nodeId) return null;
  return {
    ...root,
    children: root.children
      .map((child) => deleteNode(child, nodeId))
      .filter((child): child is MindMapNode => child !== null)
  };
}

export function addChild(root: MindMapNode, parentId: string, content = "New branch"): MindMapNode {
  return updateNode(root, parentId, (node) => ({
    ...node,
    collapsed: false,
    children: [...node.children, { id: nanoid(8), content, children: [] }]
  }));
}

export function syncDocumentRoot(document: MindMapDocument, root: MindMapNode): MindMapDocument {
  return {
    ...document,
    root,
    markdown: treeToMarkdown(root, document.title)
  };
}
