import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.ico", "apple-touch-icon-180x180.png"],
      manifest: {
        name: "Lecturn",
        short_name: "Lecturn",
        description: "Your personal video course library.",
        theme_color: "#1c2130",
        background_color: "#1c2130",
        display: "standalone",
        start_url: "/",
        icons: [
          { src: "pwa-64x64.png", sizes: "64x64", type: "image/png" },
          { src: "pwa-192x192.png", sizes: "192x192", type: "image/png" },
          { src: "pwa-512x512.png", sizes: "512x512", type: "image/png" },
          { src: "maskable-icon-512x512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        // Video/media files are served straight from the backend and can be
        // gigabytes each — never let the service worker try to cache those,
        // only the small app shell (JS/CSS/HTML) it actually needs offline.
        navigateFallbackDenylist: [/^\/api\//],
        globPatterns: ["**/*.{js,css,html,svg,woff2}"],
      },
    }),
  ],
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
