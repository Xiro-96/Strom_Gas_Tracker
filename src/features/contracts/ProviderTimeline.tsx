import { useState } from 'react';
import { Link } from 'react-router';
import { ChartCard, DataTable } from '@/components/charts/ChartCard';
import { useElementWidth } from '@/components/charts/useElementWidth';
import type { ContractData } from '@/data/hooks';
import { addDays, daysBetween } from '@/domain/dates';
import { providerTimeline, type TimelineBand, type TimelineMarker } from '@/domain/timeline';
import type { ISODate } from '@/domain/types';
import { ENERGY } from '@/features/shared/energy';
import { formatCt, formatDate, formatNumber } from '@/lib/format';

const PROVIDER_COLORS = Array.from({ length: 8 }, (_, i) => `var(--provider-${String(i + 1)})`);
/** Ab dem 9. Anbieter keine neue Farbe (nie zyklisch) – neutral. */
const colorFor = (i: number) => PROVIDER_COLORS[i] ?? 'var(--muted-foreground)';

const LABEL_W = 44;
const RIGHT_PAD = 10;
const ROW_H = 50;
const BAND_Y = 10;
const BAND_H = 18;
const AXIS_H = 20;
const INK = 'var(--foreground)';
const SURFACE = 'var(--card)';

const MARKER_LABEL: Record<TimelineMarker['kind'], string> = {
  cancellation: 'Kündigung',
  bonus: 'Bonus',
  bill: 'Rechnung',
};

function MarkerGlyph({ kind, x, y }: { kind: TimelineMarker['kind']; x: number; y: number }) {
  const ring = { stroke: SURFACE, strokeWidth: 2, paintOrder: 'stroke' as const };
  if (kind === 'bonus') return <circle cx={x} cy={y} r={4.5} fill={INK} {...ring} />;
  if (kind === 'bill')
    return (
      <rect
        x={x - 4}
        y={y - 4}
        width={8}
        height={8}
        transform={`rotate(45 ${String(x)} ${String(y)})`}
        fill={INK}
        {...ring}
      />
    );
  return <path d={`M${String(x - 5)} ${String(y - 5)} h10 l-5 8 z`} fill={INK} {...ring} />;
}

const period = (b: TimelineBand) =>
  `${formatDate(b.from)} – ${b.open ? 'läuft' : formatDate(b.to)}`;

/** Diagramm 6 – Anbieter-Zeitstrahl: Band je Vertrag (Farbe je Anbieter), Marker für Ereignisse. */
export function ProviderTimeline({ data, today }: { data: ContractData; today: ISODate }) {
  const timeline = providerTimeline({
    contracts: data.contracts,
    pricePeriods: data.pricePeriods,
    bonuses: data.bonuses,
    bills: data.bills,
    today,
  });
  const [ref, width] = useElementWidth();
  const [selected, setSelected] = useState<string | null>(null);
  if (timeline.rows.length === 0) return null;

  const span = daysBetween(timeline.from, timeline.to) + 1;
  const plotW = Math.max(120, width - LABEL_W - RIGHT_PAD);
  const x = (iso: ISODate) => LABEL_W + (daysBetween(timeline.from, iso) / span) * plotW;
  const height = timeline.rows.length * ROW_H + AXIS_H;
  const years: number[] = [];
  for (let y = Number(timeline.from.slice(0, 4)) + 1; y <= Number(timeline.to.slice(0, 4)); y += 1)
    years.push(y);
  const bands = timeline.rows.flatMap((r) =>
    r.bands.map((b) => ({ ...b, energyType: r.energyType })),
  );
  const active = bands.find((b) => b.contractId === selected);
  const markersOf = (id: string) =>
    timeline.rows.flatMap((r) => r.markers).filter((m) => m.contractId === id);

  return (
    <ChartCard
      title="Anbieter-Zeitstrahl"
      description="Ein Band je Vertrag, Farbe je Anbieter; die Zahl ist der Arbeitspreis zu Beginn. Antippen zeigt Details."
      legend={timeline.providers.map((p, i) => ({
        label: p,
        color: colorFor(i),
        variant: 'swatch' as const,
      }))}
      table={
        <DataTable
          caption="Anbieter-Zeitstrahl"
          head={['Vertrag', 'Zeitraum', 'Arbeitspreis', 'Ereignisse']}
          rows={[...bands].reverse().map((b) => [
            `${ENERGY[b.energyType].label}: ${b.provider}`,
            period(b),
            b.energyPriceCt === undefined ? '–' : formatCt(b.energyPriceCt),
            markersOf(b.contractId)
              .map((m) => `${MARKER_LABEL[m.kind]} ${formatDate(m.date)}`)
              .join(', ') || '–',
          ])}
        />
      }
    >
      <div ref={ref} className="w-full">
        <svg
          width={width}
          height={height}
          role="img"
          aria-label="Anbieter-Zeitstrahl"
          className="block overflow-visible"
        >
          {years.map((y) => {
            const xi = x(`${String(y)}-01-01`);
            return (
              <g key={y}>
                <line x1={xi} x2={xi} y1={0} y2={height - AXIS_H} stroke="var(--border)" />
                <text
                  x={xi}
                  y={height - 4}
                  textAnchor="middle"
                  fontSize={12}
                  fill="var(--muted-foreground)"
                >
                  {y}
                </text>
              </g>
            );
          })}
          <line
            x1={x(today)}
            x2={x(today)}
            y1={0}
            y2={height - AXIS_H}
            stroke="var(--muted-foreground)"
            strokeDasharray="3 3"
          />
          {timeline.rows.map((row, ri) => {
            const top = ri * ROW_H;
            const mid = top + BAND_Y + BAND_H / 2;
            return (
              <g key={row.energyType}>
                <text x={0} y={mid} dy={4} fontSize={12} fill="var(--muted-foreground)">
                  {ENERGY[row.energyType].label}
                </text>
                {row.bands.map((b) => {
                  const x0 = x(b.from) + 1;
                  const w = Math.max(3, x(addDays(b.to, 1)) - x(b.from) - 2);
                  const label =
                    b.energyPriceCt !== undefined && w >= 40
                      ? `${formatNumber(b.energyPriceCt, 1, 1)} ct`
                      : null;
                  const isSelected = b.contractId === selected;
                  return (
                    <g
                      key={b.contractId}
                      role="button"
                      tabIndex={0}
                      aria-pressed={isSelected}
                      aria-label={`${ENERGY[row.energyType].label}: ${b.provider}, ${period(b)}`}
                      className="cursor-pointer outline-none [&:focus-visible>rect]:stroke-ring"
                      onClick={() => {
                        setSelected(isSelected ? null : b.contractId);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          setSelected(isSelected ? null : b.contractId);
                        }
                      }}
                    >
                      {/* Trefferfläche größer als das Band */}
                      <rect x={x0} y={top} width={w} height={ROW_H - 4} fill="transparent" />
                      <rect
                        x={x0}
                        y={top + BAND_Y}
                        width={w}
                        height={BAND_H}
                        rx={4}
                        fill={colorFor(b.colorIndex)}
                        stroke={isSelected ? INK : 'transparent'}
                        strokeWidth={2}
                      />
                      {label ? (
                        <text
                          x={x0 + w / 2}
                          y={top + BAND_Y + BAND_H + 14}
                          textAnchor="middle"
                          fontSize={11}
                          fill="var(--muted-foreground)"
                        >
                          {label}
                        </text>
                      ) : null}
                    </g>
                  );
                })}
                {row.markers.map((m) => (
                  <g key={`${m.kind}-${m.contractId}-${m.date}`} pointerEvents="none">
                    <MarkerGlyph kind={m.kind} x={x(m.date)} y={mid} />
                  </g>
                ))}
              </g>
            );
          })}
        </svg>
      </div>
      <ul
        className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground"
        aria-label="Marker"
      >
        {(['bonus', 'bill', 'cancellation'] as const).map((kind) => (
          <li key={kind} className="flex items-center gap-1.5">
            <svg width="12" height="12" aria-hidden="true">
              <MarkerGlyph kind={kind} x={6} y={6} />
            </svg>
            {MARKER_LABEL[kind]}
          </li>
        ))}
        <li className="flex items-center gap-1.5">
          <svg width="12" height="12" aria-hidden="true">
            <line
              x1="6"
              x2="6"
              y1="0"
              y2="12"
              stroke="var(--muted-foreground)"
              strokeDasharray="3 3"
            />
          </svg>
          heute
        </li>
      </ul>
      {active ? (
        <div className="flex flex-col gap-1 rounded-xl border p-3 text-sm" aria-live="polite">
          <p className="font-medium">
            {ENERGY[active.energyType].label}: {active.provider} · {active.tariffName}
          </p>
          <p className="text-muted-foreground">
            {period(active)}
            {active.energyPriceCt === undefined
              ? ''
              : ` · ${formatCt(active.energyPriceCt)} zu Beginn`}
          </p>
          {markersOf(active.contractId).length > 0 ? (
            <p className="text-muted-foreground">
              {markersOf(active.contractId)
                .map((m) => `${MARKER_LABEL[m.kind]} ${formatDate(m.date)}`)
                .join(' · ')}
            </p>
          ) : null}
          <Link
            to={`/vertraege/${active.contractId}`}
            className="font-medium underline-offset-4 hover:underline"
          >
            Vertrag öffnen
          </Link>
        </div>
      ) : null}
    </ChartCard>
  );
}
