import { AVATAR_IDS, AVATARS } from "./Avatars";

export function AvatarPicker({
  value,
  onChange,
  username,
}: {
  value: number | null;
  onChange: (avatarId: number | null) => void;
  username: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => onChange(null)}
        aria-label="No avatar"
        aria-pressed={value === null}
        className={`flex size-11 items-center justify-center rounded-full bg-secondary text-xs font-bold text-primary outline-none ring-ring ring-offset-2 ring-offset-background transition focus-visible:ring-2 ${
          value === null ? "ring-2" : "opacity-60 hover:opacity-100"
        }`}
      >
        {username.charAt(0).toUpperCase() || "?"}
      </button>
      {AVATAR_IDS.map((id) => {
        const AvatarSvg = AVATARS[id];
        return (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            aria-label={`Avatar ${id}`}
            aria-pressed={value === id}
            className={`rounded-full outline-none ring-ring ring-offset-2 ring-offset-background transition focus-visible:ring-2 ${
              value === id ? "ring-2" : "opacity-60 hover:opacity-100"
            }`}
          >
            <AvatarSvg width={44} height={44} className="rounded-full" />
          </button>
        );
      })}
    </div>
  );
}
