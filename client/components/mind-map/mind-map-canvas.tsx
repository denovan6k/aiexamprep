"use client";

import { useMemo } from "react";

import { findNode } from "@/lib/mind-map/tree-ops";
import { layoutMindMap, linkPath } from "@/lib/mind-map";
import type { LayoutMindMapNode, MindMapNode, MindMapSettings } from "@/lib/mind-map";

type MindMapCanvasProps = {
  root: MindMapNode;
  settings: MindMapSettings;
  className?: string;
  interactive?: boolean;
  selectedNodeId?: string | null;
  editingNodeId?: string | null;
  editValue?: string;
  onSelectNode?: (nodeId: string) => void;
  onBeginEdit?: (nodeId: string, content: string) => void;
  onEditValueChange?: (value: string) => void;
  onCommitEdit?: () => void;
  onCancelEdit?: () => void;
  onToggleCollapse?: (nodeId: string) => void;
  onContextMenu?: (nodeId: string, event: React.MouseEvent) => void;
};

function nodeMap(nodes: LayoutMindMapNode[]) {
  return new Map(nodes.map((node) => [node.id, node]));
}

function stopPan(event: React.MouseEvent | React.PointerEvent) {
  event.stopPropagation();
}

export function MindMapCanvas({
  root,
  settings,
  className,
  interactive = false,
  selectedNodeId,
  editingNodeId,
  editValue,
  onSelectNode,
  onBeginEdit,
  onEditValueChange,
  onCommitEdit,
  onCancelEdit,
  onToggleCollapse,
  onContextMenu
}: MindMapCanvasProps) {
  const { nodes, bounds } = useMemo(() => layoutMindMap(root, settings), [root, settings]);
  const byId = useMemo(() => nodeMap(nodes), [nodes]);

  const padding = 48;
  const viewWidth = Math.max(bounds.width + padding * 2, 320);
  const viewHeight = Math.max(bounds.height + padding * 2, 240);
  const offsetX = -bounds.minX + padding;
  const offsetY = -bounds.minY + padding;

  const links = nodes
    .filter((node) => node.parentId)
    .map((node) => {
      const parent = byId.get(node.parentId!);
      if (!parent) return null;
      const parentEdgeX = parent.x + offsetX + (node.side === "left" ? -parent.width / 2 : parent.width / 2);
      const childEdgeX = node.x + offsetX + (node.side === "left" ? node.width / 2 : -node.width / 2);
      return {
        id: `${parent.id}-${node.id}`,
        path: linkPath(parentEdgeX, parent.y + offsetY, childEdgeX, node.y + offsetY, node.side),
        color: node.branchColor
      };
    })
    .filter((link): link is NonNullable<typeof link> => link !== null);

  return (
    <svg
      className={className}
      viewBox={`0 0 ${viewWidth} ${viewHeight}`}
      width="100%"
      height="100%"
      role="img"
      aria-label="Mind map"
    >
      <rect width={viewWidth} height={viewHeight} fill="transparent" data-mindmap-background="true" />
      <g>
        {links.map((link) => (
          <path
            key={link.id}
            d={link.path}
            fill="none"
            stroke={link.color}
            strokeWidth={3}
            strokeLinecap="round"
            pointerEvents="none"
          />
        ))}
        {nodes.map((node) => {
          const x = node.x + offsetX - node.width / 2;
          const y = node.y + offsetY - node.height / 2;
          const isSelected = selectedNodeId === node.id;
          const isEditing = editingNodeId === node.id;
          const sourceNode = findNode(root, node.id);
          const hasChildren = (sourceNode?.children.length ?? 0) > 0;
          const isCollapsed = Boolean(sourceNode?.collapsed);
          const fill = node.depth === 0 ? "hsl(var(--card))" : "hsl(var(--background))";
          const stroke = isSelected ? "hsl(var(--primary))" : node.branchColor;

          return (
            <g
              key={node.id}
              data-mindmap-node="true"
              transform={`translate(${x}, ${y})`}
              onPointerDown={interactive ? stopPan : undefined}
              onClick={(event) => {
                stopPan(event);
                onSelectNode?.(node.id);
              }}
              onDoubleClick={(event) => {
                stopPan(event);
                if (interactive) onBeginEdit?.(node.id, node.content);
              }}
              onContextMenu={(event) => {
                event.preventDefault();
                stopPan(event);
                onContextMenu?.(node.id, event);
              }}
              style={{ cursor: interactive ? "pointer" : "default" }}
            >
              <rect
                width={node.width}
                height={node.height}
                rx={settings.nodeRadius}
                ry={settings.nodeRadius}
                fill={fill}
                stroke={stroke}
                strokeWidth={isSelected ? 2.5 : 1.5}
              />
              {isEditing ? (
                <foreignObject
                  x={10}
                  y={8}
                  width={node.width - 20}
                  height={node.height - 16}
                  xmlns="http://www.w3.org/1999/xhtml"
                >
                  <div className="h-full w-full">
                    <textarea
                      value={editValue ?? node.content}
                      onChange={(event) => onEditValueChange?.(event.target.value)}
                      onBlur={() => onCommitEdit?.()}
                      onPointerDown={stopPan}
                      onKeyDown={(event) => {
                        event.stopPropagation();
                        if (event.key === "Enter" && !event.shiftKey) {
                          event.preventDefault();
                          onCommitEdit?.();
                        }
                        if (event.key === "Escape") {
                          event.preventDefault();
                          onCancelEdit?.();
                        }
                      }}
                      autoFocus
                      className="h-full w-full resize-none border-0 bg-transparent p-0 text-sm text-foreground outline-none"
                      style={{ fontSize: node.fontSize, fontWeight: node.fontWeight }}
                    />
                  </div>
                </foreignObject>
              ) : (
                <text
                  x={node.width / 2}
                  y={node.height / 2}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="hsl(var(--foreground))"
                  pointerEvents="none"
                  style={{ fontSize: node.fontSize, fontWeight: node.fontWeight }}
                >
                  {node.lines.map((line, index) => (
                    <tspan key={`${node.id}-${index}`} x={node.width / 2} dy={index === 0 ? 0 : 22}>
                      {line}
                    </tspan>
                  ))}
                </text>
              )}
              {interactive && hasChildren ? (
                <g
                  transform={`translate(${node.width - 4}, ${node.height / 2 - 10})`}
                  data-mindmap-toggle="true"
                  onPointerDown={stopPan}
                  onClick={(event) => {
                    stopPan(event);
                    onToggleCollapse?.(node.id);
                  }}
                  style={{ cursor: "pointer" }}
                  aria-label={isCollapsed ? "Expand branch" : "Collapse branch"}
                >
                  <rect x={0} y={0} width={20} height={20} rx={10} fill="hsl(var(--muted))" stroke="hsl(var(--border))" />
                  <text x={10} y={11} textAnchor="middle" fontSize={12} fontWeight={600} fill="hsl(var(--foreground))" pointerEvents="none">
                    {isCollapsed ? "+" : "−"}
                  </text>
                </g>
              ) : null}
            </g>
          );
        })}
      </g>
    </svg>
  );
}
