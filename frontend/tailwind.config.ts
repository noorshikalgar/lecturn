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

// Semantic tokens shadcn/ui components consume (bg-primary, border-border,
// text-muted-foreground, ...) — deliberately no "accent"/"accent-foreground"
// key here, since that name is reserved for the brand scale above; any
// shadcn component markup using bg-accent needs a manual rename instead.
function semantic(name: string) {
  return `rgb(var(--${name}) / <alpha-value>)`;
}
const SEMANTIC_NAMES = [
  "background",
  "foreground",
  "card",
  "card-foreground",
  "popover",
  "popover-foreground",
  "primary",
  "primary-foreground",
  "secondary",
  "secondary-foreground",
  "muted",
  "muted-foreground",
  "destructive",
  "destructive-foreground",
  "border",
  "input",
  "ring",
];

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        slate: scale("slate"),
        accent: scale("accent"),
        ...Object.fromEntries(SEMANTIC_NAMES.map((name) => [name, semantic(name)])),
      },
      borderRadius: {
        lg: "var(--radius-lg)",
        md: "var(--radius-md)",
        sm: "var(--radius-sm)",
        xl: "var(--radius-xl)",
      },
      fontFamily: {
        sans: ["\"Geist Variable\"", "-apple-system", "\"Segoe UI\"", "system-ui", "sans-serif"],
        mono: ["\"JetBrains Mono\"", "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
    },
  },
  plugins: [],
} satisfies Config;
