import { QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { Toaster } from "./components/Toaster";
import "./index.css";
import { AuthProvider } from "./lib/AuthContext";
import { queryClient } from "./lib/queryClient";
import { applyTheme, loadTheme } from "./lib/theme";

// Applied before the first render so the whole app (including the login
// page) reflects the visitor's chosen theme from first paint, not just the
// pages that render the theme menu.
applyTheme(loadTheme());

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <App />
          <Toaster />
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>,
);
