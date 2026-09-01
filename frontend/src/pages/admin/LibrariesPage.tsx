import type { ScanSummary } from "@lecturn/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, FolderOpen, Trash2 } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { FolderBrowserModal } from "../../components/admin/FolderBrowserModal";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import {
  createLibrary,
  deleteCourse,
  deleteLibrary,
  exploreLibrary,
  getLibraries,
  getMissingFiles,
  getOrphanedCourses,
  relinkCourse,
  scanLibrary,
  type MissingEntry,
} from "../../lib/api/admin";
import { ApiError } from "../../lib/apiClient";

function AddLibraryForm({ onAdded }: { onAdded: (libraryId: number) => void }) {
  const [rootPath, setRootPath] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [browserOpen, setBrowserOpen] = useState(false);

  const createMutation = useMutation({
    mutationFn: () => createLibrary(rootPath.trim()),
    onSuccess: (res) => {
      setRootPath("");
      onAdded(res.library.id);
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
      <form onSubmit={handleSubmit} className="flex flex-wrap gap-2">
        <input
          value={rootPath}
          onChange={(e) => setRootPath(e.target.value)}
          placeholder="/mnt/courses"
          className="min-w-0 flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-ring"
        />
        <button
          type="button"
          onClick={() => setBrowserOpen(true)}
          className="flex shrink-0 items-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm text-muted-foreground hover:bg-muted"
        >
          <FolderOpen size={15} />
          Browse…
        </button>
        <button
          type="submit"
          disabled={!rootPath.trim() || createMutation.isPending}
          className="shrink-0 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          Add Library
        </button>
      </form>
      {error && <p className="text-sm text-red-600">{error}</p>}
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
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 rounded-md bg-destructive/10 px-2.5 py-1 text-xs font-medium text-destructive hover:bg-destructive/15"
      >
        {data.missing.length} missing
        <ChevronDown size={12} className={`shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="mt-1.5 max-h-64 w-full space-y-1.5 overflow-y-auto rounded-md border border-border bg-card/60 p-2">
          {data.missing.map((m: MissingEntry) => (
            <p key={m.node.id} className="text-xs">
              <span className="text-destructive">{m.course.title}</span>
              <span className="text-muted-foreground"> — {m.node.relativePath}</span>
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

// Adding/rescanning a library never auto-discovers courses — scanLibrary.ts
// only refreshes folders already explicitly marked (see its own doc comment)
// — so a freshly-added library with real course subfolders looks identical
// to an empty one: "Never scanned" / a scan summary of all zeros, no signal
// that anything is expected of the admin. This surfaces that gap directly.
function NoCoursesNudge({ libraryId }: { libraryId: number }) {
  const { data } = useQuery({
    queryKey: ["admin", "explore", libraryId, undefined],
    queryFn: () => exploreLibrary(libraryId),
  });

  if (!data || data.entries.length === 0) return null;
  if (data.entries.some((e) => e.isCourse)) return null;

  return (
    <Link
      to={`/admin/libraries/${libraryId}`}
      title="Adding or scanning a library never marks courses automatically"
      className="flex items-center gap-1 rounded-md bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground hover:opacity-80"
    >
      No courses marked yet
      <ChevronDown size={12} className="-rotate-90" />
    </Link>
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
    <div className="mt-2 rounded-md border border-destructive/30 bg-destructive/10 p-3">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between text-left text-xs font-medium text-destructive"
      >
        <span>{data.orphaned.length} course(s) can't find their folder on disk — renamed or moved?</span>
        <ChevronDown size={14} className={`shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
      {open && (
        <div className="mt-2 max-h-64 space-y-1.5 overflow-y-auto pr-1">
          {data.orphaned.map((c) => (
            <div key={c.id} className="flex items-center justify-between gap-2 text-xs">
              <div className="min-w-0 flex-1">
                <span className="text-destructive">{c.title}</span>
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
                  className="rounded border border-border px-2 py-1 text-muted-foreground hover:bg-muted hover:text-destructive"
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

function ScanStats({ summary }: { summary: ScanSummary }) {
  return (
    <>
      <span className="rounded-md bg-muted px-2.5 py-1 text-xs text-muted-foreground">{summary.videosFound} videos</span>
      <span className="rounded-md bg-muted px-2.5 py-1 text-xs text-muted-foreground">{summary.filesFound} files</span>
      {summary.archivesSkipped > 0 && (
        <span className="rounded-md bg-muted px-2.5 py-1 text-xs text-muted-foreground">{summary.archivesSkipped} archives skipped</span>
      )}
    </>
  );
}

export function LibrariesPage() {
  const queryClient = useQueryClient();

  // Scanning runs detached on the server (see backend's POST /:id/scan) —
  // this is the only source of truth for its progress, so a page reload or
  // a second browser tab mid-scan sees exactly the same "running" state
  // instead of losing track of it. Polling only while something is actually
  // running keeps this from hammering the server the rest of the time.
  const { data } = useQuery({
    queryKey: ["admin", "libraries"],
    queryFn: getLibraries,
    refetchInterval: (query) => (query.state.data?.libraries.some((l) => l.scanStatus === "running") ? 2000 : false),
  });

  // Everything derived from a scan (missing files, orphaned courses, the
  // course lists themselves) only needs refreshing once a scan actually
  // finishes — fires exactly once per running→settled transition, tracked
  // per library id so two libraries scanning at once don't interfere.
  const prevScanStatus = useRef<Map<number, string>>(new Map());
  useEffect(() => {
    if (!data) return;
    for (const lib of data.libraries) {
      const was = prevScanStatus.current.get(lib.id);
      if (was === "running" && lib.scanStatus !== "running") {
        queryClient.invalidateQueries({ queryKey: ["admin", "missing", lib.id] });
        queryClient.invalidateQueries({ queryKey: ["admin", "orphaned", lib.id] });
        queryClient.invalidateQueries({ queryKey: ["admin", "explore", lib.id] });
        queryClient.invalidateQueries({ queryKey: ["courses"] });
        queryClient.invalidateQueries({ queryKey: ["sections"] });
        queryClient.invalidateQueries({ queryKey: ["admin", "all-courses"] });
      }
      prevScanStatus.current.set(lib.id, lib.scanStatus);
    }
  }, [data, queryClient]);

  // Just starts the scan — its result lands on the library row itself
  // (polled above), not in this mutation's own response.
  const scanMutation = useMutation({
    mutationFn: (id: number) => scanLibrary(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "libraries"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteLibrary(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "libraries"] }),
  });

  const [pendingDelete, setPendingDelete] = useState<{ id: number; rootPath: string } | null>(null);

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Libraries</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Add a root folder, then open it to browse its real structure and mark which folders are courses.
        </p>
      </div>

      {/* Rendered unconditionally — this used to be gated on zero libraries,
          which meant the form disappeared for good the moment you added
          your first one, with no way to ever add a second. */}
      <AddLibraryForm
        onAdded={(libraryId) => {
          queryClient.invalidateQueries({ queryKey: ["admin", "libraries"] });
          // A brand-new library scans to zero courses found — scanning never
          // discovers new ones (see scanLibrary.ts) — but this still sets
          // lastScannedAt and, more importantly, reuses scanMutation's own
          // "0 marked courses" messaging so that nudge shows up immediately
          // instead of only after the admin thinks to click Rescan.
          scanMutation.mutate(libraryId);
        }}
      />

      <div className="space-y-3">
        {data?.libraries.map((lib) => (
          <div key={lib.id} className="rounded-lg border border-border bg-card/60 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Link to={`/admin/libraries/${lib.id}`} className="min-w-0 flex-1 hover:opacity-80">
                <p className="truncate text-sm font-medium text-foreground">{lib.rootPath}</p>
                <p className="text-xs text-muted-foreground">
                  {lib.lastScannedAt ? `Last scanned ${new Date(lib.lastScannedAt).toLocaleString()}` : "Never scanned"}
                </p>
              </Link>
              <div className="flex shrink-0 flex-wrap gap-2">
                <Link
                  to={`/admin/libraries/${lib.id}`}
                  className="rounded-md border border-border px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-muted"
                >
                  Explore
                </Link>
                <button
                  onClick={() => scanMutation.mutate(lib.id)}
                  disabled={lib.scanStatus === "running"}
                  className="rounded-md border border-border px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-muted disabled:opacity-50"
                >
                  {/* Driven by the library row's own scanStatus, not this
                      mutation's pending state — that way a scan already
                      running from before a page reload (or another tab)
                      still shows correctly here. */}
                  {lib.scanStatus === "running" ? "Refreshing…" : "Rescan"}
                </button>
                <button
                  onClick={() => setPendingDelete({ id: lib.id, rootPath: lib.rootPath })}
                  title="Remove library"
                  aria-label={`Remove ${lib.rootPath}`}
                  className="rounded-md border border-border p-1.5 text-destructive hover:bg-destructive/10"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
            {/* coursesOrphaned surfaces on its own via OrphanedCourses below
                (driven by a live query, not this scan's one-off result) — no
                need to also call it out here. Same for zero marked courses:
                NoCoursesNudge is permanent, not tied to a specific scan. */}
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {lib.scanStatus === "completed" && lib.lastScanSummary && lib.lastScanSummary.coursesFound > 0 && (
                <ScanStats summary={lib.lastScanSummary} />
              )}
              <MissingFiles libraryId={lib.id} />
              <NoCoursesNudge libraryId={lib.id} />
            </div>
            {lib.scanStatus === "failed" && lib.scanError && <p className="mt-2 text-xs text-destructive">{lib.scanError}</p>}
            {/* Covers only "the request to even start a scan failed" (library
                deleted from under you, network error) — a scan that started
                fine and failed partway shows via lib.scanStatus above instead. */}
            {scanMutation.variables === lib.id && scanMutation.isError && (
              <p className="mt-2 text-xs text-destructive">
                {scanMutation.error instanceof ApiError ? scanMutation.error.message : "Failed to start scan"}
              </p>
            )}
            <OrphanedCourses libraryId={lib.id} />
          </div>
        ))}
        {data?.libraries.length === 0 && <p className="text-sm text-muted-foreground">No libraries yet.</p>}
      </div>

      {pendingDelete && (
        <ConfirmDialog
          title="Remove library"
          message={`Remove "${pendingDelete.rootPath}"? Courses already scanned from it stay in Lecturn but won't be rescanned.`}
          confirmLabel="Remove"
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => {
            deleteMutation.mutate(pendingDelete.id);
            setPendingDelete(null);
          }}
        />
      )}
    </div>
  );
}
