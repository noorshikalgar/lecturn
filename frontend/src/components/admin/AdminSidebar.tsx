import { Activity, FolderTree, Rows3, Users as UsersIcon } from "lucide-react";
import { NavLink } from "react-router-dom";

function itemClass({ isActive }: { isActive: boolean }) {
  return `flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition ${
    isActive ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-card hover:text-foreground"
  }`;
}

function mobileItemClass({ isActive }: { isActive: boolean }) {
  return `flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition ${
    isActive ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-card hover:text-foreground"
  }`;
}

const ITEMS = [
  { to: "/admin/libraries", label: "Libraries", Icon: FolderTree },
  { to: "/admin/sections", label: "Sections", Icon: Rows3 },
  { to: "/admin/users", label: "Users", Icon: UsersIcon },
  { to: "/admin/activity", label: "Activity", Icon: Activity },
];

export function AdminSidebar() {
  return (
    <>
      {/* Mobile: horizontal scrollable tab row instead of a squeezed
          vertical column that would eat most of the screen width. */}
      <nav className="flex shrink-0 gap-1 overflow-x-auto border-b border-border bg-background/60 p-2 md:hidden">
        {ITEMS.map(({ to, label, Icon }) => (
          <NavLink key={to} to={to} className={mobileItemClass}>
            <Icon size={15} />
            {label}
          </NavLink>
        ))}
      </nav>

      <aside className="hidden w-56 shrink-0 flex-col gap-1 border-r border-border bg-background/60 p-3 md:flex">
        <p className="px-3 pb-2 pt-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Admin</p>
        {ITEMS.map(({ to, label, Icon }) => (
          <NavLink key={to} to={to} className={itemClass}>
            <Icon size={16} />
            {label}
          </NavLink>
        ))}
      </aside>
    </>
  );
}
