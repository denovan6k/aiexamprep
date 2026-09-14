export type SlashMatch = {
  start: number;
  end: number;
  query: string;
};

const SLASH_TRIGGER_PATTERN = /(?:^|\s)\/([\w-]*)\s*$/;

export function getActiveSlashMatch(text: string, cursor: number): SlashMatch | null {
  const before = text.slice(0, cursor);
  const match = before.match(SLASH_TRIGGER_PATTERN);
  if (!match || match.index === undefined) {
    return null;
  }

  const slashIndex = match[0].startsWith("/") ? match.index : match.index + 1;

  return {
    start: slashIndex,
    end: cursor,
    query: match[1] ?? ""
  };
}

export function replaceSlashToken(
  text: string,
  match: SlashMatch,
  replacement: string,
  cursorOffsetFromEnd = 0
): { text: string; cursor: number } {
  const newText = text.slice(0, match.start) + replacement + text.slice(match.end);
  const cursor = Math.max(match.start, match.start + replacement.length - cursorOffsetFromEnd);
  return { text: newText, cursor };
}

const CARET_MIRROR_PROPS = [
  "direction",
  "boxSizing",
  "width",
  "height",
  "overflowX",
  "overflowY",
  "borderTopWidth",
  "borderRightWidth",
  "borderBottomWidth",
  "borderLeftWidth",
  "borderStyle",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "fontStyle",
  "fontVariant",
  "fontWeight",
  "fontStretch",
  "fontSize",
  "fontSizeAdjust",
  "lineHeight",
  "fontFamily",
  "textAlign",
  "textTransform",
  "textIndent",
  "textDecoration",
  "letterSpacing",
  "wordSpacing",
  "tabSize"
] as const;

export function getCaretCoordinates(
  textarea: HTMLTextAreaElement,
  position: number
): { top: number; left: number } {
  const mirror = document.createElement("div");
  const computed = window.getComputedStyle(textarea);

  CARET_MIRROR_PROPS.forEach((prop) => {
    mirror.style.setProperty(prop, computed.getPropertyValue(prop));
  });

  mirror.style.position = "absolute";
  mirror.style.visibility = "hidden";
  mirror.style.whiteSpace = "pre-wrap";
  mirror.style.wordWrap = "break-word";
  mirror.style.overflow = "hidden";
  mirror.style.width = `${textarea.offsetWidth}px`;

  const textBefore = textarea.value.substring(0, position);
  mirror.textContent = textBefore;

  const marker = document.createElement("span");
  marker.textContent = textarea.value.substring(position) || ".";
  mirror.appendChild(marker);

  document.body.appendChild(mirror);

  const textareaRect = textarea.getBoundingClientRect();
  const markerRect = marker.getBoundingClientRect();
  const mirrorRect = mirror.getBoundingClientRect();

  document.body.removeChild(mirror);

  return {
    top: markerRect.top - mirrorRect.top - textarea.scrollTop + textareaRect.top,
    left: markerRect.left - mirrorRect.left - textarea.scrollLeft + textareaRect.left
  };
}
