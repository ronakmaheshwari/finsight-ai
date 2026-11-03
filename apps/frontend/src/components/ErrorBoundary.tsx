import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";

import { Button } from "@repo/ui/button";

interface State {
  error: Error | null;
}

/**
 * Top-level guard (§11.10): a render error must not leave a blank page.
 * The message is generic on purpose — stack traces never reach the browser.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, _info: ErrorInfo): void {
    // The browser console is the only sink available in the client build.
    console.error("Unhandled render error", error);
  }

  render(): ReactNode {
    if (!this.state.error) return this.props.children;

    return (
      <div className="flex min-h-svh items-center justify-center px-4">
        <div role="alert" className="w-full max-w-md space-y-3 rounded-lg border bg-card p-6 text-center">
          <AlertTriangle className="mx-auto size-8 text-destructive" aria-hidden />
          <h1 className="text-lg font-semibold">Something went wrong</h1>
          <p className="text-sm text-muted-foreground">
            This page could not be rendered. Reload to try again; if it keeps happening, contact an administrator.
          </p>
          <Button onClick={() => window.location.reload()}>Reload</Button>
        </div>
      </div>
    );
  }
}
