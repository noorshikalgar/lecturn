import { Check, Palette } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { useTheme, type ThemeMode, type ThemePalette } from "../../lib/ThemeContext";

const PALETTES: { value: ThemePalette; label: string }[] = [
  { value: "console", label: "Console" },
  { value: "japan", label: "Japan Warm" },
];

const MODES: { value: ThemeMode; label: string }[] = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
];

export function ThemeToggle() {
  const { mode, palette, setMode, setPalette } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          title="Theme"
          className="rounded-md p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-100"
        >
          <Palette size={16} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuLabel>Palette</DropdownMenuLabel>
        {PALETTES.map((p) => (
          <DropdownMenuItem key={p.value} onClick={() => setPalette(p.value)} className="justify-between">
            {p.label}
            {palette === p.value && <Check size={14} />}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Appearance</DropdownMenuLabel>
        {MODES.map((m) => (
          <DropdownMenuItem key={m.value} onClick={() => setMode(m.value)} className="justify-between">
            {m.label}
            {mode === m.value && <Check size={14} />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
