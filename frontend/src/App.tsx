import type { ReactElement } from "react";
import { createBrowserRouter, Navigate, Outlet, RouterProvider, useLocation } from "react-router-dom";
import { RootLayout } from "./components/layout/RootLayout";
import { useAuth } from "./lib/AuthContext";
import { AdminPage } from "./pages/AdminPage";
import { CoursePage } from "./pages/CoursePage";
import { DashboardPage } from "./pages/DashboardPage";
import { LoginPage } from "./pages/LoginPage";
import { PathDetailPage } from "./pages/PathDetailPage";
import { PathsPage } from "./pages/PathsPage";
import { SectionPage } from "./pages/SectionPage";

function AdminRoute({ children }: { children: ReactElement }) {
  const { user } = useAuth();
  if (user?.role !== "admin") return <Navigate to="/" replace />;
  return children;
}

function RootRoute() {
  const location = useLocation();
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="flex min-h-dvh items-center justify-center text-sm text-slate-500">Loading…</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return (
    <RootLayout>
      <Outlet />
    </RootLayout>
  );
}

const router = createBrowserRouter([
  { path: "/login", element: <LoginPage /> },
  {
    path: "/",
    element: <RootRoute />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: "courses/:id", element: <CoursePage /> },
      { path: "sections/:id", element: <SectionPage /> },
      { path: "paths", element: <PathsPage /> },
      { path: "paths/:id", element: <PathDetailPage /> },
      { path: "admin", element: <AdminRoute><AdminPage /></AdminRoute> },
    ],
  },
]);

export function App() {
  return <RouterProvider router={router} />;
}
