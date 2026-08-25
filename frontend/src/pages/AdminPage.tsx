import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FolderOpen } from "lucide-react";
import { useState, type FormEvent } from "react";
import { FolderBrowserModal } from "../components/admin/FolderBrowserModal";
import { PageContainer } from "../components/layout/PageContainer";
import {
  createLibrary,
  createUser,
  deleteLibrary,
  deleteUser,
  getLibraries,
  getMissingFiles,
  getTopLevelEntries,
  getUsers,
  reclassifyFolder,
  resetUserPassword,
  scanLibrary,
  updateUserRole,
  type MissingEntry,
} from "../lib/api/admin";
import { ApiError } from "../lib/apiClient";

function LibrarySection() {
  const queryClient = useQueryClient();
  const { data } = useQuery({ queryKey: ["admin", "libraries"], queryFn: getLibraries });
  const [rootPath, setRootPath] = useState("");
  const [scanSummary, setScanSummary] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [browserOpen, setBrowserOpen] = useState(false);

  const createMutation = useMutation({
    mutationFn: () => createLibrary(rootPath.trim()),
    onSuccess: () => {
      setRootPath("");
      queryClient.invalidateQueries({ queryKey: ["admin", "libraries"] });
    },
  });

  const scanMutation = useMutation({
    mutationFn: (id: number) => scanLibrary(id),
    onSuccess: (res) => {
      const s = res.summary;
      setScanSummary(
        `${s.coursesFound} courses, ${s.sectionsFound} sections, ${s.videosFound} videos, ${s.filesFound} files. ${s.missingFlagged} flagged missing, ${s.archivesSkipped} archives skipped.`,
      );
      queryClient.invalidateQueries({ queryKey: ["admin", "libraries"] });
      queryClient.invalidateQueries({ queryKey: ["courses"] });
      queryClient.invalidateQueries({ queryKey: ["sections"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteLibrary(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "libraries"] }),
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    createMutation.mutate(undefined, {
      onError: (err) => setError(err instanceof ApiError ? err.message : "Failed to add library"),
    });
  }

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-slate-100">Library</h2>

      {data?.libraries.length === 0 && (
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
      )}
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

      <div className="space-y-2">
        {data?.libraries.map((lib) => (
          <div key={lib.id} className="flex items-center justify-between rounded-md border border-slate-800 bg-slate-900/60 p-3">
            <div>
              <p className="text-sm text-slate-200">{lib.rootPath}</p>
              <p className="text-xs text-slate-500">
                {lib.lastScannedAt ? `Last scanned ${new Date(lib.lastScannedAt).toLocaleString()}` : "Never scanned"}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => scanMutation.mutate(lib.id)}
                disabled={scanMutation.isPending}
                className="rounded-md border border-slate-700 px-2.5 py-1.5 text-xs text-slate-300 hover:bg-slate-800 disabled:opacity-50"
              >
                {scanMutation.isPending ? "Scanning…" : "Rescan"}
              </button>
              <button
                onClick={() => deleteMutation.mutate(lib.id)}
                className="rounded-md border border-slate-700 px-2.5 py-1.5 text-xs text-slate-400 hover:bg-slate-800 hover:text-red-400"
              >
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>
      {scanSummary && <p className="text-sm text-emerald-400">{scanSummary}</p>}
    </section>
  );
}

function ReclassifySection() {
  const queryClient = useQueryClient();
  const { data: libraries } = useQuery({ queryKey: ["admin", "libraries"], queryFn: getLibraries });
  const libraryId = libraries?.libraries[0]?.id;

  const { data } = useQuery({
    queryKey: ["admin", "top-level", libraryId],
    queryFn: () => getTopLevelEntries(libraryId!),
    enabled: !!libraryId,
  });

  const reclassifyMutation = useMutation({
    mutationFn: ({ folderPath, kind }: { folderPath: string; kind: "section" | "course" }) =>
      reclassifyFolder(libraryId!, folderPath, kind),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "top-level", libraryId] });
    },
  });

  if (!libraryId) return null;

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold text-slate-100">Reclassify</h2>
        <p className="text-sm text-slate-400">
          If the scanner guessed wrong on a top-level folder, flip it here, then rescan for it to take effect.
        </p>
      </div>
      <div className="space-y-2">
        {data?.entries.map((entry) => (
          <div key={`${entry.kind}-${entry.id}`} className="flex items-center justify-between rounded-md border border-slate-800 bg-slate-900/60 p-3">
            <div>
              <p className="text-sm text-slate-200">{entry.title}</p>
              <p className="text-xs text-slate-500">
                Currently: {entry.kind} · {entry.folderPath}
              </p>
            </div>
            <button
              onClick={() =>
                reclassifyMutation.mutate({ folderPath: entry.folderPath, kind: entry.kind === "section" ? "course" : "section" })
              }
              className="rounded-md border border-slate-700 px-2.5 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
            >
              Treat as {entry.kind === "section" ? "course" : "section"}
            </button>
          </div>
        ))}
        {data?.entries.length === 0 && <p className="text-sm text-slate-500">No top-level folders scanned yet.</p>}
      </div>
    </section>
  );
}

function MissingFilesSection() {
  const { data: libraries } = useQuery({ queryKey: ["admin", "libraries"], queryFn: getLibraries });
  const libraryId = libraries?.libraries[0]?.id;

  const { data } = useQuery({
    queryKey: ["admin", "missing", libraryId],
    queryFn: () => getMissingFiles(libraryId!),
    enabled: !!libraryId,
  });

  if (!libraryId || !data || data.missing.length === 0) return null;

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-slate-100">Missing Files</h2>
      <p className="text-sm text-slate-400">Flagged during the last scan — the on-disk file is gone, but nothing was deleted here.</p>
      <div className="space-y-1.5">
        {data.missing.map((m: MissingEntry) => (
          <div key={m.node.id} className="rounded-md border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm">
            <span className="text-amber-400">{m.course.title}</span>
            <span className="text-slate-500"> — {m.node.relativePath}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function UsersSection() {
  const queryClient = useQueryClient();
  const { data } = useQuery({ queryKey: ["admin", "users"], queryFn: getUsers });
  const [showForm, setShowForm] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"admin" | "user">("user");
  const [error, setError] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: () => createUser(username.trim(), password, role),
    onSuccess: () => {
      setUsername("");
      setPassword("");
      setRole("user");
      setShowForm(false);
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
    },
  });

  const roleMutation = useMutation({
    mutationFn: ({ id, role }: { id: number; role: "admin" | "user" }) => updateUserRole(id, role),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "users"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteUser(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "users"] }),
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    createMutation.mutate(undefined, {
      onError: (err) => setError(err instanceof ApiError ? err.message : "Failed to create user"),
    });
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-100">Users</h2>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="rounded-md border border-slate-700 px-2.5 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
        >
          {showForm ? "Cancel" : "New User"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="space-y-2 rounded-lg border border-slate-800 bg-slate-900 p-4">
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Username"
            className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-slate-500"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password (min 8 chars)"
            className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-slate-500"
          />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as "admin" | "user")}
            className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none"
          >
            <option value="user">User</option>
            <option value="admin">Admin</option>
          </select>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={!username.trim() || password.length < 8 || createMutation.isPending}
            className="rounded-md bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-900 hover:bg-white disabled:opacity-50"
          >
            Create
          </button>
        </form>
      )}

      <div className="space-y-2">
        {data?.users.map((u) => (
          <div key={u.id} className="flex items-center justify-between rounded-md border border-slate-800 bg-slate-900/60 p-3">
            <div>
              <p className="text-sm text-slate-200">{u.username}</p>
              <p className="text-xs text-slate-500">{u.role}</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => roleMutation.mutate({ id: u.id, role: u.role === "admin" ? "user" : "admin" })}
                className="rounded-md border border-slate-700 px-2.5 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
              >
                Make {u.role === "admin" ? "user" : "admin"}
              </button>
              <button
                onClick={() => {
                  const pw = prompt(`New password for ${u.username} (min 8 chars):`);
                  if (pw && pw.length >= 8) resetUserPassword(u.id, pw);
                }}
                className="rounded-md border border-slate-700 px-2.5 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
              >
                Reset password
              </button>
              <button
                onClick={() => deleteMutation.mutate(u.id)}
                className="rounded-md border border-slate-700 px-2.5 py-1.5 text-xs text-slate-400 hover:bg-slate-800 hover:text-red-400"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function AdminPage() {
  return (
    <PageContainer>
      <div className="max-w-3xl space-y-10">
        <h1 className="text-2xl font-semibold text-slate-50">Admin</h1>
        <LibrarySection />
        <ReclassifySection />
        <MissingFilesSection />
        <UsersSection />
      </div>
    </PageContainer>
  );
}
