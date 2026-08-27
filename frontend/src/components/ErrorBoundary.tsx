import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/** Catches render-time errors anywhere below it so one bad component can't
 * white-screen the whole app — without this, React unmounts the entire tree
 * on any uncaught render error. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Unhandled render error:", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex h-dvh flex-col items-center justify-center gap-3 bg-background px-4 text-center text-foreground">
          <p className="text-lg font-semibold">Something went wrong.</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            This part of Lecturn hit an unexpected error. Reloading usually fixes it.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
