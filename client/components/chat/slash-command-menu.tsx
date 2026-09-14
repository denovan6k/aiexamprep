"use client";

import { createPortal } from "react-dom";
import { ArrowLeft, ChevronRight } from "lucide-react";

import type { SlashCommand, SlashMenuState } from "@/lib/slash-commands";
import { cn } from "@/lib/utils";

type SlashCommandMenuProps = {
  open: boolean;
  menuState: SlashMenuState | null;
  position: { top: number; left: number; placement: "above" | "below" } | null;
  selectedIndex: number;
  onSelect: (index: number) => void;
  onHover: (index: number) => void;
};

function SlashCommandRow({
  command,
  selected,
  showChevron,
  onClick,
  onMouseEnter
}: {
  command: SlashCommand;
  selected: boolean;
  showChevron?: boolean;
  onClick: () => void;
  onMouseEnter: () => void;
}) {
  const Icon = command.icon;

  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      className={cn(
        "flex w-full items-start gap-2.5 rounded-md px-2.5 py-2 text-left transition-colors",
        selected ? "bg-accent text-accent-foreground" : "hover:bg-muted/80"
      )}
    >
      {Icon ? (
        <span
          className={cn(
            "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md",
            selected ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
          )}
        >
          <Icon className="h-3.5 w-3.5" />
        </span>
      ) : null}
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium leading-tight">{command.label}</span>
        <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">
          {command.description}
        </span>
      </span>
      {showChevron ? (
        <ChevronRight className="mt-1.5 h-4 w-4 shrink-0 text-muted-foreground" />
      ) : null}
    </button>
  );
}

export function SlashCommandMenu({
  open,
  menuState,
  position,
  selectedIndex,
  onSelect,
  onHover
}: SlashCommandMenuProps) {
  if (!open || !menuState || !position || typeof document === "undefined") {
    return null;
  }

  const selectedItem = menuState.items[selectedIndex];
  const usage = selectedItem?.usage ?? menuState.usage;

  return createPortal(
    <div
      role="listbox"
      aria-label="Slash commands"
      className="fixed z-[100] w-[min(320px,calc(100vw-16px))] overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-lg"
      style={{
        top: position.top,
        left: position.left,
        transform:
          position.placement === "above" ? "translateY(calc(-100% - 6px))" : "translateY(0)"
      }}
    >
      <div className="border-b border-border/60 px-3 py-2">
        {menuState.parent ? (
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <ArrowLeft className="h-3 w-3" />
            <span>{menuState.parent.label}</span>
          </div>
        ) : (
          <p className="text-xs font-medium text-muted-foreground">Commands</p>
        )}
      </div>

      <div className="max-h-64 overflow-y-auto p-1.5">
        {menuState.items.map((command, index) => (
          <SlashCommandRow
            key={command.id}
            command={command}
            selected={index === selectedIndex}
            showChevron={Boolean(command.children?.length && !command.template)}
            onClick={() => onSelect(index)}
            onMouseEnter={() => onHover(index)}
          />
        ))}
      </div>

      {usage ? (
        <div className="border-t border-border/60 bg-muted/30 px-3 py-2">
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Usage
          </p>
          <p className="mt-0.5 font-mono text-xs text-foreground">{usage}</p>
        </div>
      ) : null}
    </div>,
    document.body
  );
}
