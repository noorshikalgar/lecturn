import { AVATARS } from "./Avatars";

export function Avatar({
  avatarId,
  username,
  size = 30,
  className = "",
}: {
  avatarId: number | null | undefined;
  username: string;
  size?: number;
  className?: string;
}) {
  const AvatarSvg = avatarId ? AVATARS[avatarId] : undefined;
  if (AvatarSvg) {
    return (
      <AvatarSvg
        width={size}
        height={size}
        className={`shrink-0 rounded-full ${className}`}
        aria-label={`${username}'s avatar`}
      />
    );
  }
  return (
    <div
      style={{ width: size, height: size }}
      className={`flex shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-bold text-primary ${className}`}
    >
      {username.charAt(0).toUpperCase()}
    </div>
  );
}
