import {
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from 'recharts';
import { AXIS_TICK, GRID_STROKE } from '@/components/charts/chartTheme';
import { TooltipBox, TooltipRow } from '@/components/charts/ChartTooltip';
import { addDays } from '@/domain/dates';
import type { ScatterPoint } from '@/domain/weather';
import { formatDate, formatNumber, formatPerDay } from '@/lib/format';

/** Diagramm 8 (Spec 7.4): kWh/Tag gegen Ø-Außentemperatur je Intervall mit Regressionsgerade. */
export function TemperatureChart({
  points,
  regression,
  color,
}: {
  points: ScatterPoint[];
  regression: { slope: number; intercept: number } | null;
  color: string;
}) {
  const temps = points.map((p) => p.meanTemp);
  const minT = Math.floor(Math.min(...temps));
  const maxT = Math.ceil(Math.max(...temps));
  const line = regression
    ? [minT, maxT].map((t) => ({
        t,
        fit: Math.max(0, regression.intercept + regression.slope * t),
      }))
    : [];
  return (
    <ResponsiveContainer width="100%" height={240}>
      <ComposedChart margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
        <CartesianGrid stroke={GRID_STROKE} />
        <XAxis
          dataKey="t"
          type="number"
          domain={[minT, maxT]}
          tick={AXIS_TICK}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v: number) => `${formatNumber(v, 0, 0)} °C`}
        />
        <YAxis
          type="number"
          tick={AXIS_TICK}
          tickLine={false}
          axisLine={false}
          width={44}
          tickFormatter={(v: number) => formatNumber(v, 0, 0)}
        />
        <Tooltip
          cursor={false}
          content={(props: TooltipContentProps) => {
            const p = props.payload[0]?.payload as (ScatterPoint & { t: number }) | undefined;
            if (!props.active || !p || !('perDay' in p)) return null;
            return (
              <TooltipBox title={`${formatDate(p.from)} – ${formatDate(addDays(p.to, -1))}`}>
                <TooltipRow color={color} label="Verbrauch" value={formatPerDay(p.perDay)} />
                <TooltipRow
                  color="var(--muted-foreground)"
                  label="Ø Außentemperatur"
                  value={`${formatNumber(p.meanTemp, 1, 1)} °C`}
                />
              </TooltipBox>
            );
          }}
        />
        <Line
          data={line}
          dataKey="fit"
          stroke="var(--muted-foreground)"
          strokeWidth={2}
          strokeDasharray="5 4"
          dot={false}
          activeDot={false}
          isAnimationActive={false}
        />
        <Scatter
          data={points.map((p) => ({ ...p, t: p.meanTemp }))}
          dataKey="perDay"
          fill={color}
          stroke="var(--card)"
          strokeWidth={2}
          isAnimationActive={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
