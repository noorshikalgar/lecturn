import type { ComponentType, SVGProps } from "react";

type AvatarProps = SVGProps<SVGSVGElement>;

// Five preset avatars — a deliberately small, fixed set (see users table's
// schema comment on avatarId) rather than user-uploaded photos, so there's
// no file storage or path-resolution footgun to get wrong. Each is a flat
// circular illustration on a 100x100 viewBox, designed to read clearly at
// small (24-40px) sizes where most of these actually render.

function AlienGreen(props: AvatarProps) {
  return (
    <svg viewBox="0 0 100 100" {...props}>
      <circle cx="50" cy="50" r="50" fill="#166534" />
      <ellipse cx="50" cy="58" rx="26" ry="30" fill="#4ADE80" />
      <line x1="38" y1="30" x2="33" y2="16" stroke="#4ADE80" strokeWidth="4" strokeLinecap="round" />
      <line x1="62" y1="30" x2="67" y2="16" stroke="#4ADE80" strokeWidth="4" strokeLinecap="round" />
      <circle cx="33" cy="13" r="4" fill="#4ADE80" />
      <circle cx="67" cy="13" r="4" fill="#4ADE80" />
      <ellipse cx="39" cy="54" rx="8" ry="11" fill="#052E16" transform="rotate(-8 39 54)" />
      <ellipse cx="61" cy="54" rx="8" ry="11" fill="#052E16" transform="rotate(8 61 54)" />
      <ellipse cx="41" cy="51" rx="2.5" ry="3" fill="#BBF7D0" />
      <ellipse cx="63" cy="51" rx="2.5" ry="3" fill="#BBF7D0" />
      <path d="M42 72 Q50 78 58 72" stroke="#052E16" strokeWidth="3" fill="none" strokeLinecap="round" />
    </svg>
  );
}

function AlienPurple(props: AvatarProps) {
  return (
    <svg viewBox="0 0 100 100" {...props}>
      <circle cx="50" cy="50" r="50" fill="#5B21B6" />
      <path d="M50 20 C68 20 76 42 70 62 C66 76 34 76 30 62 C24 42 32 20 50 20 Z" fill="#C4B5FD" />
      <circle cx="38" cy="48" r="6" fill="#2E1065" />
      <circle cx="62" cy="48" r="6" fill="#2E1065" />
      <circle cx="50" cy="62" r="5" fill="#2E1065" />
      <circle cx="36.5" cy="46.5" r="1.6" fill="white" />
      <circle cx="60.5" cy="46.5" r="1.6" fill="white" />
      <circle cx="48.5" cy="60.5" r="1.3" fill="white" />
      <path d="M43 78 Q50 82 57 78" stroke="#2E1065" strokeWidth="3" fill="none" strokeLinecap="round" />
    </svg>
  );
}

function AlienBlue(props: AvatarProps) {
  return (
    <svg viewBox="0 0 100 100" {...props}>
      <circle cx="50" cy="50" r="50" fill="#0369A1" />
      <path
        d="M22 58 Q14 70 24 76"
        stroke="#7DD3FC"
        strokeWidth="6"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M78 58 Q86 70 76 76"
        stroke="#7DD3FC"
        strokeWidth="6"
        fill="none"
        strokeLinecap="round"
      />
      <ellipse cx="50" cy="55" rx="30" ry="28" fill="#7DD3FC" />
      <circle cx="50" cy="52" r="15" fill="white" />
      <circle cx="53" cy="53" r="8" fill="#0C4A6E" />
      <circle cx="56" cy="50" r="2.6" fill="white" />
      <path d="M40 74 Q50 79 60 74" stroke="#0C4A6E" strokeWidth="3" fill="none" strokeLinecap="round" />
    </svg>
  );
}

function AlienOrange(props: AvatarProps) {
  return (
    <svg viewBox="0 0 100 100" {...props}>
      <circle cx="50" cy="50" r="50" fill="#9A3412" />
      <path d="M30 34 L38 20 L44 32 Z" fill="#FDBA74" />
      <path d="M70 34 L62 20 L56 32 Z" fill="#FDBA74" />
      <ellipse cx="50" cy="58" rx="27" ry="28" fill="#FDBA74" />
      <circle cx="34" cy="50" r="2.5" fill="#7C2D12" />
      <circle cx="44" cy="66" r="2" fill="#7C2D12" />
      <circle cx="62" cy="48" r="2" fill="#7C2D12" />
      <circle cx="66" cy="62" r="2.5" fill="#7C2D12" />
      <ellipse cx="40" cy="53" rx="6" ry="8" fill="#431407" />
      <ellipse cx="60" cy="53" rx="6" ry="8" fill="#431407" />
      <path d="M40 72 Q50 80 60 72 L58 68 Q50 73 42 68 Z" fill="#431407" />
      <path d="M53 73 L54 78 L57 74 Z" fill="white" />
    </svg>
  );
}

function AlienPink(props: AvatarProps) {
  return (
    <svg viewBox="0 0 100 100" {...props}>
      <circle cx="50" cy="50" r="50" fill="#9D174D" />
      <line x1="50" y1="28" x2="50" y2="14" stroke="#F9A8D4" strokeWidth="4" strokeLinecap="round" />
      <path d="M50 6 C53 6 55 9 53 12.5 C51.5 15 50 16 50 16 C50 16 48.5 15 47 12.5 C45 9 47 6 50 6 Z" fill="#F472B6" />
      <ellipse cx="50" cy="56" rx="27" ry="29" fill="#F9A8D4" />
      <path d="M34 46 L42 50 L34 54 Z" fill="#831843" />
      <path d="M66 46 L58 50 L66 54 Z" fill="#831843" />
      <path d="M41 74 Q50 80 59 74" stroke="#831843" strokeWidth="3" fill="none" strokeLinecap="round" />
      <circle cx="30" cy="60" r="4" fill="#F472B6" opacity="0.7" />
      <circle cx="70" cy="60" r="4" fill="#F472B6" opacity="0.7" />
    </svg>
  );
}

export const AVATARS: Record<number, ComponentType<AvatarProps>> = {
  1: AlienGreen,
  2: AlienPurple,
  3: AlienBlue,
  4: AlienOrange,
  5: AlienPink,
};

export const AVATAR_IDS = Object.keys(AVATARS).map(Number);
