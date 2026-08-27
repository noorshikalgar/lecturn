import { AlertCircleIcon, CheckCircle2Icon, XIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { subscribeToasts, toast, type Toast } from "../lib/toast";

export function Toaster() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => subscribeToasts(setToasts), []);

  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[100] flex flex-col items-center gap-2 px-4 sm:items-end sm:px-6">
      {toasts.map((t) => (
        <div
          key={t.id}
          role="alert"
          className={`pointer-events-auto flex w-full max-w-sm items-start gap-2.5 rounded-[10px] border px-4 py-3 shadow-lg ${
            t.variant === "error" ? "border-destructive/30 bg-destructive/10 text-destructive" : "border-emerald-200 bg-emerald-50 text-emerald-700"
          }`}
        >
          {t.variant === "error" ? (
            <AlertCircleIcon size={18} className="mt-0.5 shrink-0" />
          ) : (
            <CheckCircle2Icon size={18} className="mt-0.5 shrink-0" />
          )}
          <p className="flex-1 text-sm font-medium">{t.message}</p>
          <button
            type="button"
            onClick={() => toast.dismiss(t.id)}
            aria-label="Dismiss"
            className="shrink-0 rounded p-0.5 opacity-70 hover:opacity-100"
          >
            <XIcon size={15} />
          </button>
        </div>
      ))}
    </div>
  );
}
