import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronRight, Folder, FolderUp, GraduationCap } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { deleteCourse, exploreLibrary, getLibraries, markCourseFolder } from "../../lib/api/admin";
import { ApiError } from "../../lib/apiClient";

type PendingUnmark = { kind: "single"; courseId: number; name: string } | { kind: "bulk"; count: number };

function Breadcrumbs({ rootPath, currentPath, onNavigate }: { rootPath: string; currentPath: string; onNavigate: (path: string) => void }) {
  const rel = currentPath === rootPath ? "" : currentPath.slice(rootPath.length).replace(/^\/+/, "");
  const segments = rel ? rel.split("/") : [];

  return (
    <div className="flex flex-wrap items-center gap-1 text-sm">
      <button onClick={() => onNavigate(rootPath)} className="text-slate-300 hover:text-slate-100">
        {rootPath}
      </button>
      {segments.map((seg, i) => {
        const segPath = `${rootPath}/${segments.slice(0, i + 1).join("/")}`;
        const isLast = i === segments.length - 1;
        return (
          <span key={segPath} className="flex items-center gap-1">
            <ChevronRight size={13} className="text-slate-600" />
            <button
              onClick={() => onNavigate(segPath)}
              className={isLast ? "text-slate-100" : "text-slate-400 hover:text-slate-100"}
            >
              {seg}
            </button>
          </span>
        );
      })}
    </div>
  );
}

export function LibraryExplorerPage() {
  const { id } = useParams<{ id: string }>();
  const libraryId = Number(id);
  const [searchParams, setSearchParams] = useSearchParams();
  const currentPath = searchParams.get("path") ?? undefined;
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [pendingUnmark, setPendingUnmark] = useState<PendingUnmark | null>(null);

  const { data: librariesData } = useQuery({ queryKey: ["admin", "libraries"], queryFn: getLibraries });
  const library = librariesData?.libraries.find((l) => l.id === libraryId);

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "explore", libraryId, currentPath],
    queryFn: () => exploreLibrary(libraryId, currentPath),
    enabled: Number.isFinite(libraryId),
  });

  // A fresh folder listing invalidates any selection from the previous one.
  useEffect(() => {
    setSelected(new Set());
  }, [data?.path]);

  function navigate(path: string) {
    setSearchParams(path === library?.rootPath ? {} : { path });
  }

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["admin", "explore", libraryId] });
    queryClient.invalidateQueries({ queryKey: ["admin", "all-courses"] });
    queryClient.invalidateQueries({ queryKey: ["courses"] });
    queryClient.invalidateQueries({ queryKey: ["sections"] });
  }

  const markMutation = useMutation({
    mutationFn: (folderPath: string) => markCourseFolder(libraryId, folderPath),
    onSuccess: invalidate,
    onError: (err) => setError(err instanceof ApiError ? err.message : "Failed to mark as course"),
  });

  const unmarkMutation = useMutation({
    mutationFn: (courseId: number) => deleteCourse(courseId),
    onSuccess: invalidate,
  });

  function toggleSelected(path: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }

  const entries = data?.entries ?? [];
  const allSelected = entries.length > 0 && entries.every((e) => selected.has(e.path));
  const selectedUnmarked = entries.filter((e) => selected.has(e.path) && !e.isCourse);
  const selectedMarked = entries.filter((e) => selected.has(e.path) && e.isCourse);

  function toggleSelectAll() {
    setSelected(allSelected ? new Set() : new Set(entries.map((e) => e.path)));
  }

  async function bulkMark() {
    setError(null);
    setBulkBusy(true);
    try {
      await Promise.all(selectedUnmarked.map((e) => markMutation.mutateAsync(e.path)));
      setSelected(new Set());
    } catch {
      setError("Some folders failed to mark — check above and retry.");
    } finally {
      setBulkBusy(false);
    }
  }

  async function confirmBulkUnmark() {
    setPendingUnmark(null);
    setBulkBusy(true);
    try {
      await Promise.all(selectedMarked.map((e) => unmarkMutation.mutateAsync(e.courseId!)));
      setSelected(new Set());
    } finally {
      setBulkBusy(false);
    }
  }

  if (!library) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
        <Link to="/admin/libraries" className="text-sm text-slate-400 hover:text-slate-100">
          ← Libraries
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4 px-4 py-6 sm:px-6 sm:py-8">
      <div>
        <Link to="/admin/libraries" className="text-xs text-slate-500 hover:text-slate-300">
          ← Libraries
        </Link>
        <h1 className="mt-1 text-2xl font-semibold text-slate-50">Explore</h1>
        <p className="mt-1 text-sm text-slate-400">
          Browse the real folder structure and mark whichever folder is a course — any depth, your call, nothing guessed.
        </p>
      </div>

      <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
        <Breadcrumbs rootPath={library.rootPath} currentPath={data?.path ?? library.rootPath} onNavigate={navigate} />
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {selected.size > 0 && (
        <div className="flex items-center justify-between rounded-lg border border-slate-700 bg-slate-900 px-3 py-2">
          <p className="text-xs text-slate-400">{selected.size} selected</p>
          <div className="flex gap-2">
            {selectedUnmarked.length > 0 && (
              <button
                onClick={bulkMark}
                disabled={bulkBusy}
                className="rounded-md border border-slate-700 px-2.5 py-1 text-xs text-slate-300 hover:bg-slate-800 disabled:opacity-50"
              >
                Mark {selectedUnmarked.length} as Course
              </button>
            )}
            {selectedMarked.length > 0 && (
              <button
                onClick={() => setPendingUnmark({ kind: "bulk", count: selectedMarked.length })}
                disabled={bulkBusy}
                className="rounded-md border border-slate-700 px-2.5 py-1 text-xs text-slate-400 hover:bg-slate-800 hover:text-red-400 disabled:opacity-50"
              >
                Unmark {selectedMarked.length}
              </button>
            )}
          </div>
        </div>
      )}

      <div className="space-y-1 rounded-lg border border-slate-800 bg-slate-900/40 p-2">
        {isLoading && <p className="px-2 py-1.5 text-sm text-slate-500">Loading…</p>}

        {data?.parent !== undefined && data.parent !== null && (
          <button
            onClick={() => navigate(data.parent!)}
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-slate-300 hover:bg-slate-800"
          >
            <FolderUp size={15} className="shrink-0 text-slate-500" />
            ..
          </button>
        )}

        {entries.length > 0 && (
          <label className="flex items-center gap-2.5 px-3 py-1.5 text-xs text-slate-500">
            <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} />
            Select all
          </label>
        )}

        {entries.map((entry) => (
          <div
            key={entry.path}
            className="flex items-center justify-between rounded-md px-3 py-2 text-sm hover:bg-slate-800"
          >
            <div className="flex min-w-0 flex-1 items-center gap-2.5">
              <input
                type="checkbox"
                checked={selected.has(entry.path)}
                onChange={() => toggleSelected(entry.path)}
                className="shrink-0"
              />
              <button onClick={() => navigate(entry.path)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                {entry.isCourse ? (
                  <GraduationCap size={15} className="shrink-0 text-emerald-400" />
                ) : (
                  <Folder size={15} className="shrink-0 text-slate-500" />
                )}
                <span className="truncate text-slate-200">{entry.name}</span>
                {entry.isCourse && (
                  <span className="shrink-0 rounded border border-emerald-800 bg-emerald-950/50 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-emerald-400">
                    Course
                  </span>
                )}
              </button>
            </div>
            {entry.isCourse ? (
              <button
                onClick={() => setPendingUnmark({ kind: "single", courseId: entry.courseId!, name: entry.name })}
                className="ml-2 shrink-0 rounded-md border border-slate-700 px-2.5 py-1 text-xs text-slate-400 hover:bg-slate-900 hover:text-red-400"
              >
                Unmark
              </button>
            ) : (
              <button
                onClick={() => markMutation.mutate(entry.path)}
                disabled={markMutation.isPending}
                className="ml-2 shrink-0 rounded-md border border-slate-700 px-2.5 py-1 text-xs text-slate-300 hover:bg-slate-900 disabled:opacity-50"
              >
                Mark as Course
              </button>
            )}
            <button
              onClick={() => navigate(entry.path)}
              title="Open this folder"
              className="ml-2 shrink-0 rounded-md border border-slate-700 p-1.5 text-slate-400 hover:bg-slate-900 hover:text-slate-100"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        ))}
        {data && entries.length === 0 && <p className="px-3 py-2 text-sm text-slate-600">No subfolders here.</p>}
      </div>

      {pendingUnmark?.kind === "single" && (
        <ConfirmDialog
          title="Unmark course"
          message={`Unmark "${pendingUnmark.name}" as a course? This removes it and all its progress/notes permanently.`}
          confirmLabel="Unmark"
          onConfirm={() => {
            unmarkMutation.mutate(pendingUnmark.courseId);
            setPendingUnmark(null);
          }}
          onCancel={() => setPendingUnmark(null)}
        />
      )}
      {pendingUnmark?.kind === "bulk" && (
        <ConfirmDialog
          title="Unmark courses"
          message={`Unmark ${pendingUnmark.count} course(s)? This removes each one and all its progress/notes permanently.`}
          confirmLabel="Unmark"
          onConfirm={confirmBulkUnmark}
          onCancel={() => setPendingUnmark(null)}
        />
      )}
    </div>
  );
}
