import type { MeasuredMindMapNode, MindMapNode } from "./types";

const MAX_NODE_WIDTH = 280;
const HORIZONTAL_PADDING = 20;
const VERTICAL_PADDING = 8;
const LINE_HEIGHT = 22;
const FONT_SIZE = 15;
const ROOT_FONT_SIZE = 22;

let measureCanvas: HTMLCanvasElement | null = null;

function getMeasureContext(): CanvasRenderingContext2D | null {
  if (typeof document === "undefined") return null;
  if (!measureCanvas) {
    measureCanvas = document.createElement("canvas");
  }
  return measureCanvas.getContext("2d");
}

function setFont(ctx: CanvasRenderingContext2D, fontSize: number, fontWeight: number) {
  ctx.font = `${fontWeight} ${fontSize}px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
}

function measureLineWidth(text: string, fontSize: number, fontWeight: number): number {
  const ctx = getMeasureContext();
  if (!ctx) return text.length * (fontSize * 0.55);
  setFont(ctx, fontSize, fontWeight);
  return ctx.measureText(text).width;
}

function wrapText(text: string, maxWidth: number, fontSize: number, fontWeight: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [""];

  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (measureLineWidth(candidate, fontSize, fontWeight) <= maxWidth) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = measureLineWidth(word, fontSize, fontWeight) <= maxWidth ? word : word.slice(0, 24);
    }
  }
  if (current) lines.push(current);
  return lines;
}

type NodeDimensions = {
  width: number;
  height: number;
  lines: string[];
  fontSize: number;
  fontWeight: number;
};

export function measureNode(node: MindMapNode, depth = 0): NodeDimensions {
  const fontSize = depth === 0 ? ROOT_FONT_SIZE : FONT_SIZE;
  const fontWeight = depth === 0 ? 700 : 500;
  const maxTextWidth = MAX_NODE_WIDTH - HORIZONTAL_PADDING * 2;
  const lines = wrapText(node.content.trim() || "Untitled", maxTextWidth, fontSize, fontWeight);
  const lineWidth = Math.max(...lines.map((line) => measureLineWidth(line, fontSize, fontWeight)), 24);
  const width = Math.min(MAX_NODE_WIDTH, Math.ceil(lineWidth + HORIZONTAL_PADDING * 2));
  const height = Math.max(36, lines.length * LINE_HEIGHT + VERTICAL_PADDING * 2);

  return {
    width,
    height,
    lines,
    fontSize,
    fontWeight
  };
}

export function measureTree(node: MindMapNode, depth = 0): MeasuredMindMapNode {
  const measured = measureNode(node, depth);
  const children = node.children.map((child) => measureTree(child, depth + 1));
  return {
    id: node.id,
    content: node.content,
    collapsed: node.collapsed,
    color: node.color,
    width: measured.width,
    height: measured.height,
    lines: measured.lines,
    fontSize: measured.fontSize,
    fontWeight: measured.fontWeight,
    children
  };
}
