const CHUNK_RE = /(\d+)|(\D+)/g;

function chunks(value: string): (string | number)[] {
  const lower = value.toLowerCase();
  const result: (string | number)[] = [];
  for (const match of lower.matchAll(CHUNK_RE)) {
    result.push(match[1] !== undefined ? Number(match[1]) : match[0]);
  }
  return result;
}

/** Numeric-aware comparator: "2" sorts before "10", unlike plain lexicographic sort. */
export function naturalCompare(a: string, b: string): number {
  const ca = chunks(a);
  const cb = chunks(b);
  const len = Math.max(ca.length, cb.length);
  for (let i = 0; i < len; i++) {
    const x = ca[i];
    const y = cb[i];
    if (x === undefined) return -1;
    if (y === undefined) return 1;
    if (typeof x === "number" && typeof y === "number") {
      if (x !== y) return x - y;
      continue;
    }
    const sx = String(x);
    const sy = String(y);
    if (sx !== sy) return sx < sy ? -1 : 1;
  }
  return 0;
}

export function naturalSortBy<T>(items: T[], key: (item: T) => string): T[] {
  return [...items].sort((a, b) => naturalCompare(key(a), key(b)));
}
