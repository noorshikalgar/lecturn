import type { User } from "@lecturn/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FolderOpen } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { FolderBrowserModal } from "../components/admin/FolderBrowserModal";
import { PageContainer } from "../components/layout/PageContainer";
import {
  assignCourseSection,
  createLibrary,
  createSection,
  createUser,
  deleteCourse,
  deleteLibrary,
  deleteSection,
  deleteUser,
  getLibraries,
  getMissingFiles,
  getSectionAccess,
  getUsers,
  resetUserPassword,
  scanLibrary,
  setCourseHidden,
  setSectionAccess,
  setSectionHidden,
  updateUserRole,
  type MissingEntry,
} from "../lib/api/admin";
import { getCourses, getSections } from "../lib/api/courses";
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
        `${s.coursesFound} courses, ${s.videosFound} videos, ${s.filesFound} files. ${s.missingFlagged} flagged missing, ${s.archivesSkipped} archives skipped, ${s.emptyFoldersSkipped} empty folders skipped.`,
      );
      queryClient.invalidateQueries({ queryKey: ["admin", "libraries"] });
      queryClient.invalidateQueries({ queryKey: ["courses"] });
      queryClient.invalidateQueries({ queryKey: ["sections"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "unassigned-courses"] });
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

function SectionAccessEditor({ sectionId, users }: { sectionId: number; users: User[] }) {
  const queryClient = useQueryClient();
  const { data } = useQuery({ queryKey: ["admin", "section-access", sectionId], queryFn: () => getSectionAccess(sectionId) });
  const [selected, setSelected] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (data) setSelected(new Set(data.userIds));
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: (userIds: number[]) => setSectionAccess(sectionId, userIds),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "section-access", sectionId] }),
  });

  function toggle(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="ml-2 mt-2 space-y-2 rounded-md border border-slate-800 bg-slate-950/60 p-3">
      <p className="text-xs text-slate-400">
        {selected.size === 0
          ? "Public — visible to every signed-in user."
          : `Restricted to ${selected.size} user(s) below — including admins, who are only exempt from restrictions they've marked "Hidden".`}
      </p>
      <div className="flex flex-wrap gap-2">
        {users.map((u) => (
          <label
            key={u.id}
            className="flex items-center gap-1.5 rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-300"
          >
            <input type="checkbox" checked={selected.has(u.id)} onChange={() => toggle(u.id)} />
            {u.username}
            {u.role === "admin" && <span className="text-slate-500">(admin)</span>}
          </label>
        ))}
      </div>
      <button
        onClick={() => saveMutation.mutate([...selected])}
        disabled={saveMutation.isPending}
        className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-900 hover:bg-white disabled:opacity-50"
      >
        Save access
      </button>
    </div>
  );
}

function SectionsSection() {
  const queryClient = useQueryClient();
  const { data: sectionsData } = useQuery({ queryKey: ["sections"], queryFn: getSections });
  const { data: usersData } = useQuery({ queryKey: ["admin", "users"], queryFn: getUsers });
  const [newTitle, setNewTitle] = useState("");
  const [managingId, setManagingId] = useState<number | null>(null);

  const createMutation = useMutation({
    mutationFn: () => createSection(newTitle.trim()),
    onSuccess: () => {
      setNewTitle("");
      queryClient.invalidateQueries({ queryKey: ["sections"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteSection(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sections"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "all-courses"] });
    },
  });

  const hideMutation = useMutation({
    mutationFn: ({ id, hidden }: { id: number; hidden: boolean }) => setSectionHidden(id, hidden),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sections"] }),
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (newTitle.trim()) createMutation.mutate();
  }

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold text-slate-100">Sections</h2>
        <p className="text-sm text-slate-400">
          Sections are independent of your folder structure — create one, then assign courses into it below.
        </p>
      </div>
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder="e.g. Backend Development"
          className="flex-1 rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-slate-500"
        />
        <button
          type="submit"
          disabled={!newTitle.trim() || createMutation.isPending}
          className="rounded-md bg-slate-100 px-3 py-2 text-sm font-medium text-slate-900 hover:bg-white disabled:opacity-50"
        >
          Create
        </button>
      </form>
      <div className="space-y-2">
        {sectionsData?.sections.map((s) => (
          <div key={s.id} className="rounded-md border border-slate-800 bg-slate-900/60 p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <p className="text-sm text-slate-200">{s.title}</p>
                {s.hidden && (
                  <span className="rounded border border-amber-800 bg-amber-950/60 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-400">
                    Hidden
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => hideMutation.mutate({ id: s.id, hidden: !s.hidden })}
                  className="rounded-md border border-slate-700 px-2.5 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
                >
                  {s.hidden ? "Unhide" : "Hide"}
                </button>
                <button
                  onClick={() => setManagingId(managingId === s.id ? null : s.id)}
                  className="rounded-md border border-slate-700 px-2.5 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
                >
                  {managingId === s.id ? "Close" : "Access…"}
                </button>
                <button
                  onClick={() => deleteMutation.mutate(s.id)}
                  className="rounded-md border border-slate-700 px-2.5 py-1.5 text-xs text-slate-400 hover:bg-slate-800 hover:text-red-400"
                >
                  Delete
                </button>
              </div>
            </div>
            {s.hidden && (
              <p className="mt-1 text-xs text-slate-500">
                Hidden from everyone except admins, regardless of the access list below.
              </p>
            )}
            {managingId === s.id && <SectionAccessEditor sectionId={s.id} users={usersData?.users ?? []} />}
          </div>
        ))}
        {sectionsData?.sections.length === 0 && <p className="text-sm text-slate-500">No sections yet.</p>}
      </div>
    </section>
  );
}

function CourseAssignmentSection() {
  const queryClient = useQueryClient();
  const { data: coursesData } = useQuery({ queryKey: ["admin", "all-courses"], queryFn: getCourses });
  const { data: sectionsData } = useQuery({ queryKey: ["sections"], queryFn: getSections });

  function invalidateAfterChange() {
    queryClient.invalidateQueries({ queryKey: ["admin", "all-courses"] });
    queryClient.invalidateQueries({ queryKey: ["section-courses"] });
    queryClient.invalidateQueries({ queryKey: ["courses"] });
  }

  const assignMutation = useMutation({
    mutationFn: ({ courseId, sectionId }: { courseId: number; sectionId: number | null }) => assignCourseSection(courseId, sectionId),
    onSuccess: invalidateAfterChange,
  });

  const deleteMutation = useMutation({
    mutationFn: (courseId: number) => deleteCourse(courseId),
    onSuccess: invalidateAfterChange,
  });

  const hideMutation = useMutation({
    mutationFn: ({ courseId, hidden }: { courseId: number; hidden: boolean }) => setCourseHidden(courseId, hidden),
    onSuccess: invalidateAfterChange,
  });

  const courses = coursesData?.courses ?? [];
  const sectionTitleById = new Map(sectionsData?.sections.map((s) => [s.id, s.title]) ?? []);

  const grouped = new Map<string, typeof courses>();
  for (const course of courses) {
    const key = course.sectionId !== null ? (sectionTitleById.get(course.sectionId) ?? "Unassigned") : "Unassigned";
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(course);
  }
  // "Unassigned" first — that's what needs the admin's attention.
  const groupEntries = [...grouped.entries()].sort(([a], [b]) => (a === "Unassigned" ? -1 : b === "Unassigned" ? 1 : a.localeCompare(b)));

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold text-slate-100">Courses</h2>
        <p className="text-sm text-slate-400">
          Every scanned course, grouped by its current section. Newly scanned courses land in "Unassigned" until you sort them —
          delete a course here if a rescan produced a stale or incorrect one.
        </p>
      </div>
      {courses.length === 0 ? (
        <p className="text-sm text-slate-500">No courses scanned yet.</p>
      ) : (
        <div className="space-y-4">
          {groupEntries.map(([group, groupCourses]) => (
            <div key={group}>
              <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-slate-500">{group}</p>
              <div className="space-y-1.5">
                {groupCourses.map((course) => (
                  <div
                    key={course.id}
                    className="flex items-center justify-between rounded-md border border-slate-800 bg-slate-900/60 px-3 py-2"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm text-slate-200">{course.title}</p>
                        {course.hidden && (
                          <span className="shrink-0 rounded border border-amber-800 bg-amber-950/60 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-400">
                            Hidden
                          </span>
                        )}
                      </div>
                      {course.topLevelFolder && <p className="truncate text-xs text-slate-500">{course.topLevelFolder}</p>}
                    </div>
                    <button
                      onClick={() => hideMutation.mutate({ courseId: course.id, hidden: !course.hidden })}
                      className="ml-2 rounded-md border border-slate-700 px-2.5 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
                    >
                      {course.hidden ? "Unhide" : "Hide"}
                    </button>
                    <select
                      value={course.sectionId ?? ""}
                      onChange={(e) =>
                        assignMutation.mutate({ courseId: course.id, sectionId: e.target.value ? Number(e.target.value) : null })
                      }
                      className="ml-3 rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100 outline-none"
                    >
                      <option value="">Unassigned</option>
                      {sectionsData?.sections.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.title}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => {
                        if (confirm(`Delete "${course.title}"? This removes it and all its progress/notes permanently.`)) {
                          deleteMutation.mutate(course.id);
                        }
                      }}
                      className="ml-2 rounded-md border border-slate-700 px-2.5 py-1.5 text-xs text-slate-400 hover:bg-slate-800 hover:text-red-400"
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
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
        <SectionsSection />
        <CourseAssignmentSection />
        <MissingFilesSection />
        <UsersSection />
      </div>
    </PageContainer>
  );
}
