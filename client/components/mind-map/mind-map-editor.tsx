"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Download,
  HelpCircle,
  Maximize2,
  Pencil,
  Plus,
  Redo2,
  Trash2,
  Undo2,
  ZoomIn,
  ZoomOut
} from "lucide-react";
import svgPanZoom from "svg-pan-zoom";

import { MindMapCanvas } from "@/components/mind-map/mind-map-canvas";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  addChild,
  deleteNode,
  findNode,
  syncDocumentRoot,
  updateNode
} from "@/lib/mind-map/tree-ops";
import type { MindMapDocument } from "@/lib/mind-map/types";
import { cn } from "@/lib/utils";

type MindMapEditorProps = {
  document: MindMapDocument;
  onChange: (document: MindMapDocument) => void;
  className?: string;
  readOnly?: boolean;
};

export function MindMapEditor({
  document,
  onChange,
  className,
  readOnly = false
}: MindMapEditorProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const svgHostRef = useRef<HTMLDivElement>(null);
  const panZoomRef = useRef<ReturnType<typeof svgPanZoom> | null>(null);
  const historyIndexRef = useRef(0);

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [history, setHistory] = useState<MindMapDocument[]>([document]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [contextMenu, setContextMenu] = useState<{ nodeId: string; x: number; y: number } | null>(null);

  const currentDocument = history[historyIndex] ?? document;

  const pushHistory = useCallback(
    (next: MindMapDocument) => {
      setHistory((prev) => {
        const trimmed = prev.slice(0, historyIndexRef.current + 1);
        const nextHistory = [...trimmed, next];
        historyIndexRef.current = nextHistory.length - 1;
        setHistoryIndex(historyIndexRef.current);
        return nextHistory;
      });
      onChange(next);
    },
    [onChange]
  );

  const applyRoot = useCallback(
    (updater: (root: MindMapDocument["root"]) => MindMapDocument["root"] | null) => {
      const nextRoot = updater(currentDocument.root);
      if (!nextRoot) return;
      pushHistory(syncDocumentRoot(currentDocument, nextRoot));
    },
    [currentDocument, pushHistory]
  );

  const toggleCollapse = useCallback(
    (nodeId: string) => {
      applyRoot((root) =>
        updateNode(root, nodeId, (node) => ({
          ...node,
          collapsed: !node.collapsed
        }))
      );
    },
    [applyRoot]
  );

  const beginEdit = useCallback(
    (nodeId: string, content: string) => {
      if (readOnly) return;
      setEditingNodeId(nodeId);
      setEditValue(content);
      setSelectedNodeId(nodeId);
    },
    [readOnly]
  );

  const commitEdit = useCallback(() => {
    if (!editingNodeId) return;
    const value = editValue.trim() || "Untitled";
    applyRoot((root) =>
      updateNode(root, editingNodeId, (node) => ({
        ...node,
        content: value
      }))
    );
    setEditingNodeId(null);
    setEditValue("");
  }, [applyRoot, editValue, editingNodeId]);

  const cancelEdit = useCallback(() => {
    setEditingNodeId(null);
    setEditValue("");
  }, []);

  useEffect(() => {
    if (!svgHostRef.current) return;
    const svg = svgHostRef.current.querySelector("svg");
    if (!svg) return;

    panZoomRef.current?.destroy();
    panZoomRef.current = svgPanZoom(svg, {
      zoomEnabled: true,
      panEnabled: true,
      controlIconsEnabled: false,
      fit: true,
      center: true,
      minZoom: 0.2,
      maxZoom: 5,
      dblClickZoomEnabled: false,
      mouseWheelZoomEnabled: true,
      preventMouseEventsDefault: false
    });

    return () => {
      panZoomRef.current?.destroy();
      panZoomRef.current = null;
    };
  }, [currentDocument.root, currentDocument.settings]);

  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    const timer = window.setTimeout(() => {
      window.addEventListener("pointerdown", close);
    }, 0);
    window.addEventListener("scroll", close, true);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [contextMenu]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (readOnly || editingNodeId) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, [contenteditable='true']")) return;

      if (event.key === "f" || event.key === "F") {
        event.preventDefault();
        panZoomRef.current?.fit();
        panZoomRef.current?.center();
      }
      if ((event.key === "e" || event.key === "E") && selectedNodeId) {
        event.preventDefault();
        const node = findNode(currentDocument.root, selectedNodeId);
        if (node) beginEdit(node.id, node.content);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [beginEdit, currentDocument.root, editingNodeId, readOnly, selectedNodeId]);

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  const handleUndo = () => {
    if (!canUndo) return;
    const nextIndex = historyIndex - 1;
    historyIndexRef.current = nextIndex;
    setHistoryIndex(nextIndex);
    onChange(history[nextIndex]!);
  };

  const handleRedo = () => {
    if (!canRedo) return;
    const nextIndex = historyIndex + 1;
    historyIndexRef.current = nextIndex;
    setHistoryIndex(nextIndex);
    onChange(history[nextIndex]!);
  };

  const exportSvg = () => {
    const svg = svgHostRef.current?.querySelector("svg");
    if (!svg) return;
    const blob = new Blob([svg.outerHTML], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = window.document.createElement("a");
    anchor.href = url;
    anchor.download = `${currentDocument.title || "mind-map"}.svg`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const selectedNode = selectedNodeId ? findNode(currentDocument.root, selectedNodeId) : null;
  const contextNode = contextMenu?.nodeId ? findNode(currentDocument.root, contextMenu.nodeId) : null;

  const editorTooltip = selectedNode
    ? `${selectedNode.content} · Double-click to edit · Right-click for menu · F fit · E edit`
    : "Select a node · Double-click to edit · Right-click for menu · F fit · E edit";

  return (
    <div className={cn("flex h-full min-h-[420px] flex-col overflow-hidden rounded-xl border border-border/70 bg-card", className)}>
      <div className="flex flex-wrap items-center gap-2 border-b border-border/60 px-3 py-2">
        <Button type="button" size="sm" variant="outline" onClick={() => panZoomRef.current?.zoomIn()} aria-label="Zoom in">
          <ZoomIn className="size-4" />
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => panZoomRef.current?.zoomOut()} aria-label="Zoom out">
          <ZoomOut className="size-4" />
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => {
            panZoomRef.current?.fit();
            panZoomRef.current?.center();
          }}
          aria-label="Fit to screen"
        >
          <Maximize2 className="size-4" />
        </Button>
        {!readOnly ? (
          <>
            <Button type="button" size="sm" variant="outline" onClick={handleUndo} disabled={!canUndo} aria-label="Undo">
              <Undo2 className="size-4" />
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={handleRedo} disabled={!canRedo} aria-label="Redo">
              <Redo2 className="size-4" />
            </Button>
            <div className="mx-1 hidden h-6 w-px bg-border sm:block" />
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={!selectedNode}
              onClick={() => selectedNode && beginEdit(selectedNode.id, selectedNode.content)}
            >
              <Pencil className="mr-1.5 size-3.5" />
              Edit
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={!selectedNode}
              onClick={() => selectedNode && applyRoot((root) => addChild(root, selectedNode.id))}
            >
              <Plus className="mr-1.5 size-3.5" />
              Add branch
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={!selectedNode || !(selectedNode.children.length > 0)}
              onClick={() => selectedNode && toggleCollapse(selectedNode.id)}
            >
              {selectedNode?.collapsed ? (
                <ChevronRight className="mr-1.5 size-3.5" />
              ) : (
                <ChevronDown className="mr-1.5 size-3.5" />
              )}
              {selectedNode?.collapsed ? "Expand" : "Collapse"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={!selectedNode || selectedNode.id === currentDocument.root.id}
              onClick={() => {
                if (!selectedNode || selectedNode.id === currentDocument.root.id) return;
                applyRoot((root) => deleteNode(root, selectedNode.id) ?? root);
                setSelectedNodeId(null);
              }}
            >
              <Trash2 className="mr-1.5 size-3.5" />
              Delete
            </Button>
          </>
        ) : null}
        <Button type="button" size="sm" variant="outline" onClick={exportSvg} aria-label="Export SVG">
          <Download className="size-4" />
        </Button>
        {!readOnly ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button type="button" size="sm" variant="ghost" className="ml-auto text-muted-foreground" aria-label="Editor help">
                <HelpCircle className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-sm text-xs leading-relaxed">
              {editorTooltip}
            </TooltipContent>
          </Tooltip>
        ) : null}
      </div>

      <div ref={viewportRef} className="relative min-h-0 flex-1 bg-muted/20">
        <div ref={svgHostRef} className="h-full w-full touch-none">
          <MindMapCanvas
            root={currentDocument.root}
            settings={currentDocument.settings}
            interactive={!readOnly}
            selectedNodeId={selectedNodeId}
            editingNodeId={editingNodeId}
            editValue={editValue}
            onSelectNode={setSelectedNodeId}
            onBeginEdit={beginEdit}
            onEditValueChange={setEditValue}
            onCommitEdit={commitEdit}
            onCancelEdit={cancelEdit}
            onToggleCollapse={toggleCollapse}
            onContextMenu={(nodeId, event) => {
              if (readOnly) return;
              setSelectedNodeId(nodeId);
              setContextMenu({ nodeId, x: event.clientX, y: event.clientY });
            }}
          />
        </div>

        {!readOnly && contextMenu ? (
          <div
            className="fixed z-50 min-w-[190px] rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md"
            style={{ left: contextMenu.x, top: contextMenu.y }}
            onPointerDown={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="flex w-full rounded-sm px-2 py-1.5 text-left text-sm hover:bg-muted"
              onClick={() => {
                const node = findNode(currentDocument.root, contextMenu.nodeId);
                if (node) beginEdit(node.id, node.content);
                setContextMenu(null);
              }}
            >
              Edit text
            </button>
            <button
              type="button"
              className="flex w-full rounded-sm px-2 py-1.5 text-left text-sm hover:bg-muted"
              onClick={() => {
                applyRoot((root) => addChild(root, contextMenu.nodeId));
                setContextMenu(null);
              }}
            >
              Add child branch
            </button>
            <button
              type="button"
              className="flex w-full rounded-sm px-2 py-1.5 text-left text-sm hover:bg-muted"
              onClick={() => {
                toggleCollapse(contextMenu.nodeId);
                setContextMenu(null);
              }}
            >
              {contextNode?.collapsed ? "Expand children" : "Collapse children"}
            </button>
            {contextMenu.nodeId !== currentDocument.root.id ? (
              <button
                type="button"
                className="mt-1 flex w-full rounded-sm px-2 py-1.5 text-left text-sm text-destructive hover:bg-muted"
                onClick={() => {
                  applyRoot((root) => deleteNode(root, contextMenu.nodeId) ?? root);
                  setContextMenu(null);
                  setSelectedNodeId(null);
                }}
              >
                Delete branch
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
