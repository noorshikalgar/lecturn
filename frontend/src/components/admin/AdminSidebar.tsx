import { FolderTree, Rows3, Users as UsersIcon } from "lucide-react";
import { NavLink } from "react-router-dom";

function itemClass({ isActive }: { isActive: boolean }) {
  return `flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition ${
    isActive ? "bg-slate-800 text-slate-50" : "text-slate-400 hover:bg-slate-900 hover:text-slate-100"
  }`;
}

export function AdminSidebar() {
  return (
    <aside className="flex w-56 shrink-0 flex-col gap-1 border-r border-slate-800 bg-slate-950/60 p-3">
      <p className="px-3 pb-2 pt-1 text-xs font-semibold uppercase tracking-wide text-slate-600">Admin</p>
      <NavLink to="/admin/libraries" className={itemClass}>
        <FolderTree size={16} />
        Libraries
      </NavLink>
      <NavLink to="/admin/sections" className={itemClass}>
        <Rows3 size={16} />
        Sections
      </NavLink>
      <NavLink to="/admin/users" className={itemClass}>
        <UsersIcon size={16} />
        Users
      </NavLink>
    </aside>
  );
}
