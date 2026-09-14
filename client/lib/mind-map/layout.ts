import { branchColorForIndex } from "./colors";
import type { MeasuredMindMapNode } from "./types";
import { measureTree } from "./measure";
import type { LayoutMindMapNode, MindMapBounds, MindMapNode, MindMapSettings } from "./types";

type PositionedNode = LayoutMindMapNode & {
  measuredChildren: PositionedNode[];
  subtreeHeight: number;
};

function assignSides(children: MeasuredMindMapNode[], layout: MindMapSettings["layout"]): Array<"left" | "right"> {
  if (layout === "right") {
    return children.map(() => "right");
  }
  return children.map((_, index) => (index % 2 === 0 ? "right" : "left"));
}

function computeSubtreeHeight(node: MeasuredMindMapNode, nodeSpacing: number): number {
  if (node.collapsed || node.children.length === 0) {
    return node.height;
  }
  const childHeights = node.children.map((child) => computeSubtreeHeight(child, nodeSpacing));
  const totalChildrenHeight = childHeights.reduce((sum, value) => sum + value, 0);
  const gaps = Math.max(0, node.children.length - 1) * nodeSpacing;
  return Math.max(node.height, totalChildrenHeight + gaps);
}

function layoutSubtree(
  node: MeasuredMindMapNode,
  depth: number,
  side: "left" | "right" | "center",
  branchColor: string,
  settings: MindMapSettings,
  x: number,
  y: number
): PositionedNode {
  const visibleChildren = node.collapsed ? [] : node.children;
  const visibleNode = { ...node, children: visibleChildren };
  const positioned: PositionedNode = {
    ...visibleNode,
    x,
    y,
    depth,
    side,
    branchColor,
    measuredChildren: [],
    subtreeHeight: computeSubtreeHeight(visibleNode, settings.nodeSpacing)
  };

  if (visibleChildren.length === 0) {
    return positioned;
  }

  const childSides = depth === 0 ? assignSides(visibleChildren, settings.layout) : visibleChildren.map(() => side);
  const childHeights = visibleChildren.map((child) => computeSubtreeHeight(child, settings.nodeSpacing));
  const totalHeight =
    childHeights.reduce((sum, value) => sum + value, 0) +
    Math.max(0, visibleChildren.length - 1) * settings.nodeSpacing;
  let cursorY = y - totalHeight / 2;

  positioned.measuredChildren = visibleChildren.map((child, index) => {
    const childSide = childSides[index] ?? side;
    const childHeight = childHeights[index] ?? child.height;
    const childY = cursorY + childHeight / 2;
    cursorY += childHeight + settings.nodeSpacing;

    const direction = childSide === "left" ? -1 : 1;
    const childX =
      depth === 0
        ? x + direction * (node.width / 2 + settings.levelSpacing + child.width / 2)
        : x + direction * (node.width / 2 + settings.levelSpacing * 0.75 + child.width / 2);

    const color = depth === 0 ? branchColorForIndex(index) : branchColor;
    return layoutSubtree(child, depth + 1, childSide, color, settings, childX, childY);
  });

  return positioned;
}

function flattenTree(
  node: PositionedNode,
  parentId: string | undefined,
  output: LayoutMindMapNode[] = []
): LayoutMindMapNode[] {
  const { measuredChildren, subtreeHeight: _subtreeHeight, ...rest } = node;
  output.push({ ...rest, parentId });
  for (const child of measuredChildren) {
    flattenTree(child, node.id, output);
  }
  return output;
}

export function layoutMindMap(root: MindMapNode, settings: MindMapSettings): {
  nodes: LayoutMindMapNode[];
  bounds: MindMapBounds;
} {
  const measuredRoot = measureTree(root, 0);
  const positionedRoot = layoutSubtree(measuredRoot, 0, "center", branchColorForIndex(0), settings, 0, 0);
  const nodes = flattenTree(positionedRoot, undefined);

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const node of nodes) {
    minX = Math.min(minX, node.x - node.width / 2);
    maxX = Math.max(maxX, node.x + node.width / 2);
    minY = Math.min(minY, node.y - node.height / 2);
    maxY = Math.max(maxY, node.y + node.height / 2);
  }

  if (!Number.isFinite(minX)) {
    minX = -100;
    maxX = 100;
    minY = -50;
    maxY = 50;
  }

  return {
    nodes,
    bounds: {
      minX,
      minY,
      maxX,
      maxY,
      width: maxX - minX,
      height: maxY - minY
    }
  };
}
