import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FolderOpen } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { FolderBrowserModal } from "../../components/admin/FolderBrowserModal";
import {
  createLibrary,
  deleteLibrary,
  getLibraries,
  getMissingFiles,
  scanLibrary,
  type MissingEntry,
} from "../../lib/api/admin";
import { ApiError } from "../../lib/apiClient";

function AddLibraryForm({ onAdded }: { onAdded: () => void }) {
  const [rootPath, setRootPath] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [browserOpen, setBrowserOpen] = useState(false);

  const createMutation = useMutation({
    mutationFn: () => createLibrary(rootPath.trim()),
    onSuccess: () => {
      setRootPath("");
      onAdded();
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    createMutation.mutate(undefined, {
      onError: (err) => setError(err instanceof ApiError ? err.message : "Failed to add library"),
    });
  }

  return (
    <div className="space-y-2">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          value={rootPath}
          onChange={(e) => setRootPath(e.target.value)}
          placeholder="/mnt/courses"
          className="flex-1 rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-slate-500"
        />
        <button
          type="button"
          onClick={() => setBrowserOpen(true)}
          className="flex items-center gap-1.5 rounded-md border border-slate-700 px-3 py-2 text-sm text-slate-300 hover:bg-slate-800"
        >
          <FolderOpen size={15} />
          Browse…
        </button>
        <button
          type="submit"
          disabled={!rootPath.trim() || createMutation.isPending}
          className="rounded-md bg-slate-100 px-3 py-2 text-sm font-medium text-slate-900 hover:bg-white disabled:opacity-50"
        >
          Add Library
        </button>
      </form>
      {error && <p className="text-sm text-red-400">{error}</p>}
      {browserOpen && (
        <FolderBrowserModal
          initialPath={rootPath || undefined}
          onSelect={(path) => {
            setRootPath(path);
            setBrowserOpen(false);
          }}
          onClose={() => setBrowserOpen(false)}
        />
      )}
    </div>
  );
}

function MissingFiles({ libraryId }: { libraryId: number }) {
  const { data } = useQuery({
    queryKey: ["admin", "missing", libraryId],
    queryFn: () => getMissingFiles(libraryId),
  });

  if (!data || data.missing.length === 0) return null;

  return (
    <div className="mt-2 space-y-1.5 rounded-md border border-amber-900/60 bg-amber-950/20 p-3">
      <p className="text-xs font-medium text-amber-400">{data.missing.length} file(s) flagged missing on last scan</p>
      {data.missing.map((m: MissingEntry) => (
        <p key={m.node.id} className="text-xs">
          <span className="text-amber-400">{m.course.title}</span>
          <span className="text-slate-500"> — {m.node.relativePath}</span>
        </p>
      ))}
    </div>
  );
}

export function LibrariesPage() {
  const queryClient = useQueryClient();
  const { data } = useQuery({ queryKey: ["admin", "libraries"], queryFn: getLibraries });
  const [scanSummary, setScanSummary] = useState<string | null>(null);

  const scanMutation = useMutation({
    mutationFn: (id: number) => scanLibrary(id),
    onSuccess: (res) => {
      const s = res.summary;
      setScanSummary(
        `Refreshed ${s.coursesFound} already-marked course(s): ${s.videosFound} videos, ${s.filesFound} files. ${s.missingFlagged} flagged missing, ${s.archivesSkipped} archives skipped.`,
      );
      queryClient.invalidateQueries({ queryKey: ["admin", "libraries"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "missing"] });
      queryClient.invalidateQueries({ queryKey: ["courses"] });
      queryClient.invalidateQueries({ queryKey: ["sections"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "all-courses"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteLibrary(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "libraries"] }),
  });

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
      <div>
        <h1 className="text-2xl font-semibold text-slate-50">Libraries</h1>
        <p className="mt-1 text-sm text-slate-400">
          Add a root folder, then open it to browse its real structure and mark which folders are courses.
        </p>
      </div>

      {data?.libraries.length === 0 && <AddLibraryForm onAdded={() => queryClient.invalidateQueries({ queryKey: ["admin", "libraries"] })} />}

      <div className="space-y-3">
        {data?.libraries.map((lib) => (
          <div key={lib.id} className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
            <div className="flex items-center justify-between">
              <Link to={`/admin/libraries/${lib.id}`} className="min-w-0 flex-1 hover:opacity-80">
                <p className="truncate text-sm font-medium text-slate-100">{lib.rootPath}</p>
                <p className="text-xs text-slate-500">
                  {lib.lastScannedAt ? `Last scanned ${new Date(lib.lastScannedAt).toLocaleString()}` : "Never scanned"}
                </p>
              </Link>
              <div className="flex shrink-0 gap-2">
                <Link
                  to={`/admin/libraries/${lib.id}`}
                  className="rounded-md border border-slate-700 px-2.5 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
                >
                  Explore
                </Link>
                <button
                  onClick={() => scanMutation.mutate(lib.id)}
                  disabled={scanMutation.isPending}
                  className="rounded-md border border-slate-700 px-2.5 py-1.5 text-xs text-slate-300 hover:bg-slate-800 disabled:opacity-50"
                >
                  {scanMutation.isPending ? "Refreshing…" : "Rescan"}
                </button>
                <button
                  onClick={() => deleteMutation.mutate(lib.id)}
                  className="rounded-md border border-slate-700 px-2.5 py-1.5 text-xs text-slate-400 hover:bg-slate-800 hover:text-red-400"
                >
                  Remove
                </button>
              </div>
            </div>
            <MissingFiles libraryId={lib.id} />
          </div>
        ))}
        {data?.libraries.length === 0 && <p className="text-sm text-slate-500">No libraries yet.</p>}
      </div>
      {scanSummary && <p className="text-sm text-emerald-400">{scanSummary}</p>}
    </div>
  );
}
