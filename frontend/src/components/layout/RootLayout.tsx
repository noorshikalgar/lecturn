import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../../lib/AuthContext";

function navClass({ isActive }: { isActive: boolean }) {
  return `rounded-md px-3 py-1.5 text-sm transition ${
    isActive ? "bg-slate-800 text-slate-50" : "text-slate-400 hover:text-slate-100"
  }`;
}

export function RootLayout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();

  return (
    <div className="flex h-dvh flex-col">
      <header className="flex shrink-0 items-center justify-between border-b border-slate-800 bg-slate-950/90 px-6 py-3 backdrop-blur">
        <div className="flex items-center gap-6">
          <span className="text-sm font-semibold tracking-wide text-slate-50">Lecturn</span>
          <nav className="flex items-center gap-1">
            <NavLink to="/" end className={navClass}>
              Home
            </NavLink>
            <NavLink to="/paths" className={navClass}>
              Paths
            </NavLink>
            {user?.role === "admin" && (
              <NavLink to="/admin" className={navClass}>
                Admin
              </NavLink>
            )}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-400">{user?.username}</span>
          <button
            onClick={() => logout()}
            className="rounded-md px-3 py-1.5 text-sm text-slate-400 transition hover:text-slate-100"
          >
            Sign out
          </button>
        </div>
      </header>
      <main className="min-h-0 flex-1">{children}</main>
    </div>
  );
}
