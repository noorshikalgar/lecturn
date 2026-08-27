import { useQuery } from "@tanstack/react-query";
import { Folder, FolderUp, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { browseDirectory } from "../../lib/api/admin";
import { ApiError } from "../../lib/apiClient";
import { useLockBodyScroll } from "../../lib/useLockBodyScroll";

interface FolderBrowserModalProps {
  initialPath?: string;
  onSelect: (path: string) => void;
  onClose: () => void;
}

export function FolderBrowserModal({ initialPath, onSelect, onClose }: FolderBrowserModalProps) {
  const [path, setPath] = useState(initialPath || "/");
  const closeRef = useRef<HTMLButtonElement>(null);

  useLockBodyScroll();

  const { data, isLoading, error } = useQuery({
    queryKey: ["browse", path],
    queryFn: () => browseDirectory(path),
  });

  useEffect(() => {
    closeRef.current?.focus();
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // Portaled to <body> — see ConfirmDialog for why a fixed-position overlay
  // can't safely be left as a plain child of whatever renders it (a
  // space-y-* parent puts a margin-top on it that a fixed box won't collapse).
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="folder-browser-title"
        className="flex max-h-[70vh] w-full max-w-lg flex-col rounded-lg border border-border bg-card shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 id="folder-browser-title" className="text-sm font-semibold text-foreground">
            Choose a folder
          </h2>
          <button ref={closeRef} onClick={onClose} aria-label="Close" className="text-muted-foreground hover:text-foreground">
            <X size={16} />
          </button>
        </div>

        <div className="border-b border-border px-4 py-2">
          <p className="truncate font-mono text-xs text-muted-foreground">{data?.path ?? path}</p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {isLoading && <p className="px-2 py-1.5 text-sm text-muted-foreground">Loading…</p>}
          {error && (
            <p className="px-2 py-1.5 text-sm text-red-600">
              {error instanceof ApiError ? error.message : "Couldn't read that folder."}
            </p>
          )}
          {data?.parent !== undefined && data.parent !== null && (
            <button
              onClick={() => setPath(data.parent!)}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-muted-foreground hover:bg-muted"
            >
              <FolderUp size={15} className="shrink-0 text-muted-foreground" />
              ..
            </button>
          )}
          {data?.directories.map((name) => (
            <button
              key={name}
              onClick={() => setPath(data.path === "/" ? `/${name}` : `${data.path}/${name}`)}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-muted-foreground hover:bg-muted"
            >
              <Folder size={15} className="shrink-0 text-muted-foreground" />
              {name}
            </button>
          ))}
          {data && data.directories.length === 0 && (
            <p className="px-2 py-1.5 text-sm text-muted-foreground">No subfolders here.</p>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border px-4 py-3">
          <button
            onClick={onClose}
            className="rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted"
          >
            Cancel
          </button>
          <button
            onClick={() => onSelect(data?.path ?? path)}
            disabled={!data}
            className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            Use this folder
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
