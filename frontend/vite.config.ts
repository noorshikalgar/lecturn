import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    // Binds to every interface, not just localhost, so a phone/tablet on
    // the same LAN can reach this dev server via the machine's LAN IP
    // (e.g. http://192.168.x.x:5173) — needed to test on a real device
    // instead of just the Simulator/desktop browser.
    host: "0.0.0.0",
    // Vite rejects requests whose Host header isn't localhost/127.0.0.1 or
    // explicitly allow-listed (DNS-rebinding protection) — a request coming
    // in via the LAN IP has that IP as its Host header, so `true` here
    // disables the check rather than allow-listing "0.0.0.0" itself, which
    // is never an actual Host header value a browser would send.
    allowedHosts: true,
    proxy: {
      "/api": {
        target: "http://localhost:8787",
        changeOrigin: true,
      },
    },
  },
  preview: {
    port: 4173,
    proxy: {
      "/api": {
        target: "http://localhost:8787",
        changeOrigin: true,
      },
    },
  },
});
