import { useQuery } from "@tanstack/react-query";
import { Folder, FolderUp, X } from "lucide-react";
import { useState } from "react";
import { browseDirectory } from "../../lib/api/admin";
import { ApiError } from "../../lib/apiClient";

interface FolderBrowserModalProps {
  initialPath?: string;
  onSelect: (path: string) => void;
  onClose: () => void;
}

export function FolderBrowserModal({ initialPath, onSelect, onClose }: FolderBrowserModalProps) {
  const [path, setPath] = useState(initialPath || "/");

  const { data, isLoading, error } = useQuery({
    queryKey: ["browse", path],
    queryFn: () => browseDirectory(path),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" onClick={onClose}>
      <div
        className="flex max-h-[70vh] w-full max-w-lg flex-col rounded-lg border border-border bg-card shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold text-foreground">Choose a folder</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X size={16} />
          </button>
        </div>

        <div className="border-b border-border px-4 py-2">
          <p className="truncate font-mono text-xs text-muted-foreground">{data?.path ?? path}</p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {isLoading && <p className="px-2 py-1.5 text-sm text-muted-foreground">Loading…</p>}
          {error && (
            <p className="px-2 py-1.5 text-sm text-red-400">
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
    </div>
  );
}
