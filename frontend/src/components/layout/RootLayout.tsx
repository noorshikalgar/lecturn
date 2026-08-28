import { LayoutDashboard, LogOut, Menu, Search, X } from "lucide-react";
import { type ReactNode, useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { useAuth } from "../../lib/AuthContext";
import { applyTheme, loadTheme, THEMES, type ThemeKey } from "../../lib/theme";
import { Logo } from "../Logo";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "../ui/dropdown-menu";
import { CourseSearch } from "./CourseSearch";
import { ThemeMenu } from "./ThemeMenu";

function navClass({ isActive }: { isActive: boolean }) {
  return `rounded-md px-3 py-1.5 text-sm font-medium transition ${
    isActive ? "bg-secondary text-primary" : "text-muted-foreground hover:text-foreground"
  }`;
}

function mobileNavClass({ isActive }: { isActive: boolean }) {
  return `block rounded-md px-3 py-2 text-sm transition ${
    isActive ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-card hover:text-foreground"
  }`;
}

export function RootLayout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [mobileTheme, setMobileTheme] = useState<ThemeKey>(() => loadTheme());

  return (
    <div className="flex h-dvh flex-col">
      <header className="shrink-0 border-b border-border bg-card">
        <div className="flex items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-6">
            <span className="flex shrink-0 items-center gap-2 text-[16px] font-bold tracking-tight text-foreground">
              <Logo className="size-[22px]" />
              Lecturn
            </span>
            <nav className="hidden items-center gap-1 md:flex">
              <NavLink to="/" end className={navClass}>
                Home
              </NavLink>
              <NavLink to="/paths" className={navClass}>
                Paths
              </NavLink>
              {/* No "Admin" link here on desktop — it's one click away in the
                  profile menu below, and a second copy of the same link in
                  the header just doubles up for no reason. The mobile menu
                  keeps its own copy since it has no profile-menu equivalent. */}
            </nav>
          </div>

          <div className="mx-6 hidden flex-1 md:flex md:justify-center">
            <CourseSearch />
          </div>

          <div className="flex items-center gap-1 sm:gap-3">
            <ThemeMenu />
            {user?.username && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    aria-label={`Account menu for ${user.username}`}
                    className="hidden size-[30px] items-center justify-center rounded-full bg-secondary text-xs font-bold text-primary outline-none ring-ring focus-visible:ring-2 md:flex"
                  >
                    {user.username.charAt(0).toUpperCase()}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel className="font-normal">
                    <p className="truncate text-sm font-medium text-foreground">{user.username}</p>
                    <p className="text-xs text-muted-foreground">{user.role === "admin" ? "Admin" : "Member"}</p>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {user.role === "admin" && (
                    <DropdownMenuItem asChild>
                      <Link to="/admin">
                        <LayoutDashboard size={15} />
                        Admin panel
                      </Link>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={() => logout()}>
                    <LogOut size={15} />
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            <button
              onClick={() => {
                setMobileSearchOpen((o) => !o);
                setMenuOpen(false);
              }}
              aria-label={mobileSearchOpen ? "Close search" : "Search"}
              className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground md:hidden"
            >
              {mobileSearchOpen ? <X size={18} /> : <Search size={18} />}
            </button>
            <button
              onClick={() => {
                setMenuOpen((o) => !o);
                setMobileSearchOpen(false);
              }}
              aria-label={menuOpen ? "Close menu" : "Menu"}
              className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground md:hidden"
            >
              {menuOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>

        {mobileSearchOpen && (
          <div className="border-t border-border px-4 py-3 md:hidden">
            <CourseSearch onNavigate={() => setMobileSearchOpen(false)} />
          </div>
        )}

        {menuOpen && (
          <nav className="space-y-0.5 border-t border-border px-4 py-3 md:hidden">
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
            {/* No dropdown-in-a-dropdown on a touch menu — the same three
                themes render as a plain inline row instead of ThemeMenu. */}
            <div className="mt-2 border-t border-border px-3 pt-2">
              <p className="text-xs text-muted-foreground">Theme</p>
              <div className="mt-1.5 flex gap-1.5">
                {THEMES.map((t) => (
                  <button
                    key={t.key}
                    onClick={() => {
                      setMobileTheme(t.key);
                      applyTheme(t.key);
                    }}
                    className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                      mobileTheme === t.key ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-2 flex items-center justify-between border-t border-border pt-2">
              <span className="px-3 text-sm text-muted-foreground">{user?.username}</span>
              <button
                onClick={() => logout()}
                className="rounded-md px-3 py-1.5 text-sm text-muted-foreground transition hover:text-foreground"
              >
                Sign out
              </button>
            </div>
          </nav>
        )}
      </header>
      <main className="min-h-0 flex-1">{children}</main>
    </div>
  );
}
