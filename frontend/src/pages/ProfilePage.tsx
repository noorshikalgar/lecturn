import { useMutation } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { AvatarPicker } from "../components/avatars/AvatarPicker";
import { useAuth } from "../lib/AuthContext";
import { changeOwnPassword, updateOwnProfile } from "../lib/api/me";
import { ApiError } from "../lib/apiClient";
import { toast } from "../lib/toast";

export function ProfilePage() {
  const { user, setUser, logout } = useAuth();
  const [firstName, setFirstName] = useState(user?.firstName ?? "");
  const [lastName, setLastName] = useState(user?.lastName ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [avatarId, setAvatarId] = useState<number | null>(user?.avatarId ?? null);
  const [profileError, setProfileError] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const profileMutation = useMutation({
    mutationFn: () => updateOwnProfile({ firstName: firstName.trim(), lastName: lastName.trim(), email: email.trim() || null, avatarId }),
    onSuccess: (res) => {
      setUser(res.user);
      toast.success("Profile updated.");
    },
  });

  const passwordMutation = useMutation({
    mutationFn: () => changeOwnPassword(currentPassword, newPassword),
    onSuccess: () => {
      toast.success("Password changed. Please sign in again.");
      logout();
    },
  });

  if (!user) return null;

  function handleProfileSubmit(e: FormEvent) {
    e.preventDefault();
    setProfileError(null);
    profileMutation.mutate(undefined, {
      onError: (err) => setProfileError(err instanceof ApiError ? err.message : "Failed to update profile"),
    });
  }

  function handlePasswordSubmit(e: FormEvent) {
    e.preventDefault();
    setPasswordError(null);
    passwordMutation.mutate(undefined, {
      onError: (err) => setPasswordError(err instanceof ApiError ? err.message : "Failed to change password"),
    });
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Profile</h1>
        <p className="mt-1 text-sm text-muted-foreground">Manage your account details.</p>
      </div>

      <form onSubmit={handleProfileSubmit} className="space-y-4 rounded-lg border border-border bg-card p-4">
        <div className="space-y-1">
          <label className="text-sm text-muted-foreground">Username</label>
          <p className="rounded-md border border-transparent bg-muted/50 px-3 py-2 text-sm text-muted-foreground">{user.username}</p>
        </div>

        <div className="space-y-1">
          <label className="text-sm text-muted-foreground">Avatar</label>
          <AvatarPicker value={avatarId} onChange={setAvatarId} username={user.username} />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <label className="text-sm text-muted-foreground" htmlFor="firstName">
              First name
            </label>
            <input
              id="firstName"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-ring"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm text-muted-foreground" htmlFor="lastName">
              Last name
            </label>
            <input
              id="lastName"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-ring"
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-sm text-muted-foreground" htmlFor="email">
            Email <span className="text-xs">(optional)</span>
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-ring"
          />
        </div>

        {profileError && <p className="text-sm text-destructive">{profileError}</p>}
        <button
          type="submit"
          disabled={!firstName.trim() || !lastName.trim() || profileMutation.isPending}
          className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
        >
          Save profile
        </button>
      </form>

      <form onSubmit={handlePasswordSubmit} className="space-y-3 rounded-lg border border-border bg-card p-4">
        <h2 className="text-sm font-medium text-foreground">Change password</h2>
        <div className="space-y-1">
          <label className="text-sm text-muted-foreground" htmlFor="currentPassword">
            Current password
          </label>
          <input
            id="currentPassword"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-ring"
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm text-muted-foreground" htmlFor="newPassword">
            New password <span className="text-xs">(min 8 chars)</span>
          </label>
          <input
            id="newPassword"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-ring"
          />
        </div>
        {passwordError && <p className="text-sm text-destructive">{passwordError}</p>}
        <button
          type="submit"
          disabled={!currentPassword || newPassword.length < 8 || passwordMutation.isPending}
          className="rounded-md border border-border px-3 py-2 text-sm font-medium text-foreground transition hover:bg-muted disabled:opacity-60"
        >
          Change password
        </button>
        <p className="text-xs text-muted-foreground">Changing your password signs you out everywhere, including this session.</p>
      </form>
    </div>
  );
}
