import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronRight, Folder, FolderUp, GraduationCap } from "lucide-react";
import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { deleteCourse, exploreLibrary, getLibraries, markCourseFolder } from "../../lib/api/admin";
import { ApiError } from "../../lib/apiClient";

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

  const { data: librariesData } = useQuery({ queryKey: ["admin", "libraries"], queryFn: getLibraries });
  const library = librariesData?.libraries.find((l) => l.id === libraryId);

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "explore", libraryId, currentPath],
    queryFn: () => exploreLibrary(libraryId, currentPath),
    enabled: Number.isFinite(libraryId),
  });

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

  if (!library) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-8">
        <Link to="/admin/libraries" className="text-sm text-slate-400 hover:text-slate-100">
          ← Libraries
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4 px-6 py-8">
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

        {data?.entries.map((entry) => (
          <div
            key={entry.path}
            className="flex items-center justify-between rounded-md px-3 py-2 text-sm hover:bg-slate-800"
          >
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
            {entry.isCourse ? (
              <button
                onClick={() => {
                  if (confirm(`Unmark "${entry.name}" as a course? This removes it and all its progress/notes permanently.`)) {
                    unmarkMutation.mutate(entry.courseId!);
                  }
                }}
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
        {data && data.entries.length === 0 && <p className="px-3 py-2 text-sm text-slate-600">No subfolders here.</p>}
      </div>
    </div>
  );
}
