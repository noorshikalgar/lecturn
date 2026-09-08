import { PATH_ICONS, PATH_ICON_IDS } from "./PathIcons";

export function PathIconPicker({ value, onChange }: { value: number; onChange: (icon: number) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {PATH_ICON_IDS.map((id) => {
        const Icon = PATH_ICONS[id];
        const selected = value === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            aria-label={`Icon ${id}`}
            aria-pressed={selected}
            className={`flex size-11 items-center justify-center rounded-lg border bg-secondary text-primary outline-none ring-ring ring-offset-2 ring-offset-background transition focus-visible:ring-2 ${
              selected ? "border-primary ring-2" : "border-border opacity-60 hover:opacity-100"
            }`}
          >
            <Icon width={32} height={32} />
          </button>
        );
      })}
    </div>
  );
}
