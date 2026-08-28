export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 240 240" className={className} fill="currentColor" aria-hidden="true">
      <rect x="48" y="44" width="20" height="152" rx="10" />
      <rect x="80" y="64" width="70" height="28" rx="14" />
      <rect x="80" y="106" width="112" height="28" rx="14" fill="#c96b3a" />
      <rect x="80" y="148" width="70" height="28" rx="14" />
    </svg>
  );
}
