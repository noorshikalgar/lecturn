import { useEffect, type ReactElement } from "react";
import { createBrowserRouter, Navigate, Outlet, RouterProvider, useLocation } from "react-router-dom";
import { RootLayout } from "./components/layout/RootLayout";
import { useAuth } from "./lib/AuthContext";
import { AdminLayout } from "./pages/admin/AdminLayout";
import { ActivityPage } from "./pages/admin/ActivityPage";
import { LibrariesPage } from "./pages/admin/LibrariesPage";
import { LibraryExplorerPage } from "./pages/admin/LibraryExplorerPage";
import { SectionsPage as AdminSectionsPage } from "./pages/admin/SectionsPage";
import { UsersPage } from "./pages/admin/UsersPage";
import { CourseDetailPage } from "./pages/CourseDetailPage";
import { CoursePage } from "./pages/CoursePage";
import { DashboardPage } from "./pages/DashboardPage";
import { LoginPage } from "./pages/LoginPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { PathDetailPage } from "./pages/PathDetailPage";
import { PathsPage } from "./pages/PathsPage";
import { ProfilePage } from "./pages/ProfilePage";
import { SectionPage } from "./pages/SectionPage";
import { VerifyPage } from "./pages/VerifyPage";
import { toast } from "./lib/toast";

function AdminRoute({ children }: { children: ReactElement }) {
  const { user } = useAuth();
  const denied = user?.role !== "admin";
  useEffect(() => {
    if (denied) toast.error("You don't have access to the admin panel.");
  }, [denied]);
  if (denied) return <Navigate to="/" replace />;
  return children;
}

/** Shared "must be signed in" gate for both the normal chrome (RootLayout)
 * and the player, which deliberately skips that chrome for a fullscreen
 * watch experience — each needs the same loading/redirect behavior without
 * either one getting RootLayout's header. */
function AuthGate({ children }: { children: ReactElement }) {
  const location = useLocation();
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="flex min-h-dvh items-center justify-center text-sm text-muted-foreground">Loading…</div>;
  }
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return children;
}

function RootRoute() {
  return (
    <AuthGate>
      <RootLayout>
        <Outlet />
      </RootLayout>
    </AuthGate>
  );
}

function WatchRoute() {
  return (
    <AuthGate>
      <CoursePage />
    </AuthGate>
  );
}

const router = createBrowserRouter([
  { path: "/login", element: <LoginPage /> },
  // Outside AuthGate entirely, unlike every other route here — a
  // certificate has to be checkable by someone with no Lecturn account at
  // all (see VerifyPage's own comment).
  { path: "/verify/:code", element: <VerifyPage /> },
  // Outside RootRoute's tree entirely — the player is fullscreen, no
  // RootLayout header, with its own top bar instead.
  { path: "/courses/:id/watch", element: <WatchRoute /> },
  {
    path: "/",
    element: <RootRoute />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: "courses/:id", element: <CourseDetailPage /> },
      { path: "sections/:id", element: <SectionPage /> },
      { path: "paths", element: <PathsPage /> },
      { path: "paths/:id", element: <PathDetailPage /> },
      { path: "profile", element: <ProfilePage /> },
      {
        path: "admin",
        element: <AdminRoute><AdminLayout /></AdminRoute>,
        children: [
          { index: true, element: <Navigate to="libraries" replace /> },
          { path: "libraries", element: <LibrariesPage /> },
          { path: "libraries/:id", element: <LibraryExplorerPage /> },
          { path: "sections", element: <AdminSectionsPage /> },
          { path: "users", element: <UsersPage /> },
          { path: "activity", element: <ActivityPage /> },
          { path: "*", element: <NotFoundPage /> },
        ],
      },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
]);

export function App() {
  return <RouterProvider router={router} />;
}
