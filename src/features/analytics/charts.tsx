import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from 'recharts';
import { AXIS_TICK, GRID_STROKE } from '@/components/charts/chartTheme';
import { TooltipBox, TooltipRow } from '@/components/charts/ChartTooltip';
import type { MonthComparison, StepPoint } from '@/domain/charts';
import type { YearCurve } from '@/domain/consumption';
import {
  formatDate,
  formatKwh,
  formatMonth,
  formatMonthShort,
  formatNumber,
  formatPerDay,
} from '@/lib/format';

const HEIGHT = 240;
const toMs = (iso: string) =>
  Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)));
const msToISO = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const tickMonth = (ms: number) => {
  const iso = msToISO(ms);
  return `${formatMonthShort(iso.slice(0, 7))} ${iso.slice(2, 4)}`;
};

type TipProps = TooltipContentProps;

function YearEndLabel({
  x,
  y,
  index,
  lastIndex,
  year,
}: {
  x?: number;
  y?: number;
  index?: number;
  lastIndex: number;
  year: number;
}) {
  if (index !== lastIndex || x === undefined || y === undefined) return <g />;
  return (
    <text x={x + 6} y={y} dy={4} fontSize={12} fill="var(--muted-foreground)">
      {year}
    </text>
  );
}

/** Diagramm 1: Ø kWh/Tag je Ableseintervall als Stufen, Vorjahr gestrichelt. */
export function DailyStepChart({
  current,
  previous,
  color,
}: {
  current: StepPoint[];
  previous: StepPoint[];
  color: string;
}) {
  const cur = current.map((p) => ({ t: toMs(p.date), perDay: p.perDay }));
  const prev = previous.map((p) => ({ t: toMs(p.date), prevPerDay: p.perDay }));
  const lookup = (t: number) => {
    const at = <T extends { t: number }>(arr: T[]) => arr.filter((p) => p.t <= t).at(-1);
    return { now: at(cur)?.perDay ?? null, before: at(prev)?.prevPerDay ?? null };
  };
  return (
    <ResponsiveContainer width="100%" height={HEIGHT}>
      <ComposedChart margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
        <defs>
          <linearGradient id="step-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.28} />
            <stop offset="100%" stopColor={color} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke={GRID_STROKE} />
        <XAxis
          dataKey="t"
          type="number"
          scale="time"
          domain={['dataMin', 'dataMax']}
          tickFormatter={tickMonth}
          tick={AXIS_TICK}
          tickLine={false}
          axisLine={false}
          minTickGap={24}
          allowDuplicatedCategory={false}
        />
        <YAxis
          tick={AXIS_TICK}
          tickLine={false}
          axisLine={false}
          width={44}
          tickFormatter={(v: number) => formatNumber(v, 0, 0)}
        />
        <Tooltip
          cursor={{ stroke: 'var(--muted-foreground)', strokeDasharray: '3 3' }}
          content={(props: TipProps) => {
            const t = (props.payload[0]?.payload as { t: number } | undefined)?.t;
            if (!props.active || t === undefined) return null;
            const { now, before } = lookup(t);
            return (
              <TooltipBox title={formatDate(msToISO(t))}>
                {now !== null ? (
                  <TooltipRow color={color} label="Dieser Zeitraum" value={formatPerDay(now)} />
                ) : null}
                {before !== null ? (
                  <TooltipRow color={color} dashed label="Vorjahr" value={formatPerDay(before)} />
                ) : null}
              </TooltipBox>
            );
          }}
        />
        <Line
          data={prev}
          dataKey="prevPerDay"
          type="stepAfter"
          stroke={color}
          strokeOpacity={0.55}
          strokeWidth={2}
          strokeDasharray="5 4"
          dot={false}
          activeDot={false}
          isAnimationActive={false}
          connectNulls={false}
        />
        <Area
          data={cur}
          dataKey="perDay"
          type="stepAfter"
          stroke={color}
          strokeWidth={2}
          fill="url(#step-fill)"
          dot={false}
          activeDot={{ r: 4, strokeWidth: 2, stroke: 'var(--card)' }}
          isAnimationActive={false}
          connectNulls={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

/** Diagramm 2: Monatsverbrauch, Vorjahr als blasser Geister-Balken daneben. */
export function MonthlyBarsChart({ months, color }: { months: MonthComparison[]; color: string }) {
  // Unvollständige Monate (Ablesung fehlt noch) heller – zweite Reihe im selben Stapel statt Cell.
  const data = months.map((m) => ({
    ...m,
    label: formatMonthShort(m.month),
    full: m.complete ? m.kwh : null,
    partial: m.complete ? null : m.kwh,
  }));
  return (
    <ResponsiveContainer width="100%" height={HEIGHT}>
      <BarChart
        data={data}
        barGap={2}
        barCategoryGap="18%"
        margin={{ top: 8, right: 8, bottom: 0, left: -12 }}
      >
        <CartesianGrid vertical={false} stroke={GRID_STROKE} />
        <XAxis
          dataKey="label"
          tick={AXIS_TICK}
          tickLine={false}
          axisLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          tick={AXIS_TICK}
          tickLine={false}
          axisLine={false}
          width={44}
          tickFormatter={(v: number) => formatNumber(v, 0, 0)}
        />
        <Tooltip
          cursor={{ fill: 'var(--muted)', opacity: 0.4 }}
          content={(props: TipProps) => {
            const m = props.payload[0]?.payload as MonthComparison | undefined;
            if (!props.active || !m) return null;
            return (
              <TooltipBox title={formatMonth(m.month)}>
                <TooltipRow
                  color={color}
                  label={m.complete ? 'Verbrauch' : `Verbrauch (${m.coveredDays} Tage)`}
                  value={formatKwh(m.kwh)}
                />
                {m.previousKwh !== null ? (
                  <TooltipRow
                    color={color}
                    dashed
                    label="Vorjahr"
                    value={formatKwh(m.previousKwh)}
                  />
                ) : null}
              </TooltipBox>
            );
          }}
        />
        <Bar
          dataKey="previousKwh"
          fill={color}
          fillOpacity={0.25}
          radius={[4, 4, 0, 0]}
          isAnimationActive={false}
        />
        <Bar
          dataKey="full"
          stackId="now"
          fill={color}
          radius={[4, 4, 0, 0]}
          isAnimationActive={false}
        />
        <Bar
          dataKey="partial"
          stackId="now"
          fill={color}
          fillOpacity={0.55}
          radius={[4, 4, 0, 0]}
          isAnimationActive={false}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Diagramm 3: kumulierter Verbrauch je Jahr – über oder unter dem Vorjahr? */
export function CumulativeChart({ years, color }: { years: YearCurve[]; color: string }) {
  const latest = years.at(-1)?.year;
  return (
    <ResponsiveContainer width="100%" height={HEIGHT}>
      <LineChart margin={{ top: 8, right: 40, bottom: 0, left: -4 }}>
        <CartesianGrid vertical={false} stroke={GRID_STROKE} />
        <XAxis
          dataKey="day"
          type="number"
          domain={[1, 366]}
          ticks={[1, 91, 182, 274, 366]}
          tickFormatter={(d: number) =>
            ['Jan', 'Apr', 'Jul', 'Okt', 'Dez'][[1, 91, 182, 274, 366].indexOf(d)] ?? ''
          }
          tick={AXIS_TICK}
          tickLine={false}
          axisLine={false}
          allowDuplicatedCategory={false}
        />
        <YAxis
          tick={AXIS_TICK}
          tickLine={false}
          axisLine={false}
          width={52}
          tickFormatter={(v: number) => formatNumber(v, 0, 0)}
        />
        <Tooltip
          cursor={{ stroke: 'var(--muted-foreground)', strokeDasharray: '3 3' }}
          content={(props: TipProps) => {
            const p = props.payload[0]?.payload as { date: string } | undefined;
            if (!props.active || !p) return null;
            return (
              <TooltipBox title={`bis ${formatDate(p.date).slice(0, 6)}`}>
                {props.payload.map((entry, i) => {
                  const point = entry.payload as { date: string; kwh: number };
                  const year = point.date.slice(0, 4);
                  return (
                    <TooltipRow
                      key={`${year}-${i}`}
                      color={Number(year) === latest ? color : 'var(--muted-foreground)'}
                      label={year}
                      value={formatKwh(point.kwh)}
                    />
                  );
                })}
              </TooltipBox>
            );
          }}
        />
        {years.map((curve) => {
          const isLatest = curve.year === latest;
          const lastIndex = curve.points.length - 1;
          return (
            <Line
              key={curve.year}
              data={curve.points}
              dataKey="kwh"
              type="monotone"
              stroke={isLatest ? color : 'var(--muted-foreground)'}
              strokeOpacity={isLatest ? 1 : 0.55}
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
              label={<YearEndLabel lastIndex={lastIndex} year={curve.year} />}
            />
          );
        })}
      </LineChart>
    </ResponsiveContainer>
  );
}
