export interface Toast {
  id: number;
  variant: "error" | "success";
  message: string;
}

type Listener = (toasts: Toast[]) => void;

let toasts: Toast[] = [];
let nextId = 1;
const listeners = new Set<Listener>();

function emit() {
  for (const listener of listeners) listener(toasts);
}

function push(variant: Toast["variant"], message: string) {
  const id = nextId++;
  toasts = [...toasts, { id, variant, message }];
  emit();
  setTimeout(() => dismiss(id), 5000);
  return id;
}

function dismiss(id: number) {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

export function subscribeToasts(listener: Listener): () => void {
  listeners.add(listener);
  listener(toasts);
  return () => listeners.delete(listener);
}

export const toast = {
  error: (message: string) => push("error", message),
  success: (message: string) => push("success", message),
  dismiss,
};

/** A consistent message for any failed API call — used by the query/mutation
 * defaults so a network outage (fetch throws a plain TypeError) reads
 * differently from a real API error (which already carries a server
 * message), instead of both looking like silent nothing. */
export function describeError(err: unknown): string {
  if (err instanceof Error) {
    if (err.name === "TypeError") return "Can't reach the server — check your connection.";
    return err.message;
  }
  return "Something went wrong.";
}
