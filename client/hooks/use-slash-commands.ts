"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  resolveSlashMenu,
  type SlashCommand,
  type SlashMenuState
} from "@/lib/slash-commands";
import {
  getActiveSlashMatch,
  getCaretCoordinates,
  replaceSlashToken,
  type SlashMatch
} from "@/lib/slash-command-utils";

type UseSlashCommandsOptions = {
  text: string;
  onTextChange: (text: string) => void;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  disabled?: boolean;
};

type SlashMenuPosition = {
  top: number;
  left: number;
  placement: "above" | "below";
};

export function useSlashCommands({
  text,
  onTextChange,
  textareaRef,
  disabled
}: UseSlashCommandsOptions) {
  const [cursor, setCursor] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [menuPosition, setMenuPosition] = useState<SlashMenuPosition | null>(null);

  const match = useMemo(() => {
    if (disabled) return null;
    return getActiveSlashMatch(text, cursor);
  }, [text, cursor, disabled]);

  const menuState: SlashMenuState | null = useMemo(() => {
    if (!match) return null;
    return resolveSlashMenu(match.query);
  }, [match]);

  const isOpen = Boolean(match && menuState && menuState.items.length > 0);

  const updateMenuPosition = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea || !match) {
      setMenuPosition(null);
      return;
    }

    const coords = getCaretCoordinates(textarea, match.start);
    const menuWidth = 320;
    const menuHeight = 280;
    const padding = 8;
    const left = Math.min(
      Math.max(padding, coords.left),
      window.innerWidth - menuWidth - padding
    );
    const spaceAbove = coords.top - padding;
    const placement = spaceAbove >= menuHeight ? "above" : "below";
    const top = placement === "above" ? coords.top - 8 : coords.top + 20;

    setMenuPosition({ top, left, placement });
  }, [match, textareaRef]);

  useEffect(() => {
    if (!isOpen) {
      setMenuPosition(null);
      return;
    }
    setSelectedIndex(0);
    updateMenuPosition();
  }, [isOpen, match?.query, menuState?.items.length, updateMenuPosition]);

  useEffect(() => {
    if (!isOpen) return;

    const handleReposition = () => updateMenuPosition();
    window.addEventListener("resize", handleReposition);
    window.addEventListener("scroll", handleReposition, true);

    return () => {
      window.removeEventListener("resize", handleReposition);
      window.removeEventListener("scroll", handleReposition, true);
    };
  }, [isOpen, updateMenuPosition]);

  const closeMenu = useCallback(() => {
    setMenuPosition(null);
  }, []);

  const applyTemplate = useCallback(
    (command: SlashCommand, activeMatch: SlashMatch) => {
      if (command.children?.length && !command.template) {
        const prefix = `/${command.id} `;
        const { text: nextText, cursor: nextCursor } = replaceSlashToken(
          text,
          activeMatch,
          prefix,
          0
        );
        onTextChange(nextText);
        requestAnimationFrame(() => {
          const textarea = textareaRef.current;
          if (!textarea) return;
          textarea.focus();
          textarea.setSelectionRange(nextCursor, nextCursor);
          setCursor(nextCursor);
        });
        return;
      }

      if (!command.template) return;

      const { text: nextText, cursor: nextCursor } = replaceSlashToken(
        text,
        activeMatch,
        command.template,
        command.cursorOffset ?? 0
      );
      onTextChange(nextText);
      closeMenu();
      requestAnimationFrame(() => {
        const textarea = textareaRef.current;
        if (!textarea) return;
        textarea.focus();
        textarea.setSelectionRange(nextCursor, nextCursor);
        setCursor(nextCursor);
      });
    },
    [closeMenu, onTextChange, text, textareaRef]
  );

  const selectItem = useCallback(
    (index: number) => {
      if (!match || !menuState) return;
      const item = menuState.items[index];
      if (!item) return;
      applyTemplate(item, match);
    },
    [applyTemplate, match, menuState]
  );

  const handleCursorChange = useCallback((position: number) => {
    setCursor(position);
  }, []);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (!isOpen || !menuState) return false;

      const itemCount = menuState.items.length;

      if (event.key === "ArrowDown") {
        event.preventDefault();
        setSelectedIndex((index) => (index + 1) % itemCount);
        return true;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        setSelectedIndex((index) => (index - 1 + itemCount) % itemCount);
        return true;
      }

      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        selectItem(selectedIndex);
        return true;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        closeMenu();
        return true;
      }

      if (event.key === "Tab") {
        event.preventDefault();
        selectItem(selectedIndex);
        return true;
      }

      return false;
    },
    [closeMenu, isOpen, menuState, selectItem, selectedIndex]
  );

  return {
    isOpen,
    match,
    menuState,
    selectedIndex,
    setSelectedIndex,
    menuPosition,
    handleCursorChange,
    handleKeyDown,
    selectItem,
    closeMenu
  };
}
