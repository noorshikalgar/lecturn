import type { Config } from "tailwindcss";

// Raw shadcn/ui semantic tokens only — no custom brand color scale. Every
// value here reads from the CSS custom properties in src/index.css
// (shadcn's own generated tokens, unmodified). The tokens are full oklch()
// values, not the "R G B" triplets Tailwind's own <alpha-value> convention
// expects, so a plain `var(--x)` string silently breaks any `/NN` opacity
// modifier under Tailwind v3 (e.g. ring-foreground/10 fell back to
// Tailwind's hardcoded default ring color instead of erroring) — v3 has no
// automatic color-mix() fallback for that, unlike v4. Returning a function
// here is Tailwind v3's own documented mechanism for a CSS-variable color
// that still supports opacity modifiers.
function token(name: string) {
  return ({ opacityValue }: { opacityValue?: string }) => {
    // For the unmodified utility (no /NN suffix), Tailwind's corePlugins
    // still call this with an opacityValue — it's the *string*
    // "var(--tw-bg-opacity)" (its legacy opacity-variable placeholder), not
    // undefined, so a plain `=== undefined` check missed it: Number(...) on
    // that string is NaN, which silently produced "color-mix(in oklab,
    // var(--x) NaN%, transparent)" — a real but functionless declaration,
    // making every bg-*/text-* semantic-token utility render fully
    // transparent app-wide. Only treat a genuine finite number (an actual
    // /NN modifier) as real opacity; anything else falls back to the
    // unmodified color.
    const percent = opacityValue === undefined ? NaN : Number(opacityValue) * 100;
    return Number.isFinite(percent) ? `color-mix(in oklab, var(--${name}) ${percent}%, transparent)` : `var(--${name})`;
  };
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
