import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { Avatar } from "../../components/avatars/Avatar";
import { AvatarPicker } from "../../components/avatars/AvatarPicker";
import { createUser, deleteUser, getUsers, resetUserPassword, updateUserProfile, updateUserRole } from "../../lib/api/admin";
import { ApiError } from "../../lib/apiClient";
import { toast } from "../../lib/toast";

export function UsersPage() {
  const queryClient = useQueryClient();
  const { data } = useQuery({ queryKey: ["admin", "users"], queryFn: getUsers });
  const [showForm, setShowForm] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"admin" | "user">("user");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [avatarId, setAvatarId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{ id: string; username: string } | null>(null);
  const [filter, setFilter] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: () =>
      createUser(username.trim(), password, role, { firstName: firstName.trim(), lastName: lastName.trim(), email: email.trim() || null, avatarId }),
    onSuccess: () => {
      setUsername("");
      setPassword("");
      setRole("user");
      setFirstName("");
      setLastName("");
      setEmail("");
      setAvatarId(null);
      setShowForm(false);
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
    },
  });

  const editMutation = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Parameters<typeof updateUserProfile>[1] }) => updateUserProfile(id, patch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      setEditingId(null);
      toast.success("Profile updated.");
    },
  });

  const roleMutation = useMutation({
    mutationFn: ({ id, role }: { id: string; role: "admin" | "user" }) => updateUserRole(id, role),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "users"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteUser(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      // A deleted user's rows in section_access disappear server-side too —
      // any section-access editor open elsewhere is now showing a stale grant.
      queryClient.invalidateQueries({ queryKey: ["admin", "section-access"] });
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: ({ id, password }: { id: string; password: string }) => resetUserPassword(id, password),
    onSuccess: (_data, { id }) => {
      const username = data?.users.find((u) => u.id === id)?.username ?? "user";
      toast.success(`Password reset for ${username}.`);
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    createMutation.mutate(undefined, {
      onError: (err) => setError(err instanceof ApiError ? err.message : "Failed to create user"),
    });
  }

  const visibleUsers = filter.trim()
    ? (data?.users.filter((u) => u.username.toLowerCase().includes(filter.trim().toLowerCase())) ?? [])
    : (data?.users ?? []);

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const allVisibleSelected = visibleUsers.length > 0 && visibleUsers.every((u) => selected.has(u.id));
  function toggleSelectAll() {
    setSelected(allVisibleSelected ? new Set() : new Set(visibleUsers.map((u) => u.id)));
  }

  async function bulkSetRole(targetRole: "admin" | "user") {
    setBulkError(null);
    setBulkBusy(true);
    try {
      const ids = [...selected].filter((id) => data?.users.find((u) => u.id === id)?.role !== targetRole);
      await Promise.all(ids.map((id) => roleMutation.mutateAsync({ id, role: targetRole })));
      setSelected(new Set());
    } catch {
      setBulkError("Some users failed to update — check above and retry.");
    } finally {
      setBulkBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Users</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage accounts and roles.</p>
        </div>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="rounded-md border border-border px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-muted"
        >
          {showForm ? "Cancel" : "New User"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border border-border bg-card p-4">
          <AvatarPicker value={avatarId} onChange={setAvatarId} username={username || "?"} />
          <div className="grid gap-2 sm:grid-cols-2">
            <input
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="First name"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-ring"
            />
            <input
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Last name"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-ring"
            />
          </div>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Username"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-ring"
          />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email (optional)"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-ring"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password (min 8 chars)"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-ring"
          />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as "admin" | "user")}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none"
          >
            <option value="user">User</option>
            <option value="admin">Admin</option>
          </select>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={!username.trim() || !firstName.trim() || !lastName.trim() || password.length < 8 || createMutation.isPending}
            className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            Create
          </button>
        </form>
      )}

      {data && data.users.length > 6 && (
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Search users…"
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-ring"
        />
      )}

      {visibleUsers.length > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-card/60 px-3 py-2">
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input type="checkbox" checked={allVisibleSelected} onChange={toggleSelectAll} />
            {selected.size > 0 ? `${selected.size} selected` : "Select all"}
          </label>
          {selected.size > 0 && (
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => bulkSetRole("admin")}
                disabled={bulkBusy}
                className="rounded-md border border-border px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted disabled:opacity-50"
              >
                Promote {selected.size} to admin
              </button>
              <button
                onClick={() => bulkSetRole("user")}
                disabled={bulkBusy}
                className="rounded-md border border-border px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted disabled:opacity-50"
              >
                Set {selected.size} to user
              </button>
            </div>
          )}
        </div>
      )}
      {bulkError && <p className="text-sm text-destructive">{bulkError}</p>}

      <div className="space-y-2">
        {filter.trim() && visibleUsers.length === 0 && (
          <p className="text-sm text-muted-foreground">No users match "{filter}".</p>
        )}
        {visibleUsers.map((u) => (
          <div key={u.id} className="rounded-md border border-border bg-card/60 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <input type="checkbox" checked={selected.has(u.id)} onChange={() => toggleSelected(u.id)} />
              <Avatar avatarId={u.avatarId} username={u.username} size={32} />
              <div>
                <p className="text-sm text-foreground">
                  {u.firstName ? `${u.firstName} ${u.lastName ?? ""}`.trim() : u.username}
                </p>
                <p className="text-xs text-muted-foreground">
                  {u.firstName ? u.username : ""} {u.firstName ? "· " : ""}
                  {u.role}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setEditingId(editingId === u.id ? null : u.id)}
                className="rounded-md border border-border px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-muted"
              >
                {editingId === u.id ? "Close" : "Edit"}
              </button>
              <button
                onClick={() => roleMutation.mutate({ id: u.id, role: u.role === "admin" ? "user" : "admin" })}
                disabled={roleMutation.isPending}
                className="rounded-md border border-border px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-muted disabled:opacity-50"
              >
                {u.role === "admin" ? "Remove admin" : "Promote to admin"}
              </button>
              <button
                onClick={() => {
                  const pw = prompt(`New password for ${u.username} (min 8 chars):`);
                  if (pw && pw.length >= 8) resetPasswordMutation.mutate({ id: u.id, password: pw });
                  else if (pw) toast.error("Password must be at least 8 characters.");
                }}
                disabled={resetPasswordMutation.isPending}
                className="rounded-md border border-border px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-muted disabled:opacity-50"
              >
                Reset password
              </button>
              <button
                onClick={() => setPendingDelete({ id: u.id, username: u.username })}
                title="Delete user"
                aria-label={`Delete ${u.username}`}
                className="rounded-md border border-border p-1.5 text-destructive hover:bg-destructive/10"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
          {editingId === u.id && (
            <EditUserForm
              userId={u.id}
              initialFirstName={u.firstName ?? ""}
              initialLastName={u.lastName ?? ""}
              initialEmail={u.email ?? ""}
              initialAvatarId={u.avatarId}
              onSave={(patch) => editMutation.mutate({ id: u.id, patch })}
              saving={editMutation.isPending}
            />
          )}
          </div>
        ))}
      </div>

      {pendingDelete && (
        <ConfirmDialog
          title="Delete user"
          message={`Delete "${pendingDelete.username}"? This can't be undone.`}
          confirmLabel="Delete"
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

function EditUserForm({
  userId,
  initialFirstName,
  initialLastName,
  initialEmail,
  initialAvatarId,
  onSave,
  saving,
}: {
  userId: string;
  initialFirstName: string;
  initialLastName: string;
  initialEmail: string;
  initialAvatarId: number | null;
  onSave: (patch: { firstName: string; lastName: string; email: string | null; avatarId: number | null }) => void;
  saving: boolean;
}) {
  const [firstName, setFirstName] = useState(initialFirstName);
  const [lastName, setLastName] = useState(initialLastName);
  const [email, setEmail] = useState(initialEmail);
  const [avatarId, setAvatarId] = useState<number | null>(initialAvatarId);

  return (
    <div className="mt-3 space-y-3 border-t border-border pt-3" key={userId}>
      <AvatarPicker value={avatarId} onChange={setAvatarId} username={firstName || "?"} />
      <div className="grid gap-2 sm:grid-cols-2">
        <input
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          placeholder="First name"
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-ring"
        />
        <input
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
          placeholder="Last name"
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-ring"
        />
      </div>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email (optional)"
        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-ring"
      />
      <button
        onClick={() => onSave({ firstName: firstName.trim(), lastName: lastName.trim(), email: email.trim() || null, avatarId })}
        disabled={!firstName.trim() || !lastName.trim() || saving}
        className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        Save
      </button>
    </div>
  );
}
