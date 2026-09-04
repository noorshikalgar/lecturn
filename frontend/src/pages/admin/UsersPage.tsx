import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from "@tanstack/react-table";
import type { AdminUserSummary } from "@lecturn/shared";
import {
  Activity,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  MoreVertical,
  Pencil,
  Search,
  ShieldCheck,
  ShieldOff,
  Trash2,
  UserPlus,
  X,
} from "lucide-react";
import { Fragment, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { Avatar } from "../../components/avatars/Avatar";
import { AvatarPicker } from "../../components/avatars/AvatarPicker";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "../../components/ui/dropdown-menu";
import { changeUsername, createUser, deleteUser, getUsers, resetUserPassword, updateUserProfile, updateUserRole } from "../../lib/api/admin";
import { ApiError } from "../../lib/apiClient";
import { useAuth } from "../../lib/AuthContext";
import { useLockBodyScroll } from "../../lib/useLockBodyScroll";
import { toast } from "../../lib/toast";

const columnHelper = createColumnHelper<AdminUserSummary>();

export function UsersPage() {
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();
  const { data } = useQuery({ queryKey: ["admin", "users"], queryFn: getUsers });
  const [roleFilter, setRoleFilter] = useState<"all" | "admin" | "user">("all");
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
  const [sorting, setSorting] = useState<SortingState>([]);

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

  const allUsers = data?.users ?? [];
  const adminCount = allUsers.filter((u) => u.role === "admin").length;
  const userCount = allUsers.length - adminCount;

  const visibleUsers = allUsers
    .filter((u) => roleFilter === "all" || u.role === roleFilter)
    .filter((u) => {
      if (!filter.trim()) return true;
      const q = filter.trim().toLowerCase();
      const name = u.firstName ? `${u.firstName} ${u.lastName ?? ""}`.trim().toLowerCase() : "";
      return u.username.toLowerCase().includes(q) || name.includes(q) || (u.email?.toLowerCase().includes(q) ?? false);
    });

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

  const columns = useMemo(
    () => [
      columnHelper.display({
        id: "select",
        header: () => <input type="checkbox" checked={allVisibleSelected} onChange={toggleSelectAll} aria-label="Select all" />,
        cell: (info) => (
          <input
            type="checkbox"
            checked={selected.has(info.row.original.id)}
            onChange={() => toggleSelected(info.row.original.id)}
            aria-label={`Select ${info.row.original.username}`}
          />
        ),
      }),
      columnHelper.accessor((u) => (u.firstName ? `${u.firstName} ${u.lastName ?? ""}`.trim() : u.username), {
        id: "user",
        header: "User",
        cell: (info) => {
          const u = info.row.original;
          const isSelf = currentUser?.id === u.id;
          return (
            <div className="flex items-center gap-2.5">
              <Avatar avatarId={u.avatarId} username={u.username} size={36} className="ring-1 ring-border" />
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-medium text-foreground">{info.getValue()}</span>
                  {isSelf && (
                    <span className="shrink-0 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                      You
                    </span>
                  )}
                </div>
                <p className="font-mono text-xs text-muted-foreground">@{u.username}</p>
              </div>
            </div>
          );
        },
      }),
      columnHelper.accessor("role", {
        header: "Role",
        cell: (info) => (
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
              info.getValue() === "admin" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
            }`}
          >
            {info.getValue()}
          </span>
        ),
      }),
      columnHelper.accessor("online", {
        header: "Status",
        cell: (info) => (
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
            <span className={`size-1.5 rounded-full ${info.getValue() ? "bg-emerald-500" : "bg-muted-foreground/40"}`} />
            <span className={info.getValue() ? "font-medium text-emerald-600" : "text-muted-foreground"}>
              {info.getValue() ? "Online" : "Offline"}
            </span>
          </span>
        ),
      }),
      columnHelper.accessor("lastSeenAt", {
        header: "Last active",
        cell: (info) => <span className="whitespace-nowrap text-muted-foreground">{info.getValue() ? new Date(info.getValue()!).toLocaleString() : "—"}</span>,
        sortUndefined: "last",
      }),
      columnHelper.accessor("lastLoginAt", {
        header: "Last login",
        cell: (info) => <span className="whitespace-nowrap text-muted-foreground">{info.getValue() ? new Date(info.getValue()!).toLocaleString() : "—"}</span>,
        sortUndefined: "last",
      }),
      columnHelper.accessor("createdAt", {
        header: "Created",
        cell: (info) => <span className="whitespace-nowrap text-muted-foreground">{new Date(info.getValue()).toLocaleDateString()}</span>,
      }),
      columnHelper.accessor("email", {
        header: "Email",
        cell: (info) => <span className="text-muted-foreground">{info.getValue() ?? "—"}</span>,
        sortUndefined: "last",
      }),
      columnHelper.display({
        id: "actions",
        header: () => <span className="block text-right">Actions</span>,
        cell: (info) => {
          const u = info.row.original;
          const isSelf = currentUser?.id === u.id;
          return (
            <div className="flex items-center justify-end gap-1.5">
              <Link
                to={`/admin/users/${u.id}/activity`}
                title="Activity"
                aria-label={`Activity for ${u.username}`}
                className="rounded-md border border-border p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <Activity size={14} />
              </Link>
              <button
                onClick={() => setEditingId(editingId === u.id ? null : u.id)}
                title="Edit"
                aria-label={`Edit ${u.username}`}
                className={`rounded-md border p-1.5 transition-colors ${
                  editingId === u.id
                    ? "border-ring bg-muted text-foreground"
                    : "border-border text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <Pencil size={14} />
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
                  {/* Never offered for your own account — deleting yourself is
                      always rejected server-side (cannot_delete_self), so
                      showing it here would just be a button that always fails. */}
                  {!isSelf && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem variant="destructive" onClick={() => setPendingDelete({ id: u.id, username: u.username })}>
                        <Trash2 size={14} />
                        Delete
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        },
      }),
    ],
    // Deliberately depends on the mutable bits used inside cell/header
    // renderers (selection state, who's editing, the current user) rather
    // than trying to keep this list stable — TanStack Table recomputes rows
    // from `data`+`columns` every render regardless, so memoizing harder
    // here would just risk stale closures over selected/editingId for no
    // real performance win at this table's realistic size.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selected, editingId, currentUser?.id, allVisibleSelected, roleMutation, resetPasswordMutation],
  );

  const table = useReactTable({
    data: visibleUsers,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getRowId: (row) => row.id,
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Users</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage accounts and roles.</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
        >
          <UserPlus size={14} />
          New User
        </button>
      </div>

      {showForm && (
        <NewUserDialog
          firstName={firstName}
          lastName={lastName}
          username={username}
          email={email}
          password={password}
          role={role}
          avatarId={avatarId}
          error={error}
          creating={createMutation.isPending}
          onFirstNameChange={setFirstName}
          onLastNameChange={setLastName}
          onUsernameChange={setUsername}
          onEmailChange={setEmail}
          onPasswordChange={setPassword}
          onRoleChange={setRole}
          onAvatarIdChange={setAvatarId}
          onSubmit={handleSubmit}
          onClose={() => {
            setShowForm(false);
            setError(null);
          }}
        />
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-64">
          <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Search by name, username, or email"
            className="w-full rounded-md border border-border bg-background py-2 pl-8 pr-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-ring"
          />
        </div>

        <div className="flex shrink-0 gap-1 rounded-md border border-border bg-card/60 p-1">
          {(
            [
              ["all", `All (${allUsers.length})`],
              ["admin", `Admins (${adminCount})`],
              ["user", `Users (${userCount})`],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setRoleFilter(key)}
              className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                roleFilter === key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {selected.size > 0 && <span className="text-xs text-muted-foreground">{selected.size} selected</span>}
          <button
            onClick={() => bulkSetRole("admin")}
            disabled={bulkBusy || selected.size < 2 || !canPromote}
            className="rounded-md border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
          >
            Promote to admin
          </button>
          <button
            onClick={() => bulkSetRole("user")}
            disabled={bulkBusy || selected.size < 2 || !canDemote}
            className="rounded-md border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
          >
            Set to user
          </button>
        </div>

        <span className="shrink-0 whitespace-nowrap text-xs text-muted-foreground sm:ml-auto">
          {visibleUsers.length !== allUsers.length ? `Showing ${visibleUsers.length} of ${allUsers.length} users` : `${allUsers.length} users`}
        </span>
      </div>

      {bulkError && <p className="text-sm text-destructive">{bulkError}</p>}

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[960px] text-sm">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr
                key={headerGroup.id}
                className="border-b border-border bg-muted/40 text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground"
              >
                {headerGroup.headers.map((header) => {
                  const sortDirection = header.column.getIsSorted();
                  return (
                    <th key={header.id} className={`px-3 py-2.5 ${header.column.id === "select" ? "w-10" : ""}`}>
                      {header.isPlaceholder ? null : header.column.getCanSort() ? (
                        <button
                          onClick={header.column.getToggleSortingHandler()}
                          className="inline-flex items-center gap-1 hover:text-foreground"
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {sortDirection === "asc" ? (
                            <ArrowUp size={12} />
                          ) : sortDirection === "desc" ? (
                            <ArrowDown size={12} />
                          ) : (
                            <ArrowUpDown size={12} className="opacity-40" />
                          )}
                        </button>
                      ) : (
                        flexRender(header.column.columnDef.header, header.getContext())
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-border">
            {table.getRowModel().rows.map((row) => (
              <Fragment key={row.id}>
                <tr className="transition-colors hover:bg-muted/30">
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-3 py-3 align-top">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
                {editingId === row.original.id && (
                  <tr>
                    <td colSpan={columns.length} className="border-t border-border bg-muted/20 px-4 py-4">
                      <EditUserForm
                        userId={row.original.id}
                        username={row.original.username}
                        usernameChangeAvailable={row.original.usernameChangeAvailable}
                        initialFirstName={row.original.firstName ?? ""}
                        initialLastName={row.original.lastName ?? ""}
                        initialEmail={row.original.email ?? ""}
                        initialAvatarId={row.original.avatarId}
                        onSave={(patch) => editMutation.mutate({ id: row.original.id, patch })}
                        saving={editMutation.isPending}
                        onRequestUsernameChange={(newUsername) =>
                          setPendingUsernameChange({ id: row.original.id, oldUsername: row.original.username, newUsername })
                        }
                        usernameSaving={usernameMutation.isPending}
                      />
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
        {visibleUsers.length === 0 && (
          <p className="px-4 py-6 text-center text-sm text-muted-foreground">
            {filter.trim() ? `No users match "${filter}".` : "No users."}
          </p>
        )}
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

function NewUserDialog({
  firstName,
  lastName,
  username,
  email,
  password,
  role,
  avatarId,
  error,
  creating,
  onFirstNameChange,
  onLastNameChange,
  onUsernameChange,
  onEmailChange,
  onPasswordChange,
  onRoleChange,
  onAvatarIdChange,
  onSubmit,
  onClose,
}: {
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  password: string;
  role: "admin" | "user";
  avatarId: number | null;
  error: string | null;
  creating: boolean;
  onFirstNameChange: (v: string) => void;
  onLastNameChange: (v: string) => void;
  onUsernameChange: (v: string) => void;
  onEmailChange: (v: string) => void;
  onPasswordChange: (v: string) => void;
  onRoleChange: (v: "admin" | "user") => void;
  onAvatarIdChange: (v: number | null) => void;
  onSubmit: (e: FormEvent) => void;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const firstFieldRef = useRef<HTMLInputElement>(null);

  useLockBodyScroll();

  useEffect(() => {
    firstFieldRef.current?.focus();

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key === "Tab" && dialogRef.current) {
        const focusable = dialogRef.current.querySelectorAll<HTMLElement>("input, button:not(:disabled)");
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const canSubmit = username.trim() && firstName.trim() && lastName.trim() && password.length >= 8 && !creating;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-8" onClick={onClose}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-user-title"
        className="flex max-h-full w-full max-w-md flex-col overflow-hidden rounded-lg border border-border bg-card shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <UserPlus size={16} />
            </div>
            <div>
              <h2 id="new-user-title" className="text-sm font-semibold text-foreground">
                New User
              </h2>
              <p className="text-xs text-muted-foreground">Create an account and set their role.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={onSubmit} className="flex-1 overflow-y-auto px-5 py-4">
          <div className="space-y-5">
            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Account</p>
              <AvatarPicker value={avatarId} onChange={onAvatarIdChange} username={firstName || username || "?"} />
              <div className="grid gap-2 sm:grid-cols-2">
                <input
                  ref={firstFieldRef}
                  value={firstName}
                  onChange={(e) => onFirstNameChange(e.target.value)}
                  placeholder="First name"
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-ring"
                />
                <input
                  value={lastName}
                  onChange={(e) => onLastNameChange(e.target.value)}
                  placeholder="Last name"
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-ring"
                />
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <input
                  value={username}
                  onChange={(e) => onUsernameChange(e.target.value)}
                  placeholder="Username"
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-ring"
                />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => onEmailChange(e.target.value)}
                  placeholder="Email (optional)"
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-ring"
                />
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Security</p>
              <input
                type="password"
                value={password}
                onChange={(e) => onPasswordChange(e.target.value)}
                placeholder="Password"
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-ring"
              />
              <p className="text-xs text-muted-foreground">Minimum 8 characters. They can change it later from their own profile.</p>
            </div>

            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Permissions</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => onRoleChange("user")}
                  aria-pressed={role === "user"}
                  className={`rounded-md border px-3 py-2 text-left transition-colors ${
                    role === "user" ? "border-primary bg-primary/5" : "border-border hover:bg-muted"
                  }`}
                >
                  <p className={`text-sm font-medium ${role === "user" ? "text-primary" : "text-foreground"}`}>User</p>
                  <p className="text-xs text-muted-foreground">Can access the courses shared with them.</p>
                </button>
                <button
                  type="button"
                  onClick={() => onRoleChange("admin")}
                  aria-pressed={role === "admin"}
                  className={`rounded-md border px-3 py-2 text-left transition-colors ${
                    role === "admin" ? "border-primary bg-primary/5" : "border-border hover:bg-muted"
                  }`}
                >
                  <p className={`text-sm font-medium ${role === "admin" ? "text-primary" : "text-foreground"}`}>Admin</p>
                  <p className="text-xs text-muted-foreground">Full library, section, and user management.</p>
                </button>
              </div>
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>

          <div className="mt-5 flex justify-end gap-2 border-t border-border pt-4">
            <button type="button" onClick={onClose} className="rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted">
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              Create user
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
