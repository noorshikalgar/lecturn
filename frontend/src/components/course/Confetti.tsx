import { useMemo, type CSSProperties } from "react";

const COLORS = ["#34d399", "#fbbf24", "#60a5fa", "#f472b6", "#a78bfa", "#f87171"];

interface Piece {
  left: number;
  tx: number;
  ty: number;
  rotation: number;
  delay: number;
  duration: number;
  color: string;
  size: number;
}

function makePieces(count: number): Piece[] {
  return Array.from({ length: count }, () => {
    const angle = Math.random() * Math.PI - Math.PI / 2 - Math.PI / 2; // upward-ish burst
    const distance = 160 + Math.random() * 300;
    return {
      left: 45 + Math.random() * 10,
      tx: Math.cos(angle) * distance,
      ty: Math.sin(angle) * distance + 420,
      rotation: Math.random() * 1080 - 540,
      delay: Math.random() * 0.5,
      duration: 2.4 + Math.random() * 1.6,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      size: 5 + Math.random() * 5,
    };
  });
}

/** One-shot confetti burst — mount it, let it play, unmount it. No external
 * library: a handful of absolutely-positioned pieces animated via CSS. */
export function Confetti() {
  const pieces = useMemo(() => makePieces(70), []);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {pieces.map((p, i) => (
        <span
          key={i}
          className="confetti-piece absolute top-1/3"
          style={
            {
              left: `${p.left}%`,
              width: p.size,
              height: p.size * 0.4,
              backgroundColor: p.color,
              animationDelay: `${p.delay}s`,
              animationDuration: `${p.duration}s`,
              "--confetti-tx": `${p.tx}px`,
              "--confetti-ty": `${-p.ty}px`,
              "--confetti-rot": `${p.rotation}deg`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}
