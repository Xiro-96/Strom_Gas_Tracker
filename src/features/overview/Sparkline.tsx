import type { Interval } from '@/domain/intervals';
import { daysBetween } from '@/domain/dates';

/** Mini-Verlauf der Tagesraten (letzte Intervalle) als Stufenlinie – rein dekorativ. */
export function Sparkline({ intervals, color }: { intervals: readonly Interval[]; color: string }) {
  const recent = intervals.slice(-12);
  const first = recent[0];
  const lastInterval = recent.at(-1);
  if (!first || !lastInterval || recent.length < 2) return null;
  const width = 120;
  const height = 36;
  const span = Math.max(1, daysBetween(first.from, lastInterval.to));
  const max = Math.max(...recent.map((i) => i.perDay)) || 1;
  const x = (date: string) => (daysBetween(first.from, date) / span) * width;
  const y = (v: number) => height - 2 - (v / max) * (height - 4);
  let d = '';
  for (const i of recent) {
    d += `${d ? 'L' : 'M'}${x(i.from).toFixed(1)},${y(i.perDay).toFixed(1)}H${x(i.to).toFixed(1)}`;
  }
  const area = `${d}V${height}H0Z`;
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-9 w-28"
      aria-hidden="true"
      preserveAspectRatio="none"
    >
      <path d={area} fill={color} opacity={0.15} />
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={1.75}
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
