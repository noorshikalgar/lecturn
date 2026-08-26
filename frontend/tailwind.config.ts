import type { Config } from "tailwindcss";

// Raw shadcn/ui semantic tokens only — no custom brand color scale. Every
// value here reads from the CSS custom properties in src/index.css
// (shadcn's own generated tokens, unmodified).
function token(name: string) {
  return `var(--${name})`;
}
const TOKENS = [
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
  "accent",
  "accent-foreground",
  "destructive",
  "border",
  "input",
  "ring",
];

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: Object.fromEntries(TOKENS.map((name) => [name, token(name)])),
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        xl: "calc(var(--radius) + 4px)",
      },
      fontFamily: {
        sans: ["\"Geist Variable\"", "-apple-system", "\"Segoe UI\"", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
} satisfies Config;
