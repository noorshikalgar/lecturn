import { Outlet } from "react-router-dom";
import { AdminSidebar } from "../../components/admin/AdminSidebar";

export function AdminLayout() {
  return (
    <div className="flex h-full flex-col md:flex-row">
      <AdminSidebar />
      <div className="min-w-0 min-h-0 flex-1 overflow-y-auto">
        <Outlet />
      </div>
    </div>
  );
}
