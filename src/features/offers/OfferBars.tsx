import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from 'recharts';
import { AXIS_TICK, GRID_STROKE } from '@/components/charts/chartTheme';
import { TooltipBox, TooltipRow } from '@/components/charts/ChartTooltip';
import { formatEur, formatNumber } from '@/lib/format';

export interface OfferBarDatum {
  name: string;
  year1Eur: number;
  followYearEur: number;
}

/** Spec 7.3 (7) – Balken Jahr 1 (mit Bonus, voll) vs. Folgejahr (ohne Bonus, blass). */
export function OfferBars({ data, color }: { data: OfferBarDatum[]; color: string }) {
  return (
    <ResponsiveContainer width="100%" height={Math.max(160, data.length * 56)}>
      <BarChart
        data={data}
        layout="vertical"
        barGap={2}
        margin={{ top: 4, right: 12, bottom: 0, left: 4 }}
      >
        <CartesianGrid horizontal={false} stroke={GRID_STROKE} />
        <XAxis
          type="number"
          tick={AXIS_TICK}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v: number) => `${formatNumber(v, 0, 0)} €`}
        />
        <YAxis
          type="category"
          dataKey="name"
          interval={0}
          tick={AXIS_TICK}
          tickLine={false}
          axisLine={false}
          width={96}
        />
        <Tooltip
          cursor={{ fill: 'var(--muted)', opacity: 0.4 }}
          content={(props: TooltipContentProps) => {
            const d = props.payload[0]?.payload as OfferBarDatum | undefined;
            if (!props.active || !d) return null;
            return (
              <TooltipBox title={d.name}>
                <TooltipRow
                  color={color}
                  label="Jahr 1 (mit Bonus)"
                  value={formatEur(d.year1Eur)}
                />
                <TooltipRow
                  color={color}
                  dashed
                  label="Folgejahr"
                  value={formatEur(d.followYearEur)}
                />
              </TooltipBox>
            );
          }}
        />
        <Bar
          dataKey="year1Eur"
          fill={color}
          maxBarSize={16}
          radius={[0, 4, 4, 0]}
          isAnimationActive={false}
        />
        <Bar
          dataKey="followYearEur"
          fill={color}
          fillOpacity={0.3}
          maxBarSize={16}
          radius={[0, 4, 4, 0]}
          isAnimationActive={false}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
