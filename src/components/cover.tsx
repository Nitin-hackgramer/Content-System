import clsx from "clsx";

// Abstract cover art, seeded by the idea id so every idea keeps its own look. It carries no data and no claims:
// it exists to give the library visual rhythm until ideas have real thumbnails.
const PALETTES = [
  ["#b96f52", "#f3e2d8", "#8f4a31"],
  ["#252722", "#b96f52", "#eae6de"],
  ["#d9cbb8", "#8f4a31", "#fbf8f2"],
  ["#8f4a31", "#eae6de", "#252722"],
  ["#c99a7c", "#252722", "#f5f2ec"],
  ["#3a3c36", "#d9cbb8", "#b96f52"],
];

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

export function Cover({ id, className }: { id: string; className?: string }) {
  const h = hash(id);
  const [bg, a, b] = PALETTES[h % PALETTES.length];
  const v = (h >> 4) % 3;
  return (
    <svg aria-hidden viewBox="0 0 160 120" preserveAspectRatio="xMidYMid slice" className={clsx("block h-full w-full", className)}>
      <rect width="160" height="120" fill={bg} />
      {v === 0 && <><circle cx={30 + (h % 90)} cy="84" r="58" fill={a} /><circle cx={120 - (h % 50)} cy="22" r="30" fill={b} /></>}
      {v === 1 && <><path d={`M0 120 Q ${40 + (h % 60)} 20 160 ${50 + (h % 40)} V120 Z`} fill={a} /><rect x={20 + (h % 80)} y="14" width="36" height="36" rx="18" fill={b} /></>}
      {v === 2 && <><rect x={-20} y={50 + (h % 30)} width="200" height="26" rx="13" fill={a} transform="rotate(-14 80 60)" /><circle cx={118 - (h % 30)} cy="34" r="22" fill={b} /></>}
    </svg>
  );
}
