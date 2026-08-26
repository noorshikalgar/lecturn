import type { Config } from "tailwindcss";

// Every shade below reads from the CSS custom properties defined once in
// src/index.css (the site's actual single source of truth) — this just
// wires Tailwind's utility classes to them. `slate` overrides Tailwind's
// stock scale (so every existing bg-slate-900/text-slate-400/etc. site-wide
// picks up the new palette with no per-file changes); `accent` is new.
function scale(name: string) {
  return Object.fromEntries(
    [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950].map((shade) => [
      shade,
      `rgb(var(--${name}-${shade}) / <alpha-value>)`,
    ]),
  );
}

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        slate: scale("slate"),
        accent: scale("accent"),
      },
      fontFamily: {
        mono: ["\"JetBrains Mono\"", "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
    },
  },
  plugins: [],
} satisfies Config;
