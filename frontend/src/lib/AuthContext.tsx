import type { User } from "@lecturn/shared";
import { useQueryClient } from "@tanstack/react-query";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api, ApiError } from "./apiClient";
import { describeError, toast } from "./toast";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const queryClient = useQueryClient();

  useEffect(() => {
    api
      .get<{ user: User }>("/auth/me")
      .then((res) => setUser(res.user))
      .catch((err) => {
        setUser(null);
        // A 401 here just means "not signed in yet" — the normal case for
        // every logged-out visitor, not worth a toast. Anything else (the
        // server unreachable, a 500) is a real problem masquerading as a
        // plain login screen, so say so.
        if (!(err instanceof ApiError) || err.status !== 401) {
          toast.error(describeError(err));
        }
      })
      .finally(() => setLoading(false));
  }, []);

  async function login(username: string, password: string) {
    const res = await api.post<{ user: User }>("/auth/login", { username, password });
    setUser(res.user);
    queryClient.clear();
  }

  async function logout() {
    try {
      await api.post("/auth/logout");
    } catch (err) {
      // The user still means to be logged out locally even if the network
      // call to invalidate the session failed — clear local state below
      // regardless, but say the server-side session may still be live.
      toast.error(`Signed out locally, but ${describeError(err).toLowerCase()}`);
    }
    setUser(null);
    queryClient.clear();
  }

  return <AuthContext.Provider value={{ user, loading, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
