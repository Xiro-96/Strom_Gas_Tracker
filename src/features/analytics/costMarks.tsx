import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  LabelList,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from 'recharts';
import { AXIS_TICK, GRID_STROKE } from '@/components/charts/chartTheme';
import { TooltipBox, TooltipRow } from '@/components/charts/ChartTooltip';
import type { CumulativePoint, EffectivePriceEntry, MonthlyCost } from '@/domain/costAnalysis';
import {
  formatCt,
  formatDate,
  formatEur,
  formatMonth,
  formatMonthShort,
  formatNumber,
} from '@/lib/format';

const HEIGHT = 240;
/** Abschläge sind eine Referenz (was gezahlt wird) – Textfarbe statt Kategorienfarbe. */
const INSTALLMENT_INK = 'var(--foreground)';
const BONUS = 'var(--chart-bonus)';
const SURFACE = 'var(--card)';

const toMs = (iso: string) =>
  Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)));
const msToISO = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const tickMonth = (ms: number) => {
  const iso = msToISO(ms);
  return `${formatMonthShort(iso.slice(0, 7))} ${iso.slice(2, 4)}`;
};
const euroTick = (v: number) => `${formatNumber(v, 0, 0)} €`;

/** Diagramm 4: Kosten je Monat – Grund- und Arbeitspreis gestapelt, Boni negativ, Linie = Abschlag. */
export function MonthlyCostChart({
  months,
  color,
  baseColor,
}: {
  months: MonthlyCost[];
  color: string;
  baseColor: string;
}) {
  const data = months.map((m) => ({
    ...m,
    label: formatMonthShort(m.month),
    bonus: m.bonusEur < 0 ? m.bonusEur : null,
    installment: m.installmentEur > 0 ? m.installmentEur : null,
  }));
  return (
    <ResponsiveContainer width="100%" height={HEIGHT}>
      <ComposedChart
        data={data}
        stackOffset="sign"
        barCategoryGap="22%"
        margin={{ top: 8, right: 8, bottom: 0, left: -4 }}
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
          width={56}
          tickFormatter={euroTick}
        />
        <ReferenceLine y={0} stroke="var(--muted-foreground)" strokeOpacity={0.5} />
        <Tooltip
          cursor={{ fill: 'var(--muted)', opacity: 0.4 }}
          content={(props: TooltipContentProps) => {
            const m = props.payload[0]?.payload as MonthlyCost | undefined;
            if (!props.active || !m) return null;
            return (
              <TooltipBox title={formatMonth(m.month)}>
                <TooltipRow color={color} label="Arbeitspreis" value={formatEur(m.energyEur)} />
                <TooltipRow color={baseColor} label="Grundpreis" value={formatEur(m.baseEur)} />
                {m.bonusEur < 0 ? (
                  <TooltipRow color={BONUS} label="Boni" value={formatEur(m.bonusEur)} />
                ) : null}
                <TooltipRow
                  color={INSTALLMENT_INK}
                  label="Abschlag"
                  value={formatEur(m.installmentEur)}
                />
                {m.uncoveredDays > 0 ? (
                  <p className="text-muted-foreground">{m.uncoveredDays} Tage ohne Vertrag</p>
                ) : null}
              </TooltipBox>
            );
          }}
        />
        <Bar
          dataKey="baseEur"
          stackId="cost"
          fill={baseColor}
          stroke={SURFACE}
          strokeWidth={2}
          maxBarSize={24}
          isAnimationActive={false}
        />
        <Bar
          dataKey="energyEur"
          stackId="cost"
          fill={color}
          stroke={SURFACE}
          strokeWidth={2}
          maxBarSize={24}
          radius={[4, 4, 0, 0]}
          isAnimationActive={false}
        />
        <Bar
          dataKey="bonus"
          stackId="cost"
          fill={BONUS}
          stroke={SURFACE}
          strokeWidth={2}
          maxBarSize={24}
          radius={[4, 4, 0, 0]}
          isAnimationActive={false}
        />
        <Line
          dataKey="installment"
          type="linear"
          stroke={INSTALLMENT_INK}
          strokeWidth={2}
          dot={{ r: 4, fill: INSTALLMENT_INK, stroke: SURFACE, strokeWidth: 2 }}
          activeDot={{ r: 5, fill: INSTALLMENT_INK, stroke: SURFACE, strokeWidth: 2 }}
          connectNulls
          isAnimationActive={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

/** Diagramm 5: kumulierte Kosten (Ist, dann Prognose gestrichelt) gegen kumulierte Abschläge. */
export function CumulativeCostChart({
  points,
  color,
}: {
  points: CumulativePoint[];
  color: string;
}) {
  const lastActualIndex = points.findLastIndex((p) => !p.projected);
  const data = points.map((p, i) => ({
    t: toMs(p.date),
    date: p.date,
    actual: p.projected ? null : p.costEur,
    // Prognose beginnt am letzten Ist-Punkt, damit die Linien lückenlos anschließen.
    projected: p.projected || i === lastActualIndex ? p.costEur : null,
    installments: p.installmentsEur,
    isProjected: p.projected,
    cost: p.costEur,
  }));
  const lastIndex = data.length - 1;
  const endLabel =
    (text: string) =>
    ({ x, y, index }: { x?: number | string; y?: number | string; index?: number }) => {
      if (index !== lastIndex || typeof x !== 'number' || typeof y !== 'number') return <g />;
      return (
        <text x={x + 6} y={y} dy={4} fontSize={12} fill="var(--muted-foreground)">
          {text}
        </text>
      );
    };
  return (
    <ResponsiveContainer width="100%" height={HEIGHT}>
      <LineChart data={data} margin={{ top: 8, right: 72, bottom: 0, left: -4 }}>
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
        />
        <YAxis
          tick={AXIS_TICK}
          tickLine={false}
          axisLine={false}
          width={60}
          tickFormatter={euroTick}
        />
        <Tooltip
          cursor={{ stroke: 'var(--muted-foreground)', strokeDasharray: '3 3' }}
          content={(props: TooltipContentProps) => {
            const p = props.payload[0]?.payload as (typeof data)[number] | undefined;
            if (!props.active || !p) return null;
            return (
              <TooltipBox title={formatDate(p.date)}>
                <TooltipRow
                  color={color}
                  dashed={p.isProjected}
                  label={p.isProjected ? 'Kosten (Prognose)' : 'Kosten'}
                  value={formatEur(p.cost)}
                />
                <TooltipRow
                  color={INSTALLMENT_INK}
                  label="Abschläge"
                  value={formatEur(p.installments)}
                />
              </TooltipBox>
            );
          }}
        />
        <Line
          dataKey="installments"
          type="stepAfter"
          stroke={INSTALLMENT_INK}
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, fill: INSTALLMENT_INK, stroke: SURFACE, strokeWidth: 2 }}
          isAnimationActive={false}
          label={endLabel('Abschläge')}
        />
        <Line
          dataKey="actual"
          stroke={color}
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, fill: color, stroke: SURFACE, strokeWidth: 2 }}
          connectNulls={false}
          isAnimationActive={false}
        />
        <Line
          dataKey="projected"
          stroke={color}
          strokeWidth={2}
          strokeDasharray="5 4"
          dot={false}
          activeDot={{ r: 4, fill: color, stroke: SURFACE, strokeWidth: 2 }}
          connectNulls={false}
          isAnimationActive={false}
          label={endLabel('Kosten')}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

/** Diagramm 7: Effektivpreis je Vertragsjahr – mit Bonus (voll) und ohne Bonus (blass). */
export function EffectivePriceChart({
  entries,
  color,
}: {
  entries: EffectivePriceEntry[];
  color: string;
}) {
  const data = entries.map((e) => ({
    ...e,
    tick: `${String(e.year)}${e.complete ? '' : '*'}`,
  }));
  return (
    <ResponsiveContainer width="100%" height={HEIGHT}>
      <BarChart data={data} barGap={2} margin={{ top: 20, right: 8, bottom: 0, left: -12 }}>
        <CartesianGrid vertical={false} stroke={GRID_STROKE} />
        <XAxis dataKey="tick" tick={AXIS_TICK} tickLine={false} axisLine={false} />
        <YAxis
          tick={AXIS_TICK}
          tickLine={false}
          axisLine={false}
          width={44}
          tickFormatter={(v: number) => formatNumber(v, 0, 0)}
        />
        <Tooltip
          cursor={{ fill: 'var(--muted)', opacity: 0.4 }}
          content={(props: TooltipContentProps) => {
            const e = props.payload[0]?.payload as EffectivePriceEntry | undefined;
            if (!props.active || !e) return null;
            return (
              <TooltipBox
                title={`${e.provider} · ${String(e.year)}${e.complete ? '' : ' (Prognose)'}`}
              >
                <TooltipRow color={color} label="mit Bonus" value={formatCt(e.withBonusCt, 2)} />
                <TooltipRow
                  color={color}
                  dashed
                  label="ohne Bonus"
                  value={formatCt(e.withoutBonusCt, 2)}
                />
              </TooltipBox>
            );
          }}
        />
        <Bar
          dataKey="withoutBonusCt"
          fill={color}
          fillOpacity={0.25}
          maxBarSize={24}
          radius={[4, 4, 0, 0]}
          isAnimationActive={false}
        />
        <Bar
          dataKey="withBonusCt"
          fill={color}
          maxBarSize={24}
          radius={[4, 4, 0, 0]}
          isAnimationActive={false}
        >
          <LabelList
            dataKey="withBonusCt"
            position="top"
            fontSize={11}
            fill="var(--muted-foreground)"
            formatter={(v: unknown) => (typeof v === 'number' ? formatNumber(v, 1, 1) : '')}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
