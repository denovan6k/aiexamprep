"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";
import { Component, type ErrorInfo, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { getFriendlyError } from "@/lib/error-handler";
import { cn } from "@/lib/utils";

type ErrorBoundaryProps = {
  children: ReactNode;
  className?: string;
  resetKeys?: readonly unknown[];
  title?: string;
  description?: string;
  onError?: (error: Error, info: ErrorInfo) => void;
};

type ErrorBoundaryState = {
  error: Error | null;
};

function resetKeysChanged(previous: readonly unknown[] = [], next: readonly unknown[] = []) {
  if (previous.length !== next.length) return true;
  return previous.some((value, index) => !Object.is(value, next[index]));
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.props.onError?.(error, info);
    console.error("Dashboard view crashed", error, info);
  }

  componentDidUpdate(previousProps: ErrorBoundaryProps) {
    if (this.state.error && resetKeysChanged(previousProps.resetKeys, this.props.resetKeys)) {
      this.reset();
    }
  }

  reset = () => {
    this.setState({ error: null });
  };

  render() {
    if (!this.state.error) {
      return this.props.children;
    }

    const friendly = getFriendlyError(this.state.error, {
      title: this.props.title ?? "Workspace view crashed",
      message:
        this.props.description ??
        "This part of the dashboard hit a problem. Try again, or refresh the page if it keeps happening."
    });

    return (
      <div className={cn("flex min-h-[20rem] flex-1 items-center justify-center p-6", this.props.className)}>
        <div className="w-full max-w-lg rounded-lg border border-border bg-background p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-md bg-destructive/10 p-2 text-destructive">
              <AlertTriangle className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-semibold text-foreground">{friendly.title}</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{friendly.message}</p>
              {friendly.requestId ? <p className="mt-2 text-xs text-muted-foreground">Request ID: {friendly.requestId}</p> : null}
              <div className="mt-4 flex flex-wrap gap-2">
                <Button type="button" size="sm" onClick={this.reset}>
                  <RefreshCw className="h-4 w-4" aria-hidden="true" />
                  Try again
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => window.location.reload()}>
                  Refresh page
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
}
