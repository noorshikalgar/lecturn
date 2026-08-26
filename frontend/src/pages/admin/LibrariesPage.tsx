import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, FolderOpen } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { FolderBrowserModal } from "../../components/admin/FolderBrowserModal";
import {
  createLibrary,
  deleteCourse,
  deleteLibrary,
  getLibraries,
  getMissingFiles,
  getOrphanedCourses,
  relinkCourse,
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
          className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-ring"
        />
        <button
          type="button"
          onClick={() => setBrowserOpen(true)}
          className="flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm text-muted-foreground hover:bg-muted"
        >
          <FolderOpen size={15} />
          Browse…
        </button>
        <button
          type="submit"
          disabled={!rootPath.trim() || createMutation.isPending}
          className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
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
  const [open, setOpen] = useState(false);

  if (!data || data.missing.length === 0) return null;

  return (
    <div className="mt-2 rounded-md border border-amber-900/60 bg-amber-950/20 p-3">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between text-left text-xs font-medium text-amber-400"
      >
        <span>{data.missing.length} file(s) flagged missing on last scan</span>
        <ChevronDown size={14} className={`shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="mt-2 max-h-64 space-y-1.5 overflow-y-auto pr-1">
          {data.missing.map((m: MissingEntry) => (
            <p key={m.node.id} className="text-xs">
              <span className="text-amber-400">{m.course.title}</span>
              <span className="text-muted-foreground"> — {m.node.relativePath}</span>
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

function OrphanedCourses({ libraryId }: { libraryId: number }) {
  const queryClient = useQueryClient();
  const { data } = useQuery({
    queryKey: ["admin", "orphaned", libraryId],
    queryFn: () => getOrphanedCourses(libraryId),
  });
  const [open, setOpen] = useState(false);
  const [relinkTarget, setRelinkTarget] = useState<{ id: number; title: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["admin", "orphaned", libraryId] });
    queryClient.invalidateQueries({ queryKey: ["admin", "libraries"] });
    queryClient.invalidateQueries({ queryKey: ["courses"] });
    queryClient.invalidateQueries({ queryKey: ["sections"] });
  }

  const relinkMutation = useMutation({
    mutationFn: ({ id, folderPath }: { id: number; folderPath: string }) => relinkCourse(id, folderPath),
    onSuccess: invalidate,
    onError: (err) => setError(err instanceof ApiError ? err.message : "Failed to relink course"),
  });

  const unmarkMutation = useMutation({
    mutationFn: (id: number) => deleteCourse(id),
    onSuccess: invalidate,
  });

  if (!data || data.orphaned.length === 0) return null;

  return (
    <div className="mt-2 rounded-md border border-red-900/60 bg-red-950/20 p-3">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between text-left text-xs font-medium text-red-400"
      >
        <span>{data.orphaned.length} course(s) can't find their folder on disk — renamed or moved?</span>
        <ChevronDown size={14} className={`shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
      {open && (
        <div className="mt-2 max-h-64 space-y-1.5 overflow-y-auto pr-1">
          {data.orphaned.map((c) => (
            <div key={c.id} className="flex items-center justify-between gap-2 text-xs">
              <div className="min-w-0 flex-1">
                <span className="text-red-400">{c.title}</span>
                <span className="block truncate text-muted-foreground">{c.folderPath}</span>
              </div>
              <div className="flex shrink-0 gap-1.5">
                <button
                  onClick={() => setRelinkTarget({ id: c.id, title: c.title })}
                  className="rounded border border-border px-2 py-1 text-muted-foreground hover:bg-muted"
                >
                  Relink
                </button>
                <button
                  onClick={() => unmarkMutation.mutate(c.id)}
                  className="rounded border border-border px-2 py-1 text-muted-foreground hover:bg-muted hover:text-red-400"
                >
                  Unmark
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      {relinkTarget && (
        <FolderBrowserModal
          onSelect={(path) => {
            setError(null);
            relinkMutation.mutate({ id: relinkTarget.id, folderPath: path });
            setRelinkTarget(null);
          }}
          onClose={() => setRelinkTarget(null)}
        />
      )}
    </div>
  );
}

export function LibrariesPage() {
  const queryClient = useQueryClient();
  const { data } = useQuery({ queryKey: ["admin", "libraries"], queryFn: getLibraries });
  const [scanSummary, setScanSummary] = useState<string | null>(null);

  const [scanError, setScanError] = useState<string | null>(null);

  const scanMutation = useMutation({
    mutationFn: (id: number) => scanLibrary(id),
    onSuccess: (res) => {
      setScanError(null);
      const s = res.summary;
      setScanSummary(
        `Refreshed ${s.coursesFound} already-marked course(s): ${s.videosFound} videos, ${s.filesFound} files. ${s.missingFlagged} flagged missing, ${s.archivesSkipped} archives skipped.` +
          (s.coursesOrphaned > 0 ? ` ${s.coursesOrphaned} course(s) couldn't be found on disk — see below.` : ""),
      );
      queryClient.invalidateQueries({ queryKey: ["admin", "libraries"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "missing"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "orphaned"] });
      queryClient.invalidateQueries({ queryKey: ["courses"] });
      queryClient.invalidateQueries({ queryKey: ["sections"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "all-courses"] });
    },
    onError: (err) => {
      setScanSummary(null);
      setScanError(err instanceof ApiError ? err.message : "Scan failed");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteLibrary(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "libraries"] }),
  });

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Libraries</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Add a root folder, then open it to browse its real structure and mark which folders are courses.
        </p>
      </div>

      {data?.libraries.length === 0 && <AddLibraryForm onAdded={() => queryClient.invalidateQueries({ queryKey: ["admin", "libraries"] })} />}

      <div className="space-y-3">
        {data?.libraries.map((lib) => (
          <div key={lib.id} className="rounded-lg border border-border bg-card/60 p-4">
            <div className="flex items-center justify-between">
              <Link to={`/admin/libraries/${lib.id}`} className="min-w-0 flex-1 hover:opacity-80">
                <p className="truncate text-sm font-medium text-foreground">{lib.rootPath}</p>
                <p className="text-xs text-muted-foreground">
                  {lib.lastScannedAt ? `Last scanned ${new Date(lib.lastScannedAt).toLocaleString()}` : "Never scanned"}
                </p>
              </Link>
              <div className="flex shrink-0 gap-2">
                <Link
                  to={`/admin/libraries/${lib.id}`}
                  className="rounded-md border border-border px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-muted"
                >
                  Explore
                </Link>
                <button
                  onClick={() => scanMutation.mutate(lib.id)}
                  disabled={scanMutation.isPending}
                  className="rounded-md border border-border px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-muted disabled:opacity-50"
                >
                  {scanMutation.isPending ? "Refreshing…" : "Rescan"}
                </button>
                <button
                  onClick={() => deleteMutation.mutate(lib.id)}
                  className="rounded-md border border-border px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-red-400"
                >
                  Remove
                </button>
              </div>
            </div>
            <OrphanedCourses libraryId={lib.id} />
            <MissingFiles libraryId={lib.id} />
          </div>
        ))}
        {data?.libraries.length === 0 && <p className="text-sm text-muted-foreground">No libraries yet.</p>}
      </div>
      {scanSummary && <p className="text-sm text-emerald-400">{scanSummary}</p>}
      {scanError && <p className="text-sm text-red-400">{scanError}</p>}
    </div>
  );
}
