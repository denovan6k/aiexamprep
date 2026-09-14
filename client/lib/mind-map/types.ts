export type MindMapLayout = "balanced" | "right";

export type MindMapSettings = {
  layout: MindMapLayout;
  levelSpacing: number;
  nodeRadius: number;
  nodeSpacing: number;
};

export type MindMapNode = {
  id: string;
  content: string;
  children: MindMapNode[];
  collapsed?: boolean;
  color?: string;
};

export type MindMapDocument = {
  title: string;
  markdown: string;
  settings: MindMapSettings;
  root: MindMapNode;
};

export type MeasuredMindMapNode = Omit<MindMapNode, "children"> & {
  width: number;
  height: number;
  lines: string[];
  fontSize: number;
  fontWeight: number;
  children: MeasuredMindMapNode[];
};

export type LayoutMindMapNode = MeasuredMindMapNode & {
  x: number;
  y: number;
  depth: number;
  side: "left" | "right" | "center";
  branchColor: string;
  parentId?: string;
};

export type MindMapBounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
};

export const DEFAULT_MIND_MAP_SETTINGS: MindMapSettings = {
  layout: "balanced",
  levelSpacing: 80,
  nodeRadius: 14,
  nodeSpacing: 24
};
