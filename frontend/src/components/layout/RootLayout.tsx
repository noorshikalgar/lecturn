import { Menu, Search, X } from "lucide-react";
import { type ReactNode, useState } from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../../lib/AuthContext";
import { CourseSearch } from "./CourseSearch";
import { ThemeToggle } from "./ThemeToggle";

function navClass({ isActive }: { isActive: boolean }) {
  return `rounded-md px-3 py-1.5 text-sm transition ${
    isActive ? "bg-slate-800 text-slate-50" : "text-slate-400 hover:text-slate-100"
  }`;
}

function mobileNavClass({ isActive }: { isActive: boolean }) {
  return `block rounded-md px-3 py-2 text-sm transition ${
    isActive ? "bg-slate-800 text-slate-50" : "text-slate-400 hover:bg-slate-900 hover:text-slate-100"
  }`;
}

export function RootLayout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);

  return (
    <div className="flex h-dvh flex-col">
      <header className="shrink-0 border-b border-slate-800 bg-slate-950/90 backdrop-blur">
        <div className="flex items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-6">
            <span className="shrink-0 text-sm font-semibold tracking-wide text-slate-50">Lecturn</span>
            <nav className="hidden items-center gap-1 md:flex">
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

          <div className="mx-6 hidden flex-1 md:flex md:justify-center">
            <CourseSearch />
          </div>

          <div className="flex items-center gap-1 sm:gap-3">
            <span className="hidden text-sm text-slate-400 md:inline">{user?.username}</span>
            <div className="hidden md:block">
              <ThemeToggle />
            </div>
            <button
              onClick={() => logout()}
              className="hidden rounded-md px-3 py-1.5 text-sm text-slate-400 transition hover:text-slate-100 md:inline-block"
            >
              Sign out
            </button>
            <button
              onClick={() => {
                setMobileSearchOpen((o) => !o);
                setMenuOpen(false);
              }}
              title="Search"
              className="rounded-md p-2 text-slate-400 hover:bg-slate-800 hover:text-slate-100 md:hidden"
            >
              {mobileSearchOpen ? <X size={18} /> : <Search size={18} />}
            </button>
            <button
              onClick={() => {
                setMenuOpen((o) => !o);
                setMobileSearchOpen(false);
              }}
              title="Menu"
              className="rounded-md p-2 text-slate-400 hover:bg-slate-800 hover:text-slate-100 md:hidden"
            >
              {menuOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>

        {mobileSearchOpen && (
          <div className="border-t border-slate-800 px-4 py-3 md:hidden">
            <CourseSearch onNavigate={() => setMobileSearchOpen(false)} />
          </div>
        )}

        {menuOpen && (
          <nav className="space-y-0.5 border-t border-slate-800 px-4 py-3 md:hidden">
            <NavLink to="/" end className={mobileNavClass} onClick={() => setMenuOpen(false)}>
              Home
            </NavLink>
            <NavLink to="/paths" className={mobileNavClass} onClick={() => setMenuOpen(false)}>
              Paths
            </NavLink>
            {user?.role === "admin" && (
              <NavLink to="/admin" className={mobileNavClass} onClick={() => setMenuOpen(false)}>
                Admin
              </NavLink>
            )}
            <div className="mt-2 flex items-center justify-between border-t border-slate-800 pt-2">
              <span className="px-3 text-sm text-slate-400">{user?.username}</span>
              <div className="flex items-center gap-1">
                <ThemeToggle />
                <button
                  onClick={() => logout()}
                  className="rounded-md px-3 py-1.5 text-sm text-slate-400 transition hover:text-slate-100"
                >
                  Sign out
                </button>
              </div>
            </div>
          </nav>
        )}
      </header>
      <main className="min-h-0 flex-1">{children}</main>
    </div>
  );
}
