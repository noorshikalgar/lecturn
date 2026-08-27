import { Palette } from "lucide-react";
import { useState } from "react";
import { applyTheme, loadTheme, THEMES, type ThemeKey } from "../../lib/theme";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";

/** Desktop header control for picking a site-wide theme — hidden on mobile,
 * where the same three options render inline in the slide-down menu instead
 * (a nested dropdown-in-a-dropdown doesn't work well on a touch menu). */
export function ThemeMenu() {
  const [theme, setTheme] = useState<ThemeKey>(() => loadTheme());

  function handleChange(value: string) {
    const key = value as ThemeKey;
    setTheme(key);
    applyTheme(key);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          aria-label="Change theme"
          title="Change theme"
          className="hidden size-[30px] items-center justify-center rounded-full text-muted-foreground outline-none ring-ring hover:bg-muted hover:text-foreground focus-visible:ring-2 md:flex"
        >
          <Palette size={16} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel className="font-normal">Theme</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup value={theme} onValueChange={handleChange}>
          {THEMES.map((t) => (
            <DropdownMenuRadioItem key={t.key} value={t.key}>
              {t.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
