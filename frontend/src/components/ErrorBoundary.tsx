"use client";

/**
 * Error Boundary
 *
 * Catches React render errors and shows a fallback UI instead of crashing
 * the entire application. Wrap around major feature sections.
 *
 * Usage:
 *   <ErrorBoundary fallback="Failed to load threats">
 *     <ThreatPanel />
 *   </ErrorBoundary>
 */

import { Component, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
  /** Custom fallback message */
  fallback?: string;
  /** Optional: specific section name for error reporting */
  section?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(
      `[ErrorBoundary${this.props.section ? `: ${this.props.section}` : ""}]`,
      error,
      info.componentStack,
    );
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center gap-3 p-6 rounded-lg border border-destructive/20 bg-destructive/5">
          <AlertTriangle className="h-8 w-8 text-destructive" />
          <div className="text-center">
            <p className="text-sm font-medium text-destructive">
              {this.props.fallback || "Something went wrong"}
            </p>
            {this.state.error && (
              <p className="text-xs text-muted-foreground mt-1 max-w-md">
                {this.state.error.message}
              </p>
            )}
          </div>
          <button
            onClick={this.handleReset}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <RefreshCw className="h-3 w-3" />
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
