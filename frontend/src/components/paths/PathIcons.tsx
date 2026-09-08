import type { ComponentType, SVGProps } from "react";

type PathIconProps = SVGProps<SVGSVGElement>;

// Five preset decorative watermarks for the path card's corner — paths have
// no cover art, so these stand in as a visual anchor. Same fixed-set
// pattern as user avatars (see components/avatars): deliberately small and
// curated, not user-uploaded. Line-art rather than filled shapes so they
// stay legible at the very low opacity the card renders them at.

// vectorEffect="non-scaling-stroke" keeps these strokes a constant number of
// *screen* pixels regardless of how large the svg is drawn — without it, a
// stroke tuned to look right as a ~176px card watermark shrinks to a
// sub-pixel hairline (and its dash pattern all but disappears) at the
// ~32px size the icon picker renders these at.
const STROKE = { vectorEffect: "non-scaling-stroke" } as const;

function Route(props: PathIconProps) {
  return (
    <svg viewBox="0 0 176 104" fill="none" {...props}>
      <path d="M10 88 L58 52 L104 66 L166 16" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="0.5 9" {...STROKE} />
      <circle cx="10" cy="88" r="4" fill="currentColor" />
      <circle cx="58" cy="52" r="4" fill="currentColor" />
      <circle cx="104" cy="66" r="4" fill="currentColor" />
      <circle cx="166" cy="16" r="5" fill="currentColor" />
    </svg>
  );
}

function Arcs(props: PathIconProps) {
  return (
    <svg viewBox="0 0 140 140" fill="none" {...props}>
      <circle cx="70" cy="70" r="20" stroke="currentColor" strokeWidth="2" {...STROKE} />
      <circle cx="70" cy="70" r="38" stroke="currentColor" strokeWidth="2" strokeDasharray="2 6" {...STROKE} />
      <circle cx="70" cy="70" r="56" stroke="currentColor" strokeWidth="2" strokeDasharray="2 6" {...STROKE} />
    </svg>
  );
}

function Steps(props: PathIconProps) {
  return (
    <svg viewBox="0 0 150 110" fill="none" {...props}>
      <rect x="100" y="14" width="34" height="18" rx="4" fill="currentColor" />
      <rect x="66" y="42" width="34" height="18" rx="4" fill="currentColor" />
      <rect x="32" y="70" width="34" height="18" rx="4" fill="currentColor" />
      <rect x="-2" y="98" width="34" height="18" rx="4" fill="currentColor" />
    </svg>
  );
}

function WindingRoad(props: PathIconProps) {
  return (
    <svg viewBox="0 0 170 120" fill="none" {...props}>
      <path
        d="M4 10 C 60 10, 10 60, 70 60 S 130 110, 166 110"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeDasharray="0.5 9"
        {...STROKE}
      />
    </svg>
  );
}

function WaypointPin(props: PathIconProps) {
  return (
    <svg viewBox="0 0 110 130" fill="none" {...props}>
      <path
        d="M55 6 C30 6 12 26 12 50 C12 82 55 120 55 120 C55 120 98 82 98 50 C98 26 80 6 55 6 Z"
        stroke="currentColor"
        strokeWidth="2.5"
        {...STROKE}
      />
      <circle cx="55" cy="50" r="14" stroke="currentColor" strokeWidth="2.5" {...STROKE} />
    </svg>
  );
}

export const PATH_ICONS: Record<number, ComponentType<PathIconProps>> = {
  1: Route,
  2: Arcs,
  3: Steps,
  4: WindingRoad,
  5: WaypointPin,
};

export const PATH_ICON_IDS = Object.keys(PATH_ICONS).map(Number);
