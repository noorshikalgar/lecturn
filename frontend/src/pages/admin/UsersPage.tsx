import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Activity, MoreVertical, Pencil, ShieldCheck, ShieldOff, Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { Avatar } from "../../components/avatars/Avatar";
import { AvatarPicker } from "../../components/avatars/AvatarPicker";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "../../components/ui/dropdown-menu";
import { changeUsername, createUser, deleteUser, getUsers, resetUserPassword, updateUserProfile, updateUserRole } from "../../lib/api/admin";
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
  const [pendingUsernameChange, setPendingUsernameChange] = useState<{ id: string; oldUsername: string; newUsername: string } | null>(
    null,
  );
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
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Failed to update role"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteUser(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      // A deleted user's rows in section_access disappear server-side too —
      // any section-access editor open elsewhere is now showing a stale grant.
      queryClient.invalidateQueries({ queryKey: ["admin", "section-access"] });
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Failed to delete user"),
  });

  const usernameMutation = useMutation({
    mutationFn: ({ id, username }: { id: string; username: string }) => changeUsername(id, username),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      toast.success(`Username changed to "${res.user.username}". This can't be done again for this account.`);
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Failed to change username"),
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

  const selectedUsers = data?.users.filter((u) => selected.has(u.id)) ?? [];
  const canPromote = selectedUsers.some((u) => u.role !== "admin");
  const canDemote = selectedUsers.some((u) => u.role === "admin");

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
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
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
                disabled={bulkBusy || !canPromote}
                className="rounded-md border border-border px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted disabled:opacity-50"
              >
                Promote {selected.size} to admin
              </button>
              <button
                onClick={() => bulkSetRole("user")}
                disabled={bulkBusy || !canDemote}
                className="rounded-md border border-border px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted disabled:opacity-50"
              >
                Set {selected.size} to user
              </button>
            </div>
          )}
        </div>
      )}
      {bulkError && <p className="text-sm text-destructive">{bulkError}</p>}

      {filter.trim() && visibleUsers.length === 0 && (
        <p className="text-sm text-muted-foreground">No users match "{filter}".</p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visibleUsers.map((u) => {
          const displayName = u.firstName ? `${u.firstName} ${u.lastName ?? ""}`.trim() : u.username;
          return (
            <div
              key={u.id}
              className="rounded-xl border border-border bg-card p-5 transition-colors hover:border-ring/40"
            >
              <div className="flex items-start justify-between gap-2">
                <input
                  type="checkbox"
                  checked={selected.has(u.id)}
                  onChange={() => toggleSelected(u.id)}
                  aria-label={`Select ${u.username}`}
                  className="mt-0.5"
                />
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                    u.role === "admin" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                  }`}
                >
                  {u.role}
                </span>
              </div>

              <div className="mt-2 flex flex-col items-center text-center">
                <Avatar avatarId={u.avatarId} username={u.username} size={56} className="ring-1 ring-border" />
                <p className="mt-3 text-[15px] font-semibold leading-tight text-foreground">{displayName}</p>
                {u.firstName && <p className="mt-0.5 font-mono text-xs text-muted-foreground">{u.username}</p>}
              </div>

              <div className="mt-4 flex items-center gap-2 border-t border-border pt-3">
                <Link
                  to={`/admin/users/${u.id}/activity`}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-border py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <Activity size={13} />
                  Activity
                </Link>
                <button
                  onClick={() => setEditingId(editingId === u.id ? null : u.id)}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-md border py-1.5 text-xs font-medium transition-colors ${
                    editingId === u.id
                      ? "border-ring bg-muted text-foreground"
                      : "border-border text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <Pencil size={13} />
                  {editingId === u.id ? "Close" : "Edit"}
                </button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      title="More actions"
                      aria-label={`More actions for ${u.username}`}
                      className="shrink-0 rounded-md border border-border p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                      <MoreVertical size={14} />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={() => roleMutation.mutate({ id: u.id, role: u.role === "admin" ? "user" : "admin" })}
                      disabled={roleMutation.isPending}
                    >
                      {u.role === "admin" ? <ShieldOff size={14} /> : <ShieldCheck size={14} />}
                      {u.role === "admin" ? "Remove admin" : "Promote to admin"}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => {
                        const pw = prompt(`New password for ${u.username} (min 8 chars):`);
                        if (pw && pw.length >= 8) resetPasswordMutation.mutate({ id: u.id, password: pw });
                        else if (pw) toast.error("Password must be at least 8 characters.");
                      }}
                      disabled={resetPasswordMutation.isPending}
                    >
                      Reset password
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={() => setPendingDelete({ id: u.id, username: u.username })}
                    >
                      <Trash2 size={14} />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {editingId === u.id && (
                <EditUserForm
                  userId={u.id}
                  username={u.username}
                  usernameChangeAvailable={u.usernameChangeAvailable}
                  initialFirstName={u.firstName ?? ""}
                  initialLastName={u.lastName ?? ""}
                  initialEmail={u.email ?? ""}
                  initialAvatarId={u.avatarId}
                  onSave={(patch) => editMutation.mutate({ id: u.id, patch })}
                  saving={editMutation.isPending}
                  onRequestUsernameChange={(newUsername) => setPendingUsernameChange({ id: u.id, oldUsername: u.username, newUsername })}
                  usernameSaving={usernameMutation.isPending}
                />
              )}
            </div>
          );
        })}
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
      {pendingUsernameChange && (
        <ConfirmDialog
          title="Change username"
          message={`Change "${pendingUsernameChange.oldUsername}" to "${pendingUsernameChange.newUsername}"? This account gets exactly one username change, ever — it can't be undone or repeated.`}
          confirmLabel="Change username"
          onCancel={() => setPendingUsernameChange(null)}
          onConfirm={() => {
            usernameMutation.mutate({ id: pendingUsernameChange.id, username: pendingUsernameChange.newUsername });
            setPendingUsernameChange(null);
          }}
        />
      )}
    </div>
  );
}

function EditUserForm({
  userId,
  username,
  usernameChangeAvailable,
  initialFirstName,
  initialLastName,
  initialEmail,
  initialAvatarId,
  onSave,
  saving,
  onRequestUsernameChange,
  usernameSaving,
}: {
  userId: string;
  username: string;
  usernameChangeAvailable: boolean;
  initialFirstName: string;
  initialLastName: string;
  initialEmail: string;
  initialAvatarId: number | null;
  onSave: (patch: { firstName: string; lastName: string; email: string | null; avatarId: number | null }) => void;
  saving: boolean;
  onRequestUsernameChange: (newUsername: string) => void;
  usernameSaving: boolean;
}) {
  const [firstName, setFirstName] = useState(initialFirstName);
  const [lastName, setLastName] = useState(initialLastName);
  const [email, setEmail] = useState(initialEmail);
  const [avatarId, setAvatarId] = useState<number | null>(initialAvatarId);
  const [changingUsername, setChangingUsername] = useState(false);
  const [newUsername, setNewUsername] = useState("");

  return (
    <div className="mt-4 space-y-4 border-t border-border pt-4" key={userId}>
      <div className="space-y-1.5">
        <p className="text-xs font-medium text-muted-foreground">Username</p>
        {!usernameChangeAvailable ? (
          <p className="rounded-md border border-transparent bg-muted/50 px-3 py-2 font-mono text-sm text-muted-foreground">
            {username} <span className="font-sans text-xs">— locked, already used its one-time change</span>
          </p>
        ) : changingUsername ? (
          <div className="flex gap-2">
            <input
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              placeholder="New username"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-ring"
            />
            <button
              onClick={() => onRequestUsernameChange(newUsername.trim())}
              disabled={newUsername.trim().length < 3 || newUsername.trim() === username || usernameSaving}
              className="shrink-0 rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              Confirm
            </button>
            <button
              onClick={() => setChangingUsername(false)}
              className="shrink-0 rounded-md border border-border px-3 py-2 text-xs text-muted-foreground hover:bg-muted"
            >
              Cancel
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2 rounded-md border border-border bg-background px-3 py-2">
            <span className="font-mono text-sm text-foreground">{username}</span>
            <button
              onClick={() => {
                setNewUsername(username);
                setChangingUsername(true);
              }}
              className="shrink-0 text-xs font-medium text-primary hover:underline"
            >
              Change (one-time)
            </button>
          </div>
        )}
      </div>

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
        disabled={
          !firstName.trim() ||
          !lastName.trim() ||
          saving ||
          (firstName.trim() === initialFirstName &&
            lastName.trim() === initialLastName &&
            (email.trim() || null) === (initialEmail || null) &&
            avatarId === initialAvatarId)
        }
        className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        Save
      </button>
    </div>
  );
}
