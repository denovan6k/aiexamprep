"use client";

import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ExpandIcon,
  PauseIcon,
  PlayIcon
} from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useId, useLayoutEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export type VisualizationFrame = {
  array?: number[];
  comparing?: number[];
  swapping?: number[];
  sorted_until?: number | null;
  message?: string;
  html?: string;
};

export type VisualizationPayload = {
  kind: "diagram" | "chart" | "simulation" | "step_demo" | string;
  title: string;
  engine: string;
  caption?: string | null;
  html?: string;
  frames?: VisualizationFrame[];
  initial?: number[];
  final?: number[];
};

type VisualizationWidgetProps = {
  visualization: VisualizationPayload;
  className?: string;
};

type ThemeTokens = {
  background: string;
  foreground: string;
  card: string;
  muted: string;
  mutedForeground: string;
  border: string;
  primary: string;
  destructive: string;
  scrollbarThumb: string;
  scrollbarThumbHover: string;
  isDark: boolean;
};

const PREVIEW_MAX_HEIGHT_MOBILE = 260;
const PREVIEW_MAX_HEIGHT_TABLET = 380;
const PREVIEW_MAX_HEIGHT_DESKTOP = 520;
const MODAL_MAX_HEIGHT = "min(78vh, 820px)";
const HEIGHT_MESSAGE_TYPE = "knorvex-viz-height";

function usePreviewMaxHeight() {
  const [maxHeight, setMaxHeight] = useState(PREVIEW_MAX_HEIGHT_MOBILE);

  useEffect(() => {
    const update = () => {
      const width = window.innerWidth;
      if (width >= 1024) {
        setMaxHeight(PREVIEW_MAX_HEIGHT_DESKTOP);
      } else if (width >= 768) {
        setMaxHeight(PREVIEW_MAX_HEIGHT_TABLET);
      } else {
        setMaxHeight(PREVIEW_MAX_HEIGHT_MOBILE);
      }
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return maxHeight;
}

/** SSR-safe defaults — never read window/document during initial render. */
const STABLE_DEFAULT_TOKENS: ThemeTokens = {
  background: "hsl(153 42% 96%)",
  foreground: "hsl(268 55% 22%)",
  card: "hsl(0 0% 100%)",
  muted: "hsl(153 30% 92%)",
  mutedForeground: "hsl(268 20% 40%)",
  border: "hsl(178 30% 88%)",
  primary: "hsl(268 48% 38%)",
  destructive: "hsl(0 72% 51%)",
  scrollbarThumb: "268 18% 72%",
  scrollbarThumbHover: "268 48% 38%",
  isDark: false
};

function readThemeTokens(): ThemeTokens {
  if (typeof window === "undefined") {
    return STABLE_DEFAULT_TOKENS;
  }

  const styles = getComputedStyle(document.documentElement);
  const raw = (name: string, fallback: string) => {
    const value = styles.getPropertyValue(name).trim();
    return value || fallback;
  };
  const hsl = (name: string, fallback: string) => {
    const value = styles.getPropertyValue(name).trim();
    return value ? `hsl(${value})` : fallback;
  };

  return {
    background: hsl("--background", STABLE_DEFAULT_TOKENS.background),
    foreground: hsl("--foreground", STABLE_DEFAULT_TOKENS.foreground),
    card: hsl("--card", STABLE_DEFAULT_TOKENS.card),
    muted: hsl("--muted", STABLE_DEFAULT_TOKENS.muted),
    mutedForeground: hsl("--muted-foreground", STABLE_DEFAULT_TOKENS.mutedForeground),
    border: hsl("--border", STABLE_DEFAULT_TOKENS.border),
    primary: hsl("--primary", STABLE_DEFAULT_TOKENS.primary),
    destructive: hsl("--destructive", STABLE_DEFAULT_TOKENS.destructive),
    scrollbarThumb: raw("--scrollbar-thumb", STABLE_DEFAULT_TOKENS.scrollbarThumb),
    scrollbarThumbHover: raw(
      "--scrollbar-thumb-hover",
      STABLE_DEFAULT_TOKENS.scrollbarThumbHover
    ),
    isDark: document.documentElement.classList.contains("dark")
  };
}

function buildThemeCss(tokens: ThemeTokens): string {
  const danger = tokens.isDark ? "#f87171" : "#dc2626";
  const success = tokens.isDark ? "#4ade80" : "#16a34a";
  const info = tokens.isDark ? "#93c5fd" : "#2563eb";
  return `
    :root {
      color-scheme: ${tokens.isDark ? "dark" : "light"};
      --kv-bg: ${tokens.background};
      --kv-fg: ${tokens.foreground};
      --kv-card: ${tokens.card};
      --kv-muted: ${tokens.muted};
      --kv-muted-fg: ${tokens.mutedForeground};
      --kv-border: ${tokens.border};
      --kv-primary: ${tokens.primary};
      --scrollbar-thumb: ${tokens.scrollbarThumb};
      --scrollbar-thumb-hover: ${tokens.scrollbarThumbHover};
    }
    html, body {
      margin: 0;
      padding: 0;
      background: var(--kv-bg);
      color: var(--kv-fg);
      font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif;
      scrollbar-width: thin;
      scrollbar-color: hsl(var(--scrollbar-thumb) / 0.85) transparent;
    }
    body { padding: 12px; box-sizing: border-box; }
    * {
      scrollbar-width: thin;
      scrollbar-color: hsl(var(--scrollbar-thumb) / 0.85) transparent;
    }
    *::-webkit-scrollbar {
      width: 6px;
      height: 6px;
    }
    *::-webkit-scrollbar-track {
      background: transparent;
    }
    *::-webkit-scrollbar-thumb {
      background-color: hsl(var(--scrollbar-thumb) / 0.85);
      border-radius: 9999px;
      border: 1.5px solid transparent;
      background-clip: content-box;
    }
    *::-webkit-scrollbar-thumb:hover {
      background-color: hsl(var(--scrollbar-thumb-hover) / 0.7);
    }
    *::-webkit-scrollbar-corner {
      background: transparent;
    }
    a { color: var(--kv-primary); }
    pre, code {
      background: color-mix(in srgb, var(--kv-muted) 85%, transparent);
      color: var(--kv-fg);
      border-radius: 8px;
      padding: 0.25rem 0.4rem;
    }
    .kv-danger { color: ${danger} !important; }
    .kv-success { color: ${success} !important; }
    .kv-info { color: ${info} !important; }
    .kv-card {
      background: var(--kv-card);
      border: 1px solid color-mix(in srgb, var(--kv-border) 80%, transparent);
      border-radius: 12px;
      padding: 12px;
      margin: 8px 0;
    }
    svg { color: var(--kv-fg); }
  `;
}

function wrapFreeformHtml(
  html: string,
  title: string,
  tokens: ThemeTokens,
  messageId: string
): string {
  const trimmed = html.trim();
  const safeTitle = title.replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const themeCss = buildThemeCss(tokens);

  const heightScript = `
    <script>
      (function () {
        var id = ${JSON.stringify(messageId)};
        function report() {
          var height = Math.max(
            document.documentElement.scrollHeight || 0,
            document.body ? document.body.scrollHeight : 0
          );
          parent.postMessage({ type: ${JSON.stringify(HEIGHT_MESSAGE_TYPE)}, id: id, height: height }, "*");
        }
        window.addEventListener("load", report);
        window.addEventListener("resize", report);
        if (typeof ResizeObserver !== "undefined") {
          new ResizeObserver(report).observe(document.documentElement);
          if (document.body) new ResizeObserver(report).observe(document.body);
        }
        setTimeout(report, 50);
        setTimeout(report, 250);
      })();
    </script>
  `;

  const themedBody = `${trimmed}${heightScript}`;

  if (/^<!DOCTYPE/i.test(trimmed) || /<html[\s>]/i.test(trimmed)) {
    if (/<\/head>/i.test(trimmed)) {
      return trimmed
        .replace(/<\/head>/i, `<style id="knorvex-viz-theme">${themeCss}</style></head>`)
        .replace(/<\/body>/i, `${heightScript}</body>`);
    }
    return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/><title>${safeTitle}</title><style>${themeCss}</style></head><body>${themedBody}</body></html>`;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${safeTitle}</title>
  <style>${themeCss}</style>
</head>
<body>${themedBody}</body>
</html>`;
}

function framesAreArrayBars(frames: VisualizationFrame[]): boolean {
  return frames.some((frame) => Array.isArray(frame.array) && frame.array.length > 0);
}

function framesAreHtmlSteps(frames: VisualizationFrame[]): boolean {
  return frames.some((frame) => typeof frame.html === "string" && frame.html.trim().length > 0);
}

function StepDemoBars({ frame }: { frame: VisualizationFrame }) {
  const values = frame.array ?? [];
  const comparing = new Set(frame.comparing ?? []);
  const swapping = new Set(frame.swapping ?? []);
  const sortedUntil = typeof frame.sorted_until === "number" ? frame.sorted_until : null;
  const max = Math.max(1, ...values.map((value) => Math.abs(value)));

  return (
    <div className="space-y-3">
      <div className="flex h-40 items-end gap-2">
        {values.map((value, index) => {
          const height = Math.max(8, Math.round((Math.abs(value) / max) * 140));
          const isSwapping = swapping.has(index);
          const isComparing = comparing.has(index);
          const isSorted = sortedUntil !== null && index >= sortedUntil;
          return (
            <div key={`${index}-${value}`} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
              <div
                className={cn(
                  "w-full max-w-12 rounded-t-lg transition-all duration-150",
                  isSwapping
                    ? "bg-primary"
                    : isComparing
                      ? "bg-amber-500 dark:bg-amber-400"
                      : isSorted
                        ? "bg-emerald-500 dark:bg-emerald-400"
                        : "bg-muted-foreground/45"
                )}
                style={{ height }}
              />
              <span className="text-xs text-muted-foreground">{value}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function VisualizationHeader({ visualization }: { visualization: VisualizationPayload }) {
  return (
    <div className="border-b border-border/60 bg-muted/30 px-4 py-3">
      <p className="text-sm font-semibold text-foreground">{visualization.title}</p>
      {visualization.caption ? (
        <p className="mt-0.5 text-xs text-muted-foreground">{visualization.caption}</p>
      ) : null}
    </div>
  );
}

function StepControls({
  step,
  frameCount,
  stepMessage,
  playing,
  onPrev,
  onNext,
  onTogglePlay
}: {
  step: number;
  frameCount: number;
  stepMessage?: string | null;
  playing: boolean;
  onPrev: () => void;
  onNext: () => void;
  onTogglePlay: () => void;
}) {
  const guideText = stepMessage?.trim() || null;

  return (
    <div className="space-y-2 border-t border-border/60 px-4 py-3">
      {guideText ? (
        <p className="text-sm leading-snug text-foreground" aria-live="polite">
          {guideText}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" variant="outline" className="h-8 gap-1" onClick={onPrev} disabled={step <= 0}>
          <ChevronLeftIcon className="size-3.5" />
          Prev
        </Button>
        <Button type="button" size="sm" variant="outline" className="h-8 gap-1" onClick={onTogglePlay}>
          {playing ? (
            <>
              <PauseIcon className="size-3.5" />
              Pause
            </>
          ) : (
            <>
              <PlayIcon className="size-3.5" />
              Play
            </>
          )}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 gap-1"
          onClick={onNext}
          disabled={step >= frameCount - 1}
        >
          Next
          <ChevronRightIcon className="size-3.5" />
        </Button>
        <span className="ml-auto text-xs text-muted-foreground">
          Step {step + 1} / {frameCount}
        </span>
      </div>
    </div>
  );
}

export function VisualizationWidget({ visualization, className }: VisualizationWidgetProps) {
  const reactId = useId();
  const messageId = `viz-${reactId.replace(/:/g, "")}`;
  const { resolvedTheme } = useTheme();
  const previewMaxHeight = usePreviewMaxHeight();
  const frames = visualization.frames ?? [];
  const hasFrames = frames.length > 0;
  const isBarDemo = hasFrames && framesAreArrayBars(frames);
  const isHtmlDemo = hasFrames && framesAreHtmlSteps(frames);
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [expanded, setExpanded] = useState(false);
  // SSR uses light defaults; sync from the live document before paint so the
  // first iframe isn't stuck on light while the app is dark.
  const [tokens, setTokens] = useState<ThemeTokens>(STABLE_DEFAULT_TOKENS);
  const [themeSynced, setThemeSynced] = useState(false);
  const [contentHeight, setContentHeight] = useState(180);

  useLayoutEffect(() => {
    setTokens(readThemeTokens());
    setThemeSynced(true);
  }, [resolvedTheme]);

  const themeKey = tokens.isDark ? "dark" : "light";
  const currentFrame = frames[Math.min(step, Math.max(0, frames.length - 1))];
  const stepHtml = isHtmlDemo ? currentFrame?.html ?? "" : "";

  const freeformSrcDoc = useMemo(() => {
    if (!themeSynced || hasFrames || !visualization.html) return null;
    return wrapFreeformHtml(visualization.html, visualization.title, tokens, messageId);
  }, [themeSynced, hasFrames, visualization.html, visualization.title, tokens, messageId]);

  const stepSrcDoc = useMemo(() => {
    if (!themeSynced || !isHtmlDemo || !stepHtml.trim()) return null;
    return wrapFreeformHtml(stepHtml, visualization.title, tokens, `${messageId}-step`);
  }, [themeSynced, isHtmlDemo, stepHtml, visualization.title, tokens, messageId]);

  const modalSrcDoc = useMemo(() => {
    if (!themeSynced || hasFrames || !visualization.html) return null;
    return wrapFreeformHtml(visualization.html, visualization.title, tokens, `${messageId}-modal`);
  }, [themeSynced, hasFrames, visualization.html, visualization.title, tokens, messageId]);

  useEffect(() => {
    setStep(0);
    setPlaying(false);
    setContentHeight(180);
  }, [visualization.title, visualization.engine, frames.length]);

  useEffect(() => {
    if (!playing || !hasFrames) return;
    const id = window.setInterval(() => {
      setStep((current) => {
        if (current >= frames.length - 1) {
          setPlaying(false);
          return current;
        }
        return current + 1;
      });
    }, 700);
    return () => window.clearInterval(id);
  }, [playing, hasFrames, frames.length]);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      const data = event.data;
      if (!data || typeof data !== "object") return;
      if (data.type !== HEIGHT_MESSAGE_TYPE) return;
      if (data.id !== messageId && data.id !== `${messageId}-step`) return;
      const height = Number(data.height);
      if (!Number.isFinite(height) || height <= 0) return;
      setContentHeight(Math.ceil(height));
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [messageId]);

  const previewHeight = Math.min(previewMaxHeight, Math.max(140, contentHeight));
  const isClipped =
    (Boolean(freeformSrcDoc) || Boolean(stepSrcDoc)) && contentHeight > previewMaxHeight + 8;
  const showStepControls = isBarDemo || isHtmlDemo;
  const modalFrameHeight = Math.max(previewHeight, Math.min(contentHeight, Math.round(previewMaxHeight * 1.35)));

  if (!hasFrames && !visualization.html) {
    return null;
  }

  const iframePlaceholder = (
    <div
      className="w-full rounded-xl border border-border/50 bg-background"
      style={{ height: previewHeight }}
      aria-hidden
    />
  );

  const stepControls = showStepControls ? (
    <StepControls
      step={step}
      frameCount={frames.length}
      stepMessage={currentFrame?.message}
      playing={playing}
      onPrev={() => {
        setPlaying(false);
        setStep((current) => Math.max(0, current - 1));
      }}
      onNext={() => {
        setPlaying(false);
        setStep((current) => Math.min(frames.length - 1, current + 1));
      }}
      onTogglePlay={() => setPlaying((value) => !value)}
    />
  ) : null;

  const expandOverlay = isClipped ? (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 flex h-16 items-end justify-center bg-gradient-to-t from-card via-card/80 to-transparent pb-2">
      <Button
        type="button"
        size="sm"
        variant="secondary"
        className="pointer-events-auto h-8 gap-1.5 rounded-full shadow-sm"
        onClick={() => setExpanded(true)}
      >
        <ExpandIcon className="size-3.5" />
        View full diagram
      </Button>
    </div>
  ) : null;

  return (
    <>
      <div
        className={cn(
          "mt-4 overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm",
          className
        )}
      >
        <VisualizationHeader visualization={visualization} />

        <div className="bg-card p-3 sm:p-4">
          {isBarDemo && currentFrame ? (
            <StepDemoBars frame={currentFrame} />
          ) : isHtmlDemo ? (
            <div className="relative overflow-hidden rounded-xl">
              {!expanded && stepSrcDoc ? (
                <iframe
                  key={`${messageId}-step-${step}-${themeKey}`}
                  title={`${visualization.title} step ${step + 1}`}
                  sandbox="allow-scripts"
                  srcDoc={stepSrcDoc}
                  className="w-full rounded-xl border border-border/50 bg-background"
                  style={{ height: previewHeight, backgroundColor: tokens.background }}
                />
              ) : expanded ? (
                <div
                  className="w-full rounded-xl border border-border/50 bg-muted/20"
                  style={{ height: previewHeight }}
                />
              ) : (
                iframePlaceholder
              )}
              {expandOverlay}
            </div>
          ) : (
            <div className="relative overflow-hidden rounded-xl">
              {!expanded && freeformSrcDoc ? (
                <iframe
                  key={`${messageId}-freeform-${themeKey}`}
                  title={visualization.title}
                  sandbox="allow-scripts"
                  srcDoc={freeformSrcDoc}
                  className="w-full rounded-xl border border-border/50 bg-background"
                  style={{ height: previewHeight, backgroundColor: tokens.background }}
                />
              ) : expanded ? (
                <div
                  className="w-full rounded-xl border border-border/50 bg-muted/20"
                  style={{ height: previewHeight }}
                />
              ) : (
                iframePlaceholder
              )}
              {expandOverlay}
            </div>
          )}
        </div>

        {stepControls}
      </div>

      <Dialog open={expanded} onOpenChange={setExpanded}>
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-hidden p-0 sm:rounded-2xl">
          <DialogHeader className="border-b border-border/60 bg-muted/30 px-5 py-4 pr-12">
            <DialogTitle>{visualization.title}</DialogTitle>
            {visualization.caption ? (
              <DialogDescription>{visualization.caption}</DialogDescription>
            ) : (
              <DialogDescription className="sr-only">{visualization.title}</DialogDescription>
            )}
          </DialogHeader>
          <div
            className="app-scrollbar overflow-auto bg-card p-4"
            style={{ maxHeight: MODAL_MAX_HEIGHT }}
          >
            {isBarDemo && currentFrame ? (
              <div className="space-y-4">
                <StepDemoBars frame={currentFrame} />
                {stepControls}
              </div>
            ) : isHtmlDemo && stepSrcDoc ? (
              <div className="space-y-4">
                <iframe
                  key={`${messageId}-modal-step-${step}-${themeKey}`}
                  title={`${visualization.title} step ${step + 1}`}
                  sandbox="allow-scripts"
                  srcDoc={stepSrcDoc}
                  className="min-h-[240px] w-full rounded-xl border border-border/50 bg-background"
                  style={{
                    height: modalFrameHeight,
                    backgroundColor: tokens.background
                  }}
                />
                {stepControls}
              </div>
            ) : modalSrcDoc ? (
              <iframe
                key={`${messageId}-modal-freeform-${themeKey}`}
                title={`${visualization.title} full`}
                sandbox="allow-scripts"
                srcDoc={modalSrcDoc}
                className="min-h-[240px] w-full rounded-xl border border-border/50 bg-background"
                style={{
                  height: modalFrameHeight,
                  backgroundColor: tokens.background
                }}
              />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
