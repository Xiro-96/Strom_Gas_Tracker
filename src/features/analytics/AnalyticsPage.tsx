import { ChartNoAxesCombined } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { ChartCard, DataTable } from '@/components/charts/ChartCard';
import { EmptyState } from '@/components/common/EmptyState';
import { PageHeader } from '@/components/common/PageHeader';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
  cumulativeYears,
  monthlyComparison,
  rangeBounds,
  stepSeries,
  type ChartRange,
} from '@/domain/charts';
import { addDays } from '@/domain/dates';
import type { Interval } from '@/domain/intervals';
import type { EnergyType } from '@/domain/types';
import { CumulativeChart, DailyStepChart, MonthlyBarsChart } from '@/features/analytics/charts';
import { CostCharts } from '@/features/analytics/CostCharts';
import { TemperatureChart } from '@/features/analytics/TemperatureChart';
import { temperatureScatter } from '@/domain/weather';
import { ENERGY } from '@/features/shared/energy';
import { useCostData } from '@/features/contracts/useCostData';
import {
  formatDate,
  formatKwh,
  formatMonth,
  formatNumber,
  formatPerDay,
  formatTrend,
} from '@/lib/format';

const RANGES: { value: ChartRange; label: string; short: string }[] = [
  { value: '3m', label: '3 Monate', short: '3 M' },
  { value: '12m', label: '12 Monate', short: '12 M' },
  { value: 'year', label: 'Dieses Jahr', short: 'Jahr' },
  { value: 'contract', label: 'Laufender Vertrag', short: 'Vertrag' },
  { value: 'all', label: 'Alles', short: 'Alles' },
];

export function AnalyticsPage() {
  const cost = useCostData();
  const data = cost.status === 'ready' ? cost.energy : cost;
  const [selected, setSelected] = useState<EnergyType | undefined>();
  const [range, setRange] = useState<ChartRange>('12m');
  const energy =
    data.status === 'ready'
      ? selected && data.energies.includes(selected)
        ? selected
        : data.energies[0]
      : undefined;
  const analysis = energy && data.status === 'ready' ? data.analyses[energy] : undefined;
  const costs = energy && cost.status === 'ready' ? cost.byEnergy[energy] : undefined;
  const currentForecast = costs?.currentForecast;
  const ranges = RANGES.filter((r) => r.value !== 'contract' || currentForecast);

  const view = useMemo(() => {
    if (!analysis || analysis.intervals.length === 0) return null;
    const lastDay = addDays(analysis.intervals.at(-1)?.to ?? '', -1);
    const bounds = rangeBounds(
      range,
      lastDay,
      currentForecast
        ? { from: currentForecast.periodFrom, to: currentForecast.periodTo }
        : undefined,
    );
    return {
      bounds,
      current: stepSeries(analysis.intervals, bounds),
      previous: stepSeries(analysis.intervals, bounds, 1),
      intervals: analysis.intervals.filter((i) => i.to > bounds.from && i.from < bounds.to),
      months: monthlyComparison(analysis.daily, bounds),
      years: cumulativeYears(analysis.daily, 3),
    };
  }, [analysis, range, currentForecast]);

  const header = (
    <PageHeader
      title="Auswertung"
      description="Verbrauch im Zeitverlauf – Gas in kWh umgerechnet"
    />
  );

  if (data.status === 'loading') {
    return (
      <>
        {header}
        <Card className="h-72 animate-pulse bg-muted/40" aria-busy="true" />
      </>
    );
  }
  if (!energy || !view) {
    return (
      <>
        {header}
        <EmptyState
          icon={ChartNoAxesCombined}
          title="Noch keine Daten für Diagramme"
          description="Ab der zweiten Ablesung eines Zählers siehst du hier Tageswerte, Monate und den Jahresvergleich."
          action={
            <Button asChild>
              <Link to="/">Zur Übersicht</Link>
            </Button>
          }
        />
      </>
    );
  }

  const meta = ENERGY[energy];
  const color = meta.color;
  return (
    <>
      {header}
      <div className="flex flex-wrap items-center gap-2">
        {data.energies.length > 1 ? (
          <ToggleGroup
            type="single"
            aria-label="Energieart"
            value={energy}
            onValueChange={(v) => {
              if (v === 'electricity' || v === 'gas') setSelected(v);
            }}
          >
            {data.energies.map((type) => {
              const Icon = ENERGY[type].icon;
              return (
                <ToggleGroupItem key={type} value={type} aria-label={ENERGY[type].label}>
                  <Icon aria-hidden="true" className={ENERGY[type].text} />
                  {ENERGY[type].label}
                </ToggleGroupItem>
              );
            })}
          </ToggleGroup>
        ) : null}
        <ToggleGroup
          type="single"
          aria-label="Zeitraum"
          value={range}
          onValueChange={(v) => {
            const next = RANGES.find((r) => r.value === v);
            if (next) setRange(next.value);
          }}
        >
          {ranges.map((r) => (
            <ToggleGroupItem key={r.value} value={r.value} aria-label={r.label}>
              {r.short}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      <ChartCard
        title="Tagesverbrauch"
        description="Ø kWh pro Tag je Ableseintervall – jede Stufe so breit wie das Intervall."
        legend={[
          { label: 'Dieser Zeitraum', color },
          { label: 'Vorjahr', color, variant: 'dashed' },
        ]}
        table={
          <DataTable
            caption={`Tagesverbrauch ${meta.label}`}
            head={['Zeitraum', 'Tage', 'kWh/Tag']}
            rows={[...view.intervals]
              .reverse()
              .map((i) => [
                `${formatDate(i.from)} – ${formatDate(addDays(i.to, -1))}`,
                i.days,
                formatNumber(i.perDay, 1, 1),
              ])}
          />
        }
      >
        <DailyStepChart current={view.current} previous={view.previous} color={color} />
      </ChartCard>

      <ChartCard
        title="Monatsverbrauch"
        description="Aus der Tagesverteilung berechnet; heller = Monat noch nicht vollständig abgelesen."
        legend={[
          { label: 'Verbrauch', color },
          { label: 'Vorjahr', color, variant: 'ghost' },
        ]}
        table={
          <DataTable
            caption={`Monatsverbrauch ${meta.label}`}
            head={['Monat', 'kWh', 'Vorjahr', 'Änderung']}
            rows={[...view.months]
              .reverse()
              .map((m) => [
                `${formatMonth(m.month)}${m.complete ? '' : ' (unvollständig)'}`,
                formatNumber(m.kwh, 0, 0),
                m.previousKwh === null ? '–' : formatNumber(m.previousKwh, 0, 0),
                m.previousKwh && m.complete && m.previousComplete
                  ? formatTrend(m.kwh / m.previousKwh - 1)
                  : '–',
              ])}
          />
        }
      >
        <MonthlyBarsChart months={view.months} color={color} />
      </ChartCard>

      <ChartCard
        title="Kumuliert im Jahr"
        description="Eine Linie je Jahr – liegst du über oder unter dem Vorjahr?"
        legend={view.years.map((y, i) => ({
          label: String(y.year),
          color: i === view.years.length - 1 ? color : 'var(--muted-foreground)',
        }))}
        table={
          <DataTable
            caption={`Kumulierter Verbrauch ${meta.label}`}
            head={['Jahr', 'bis', 'kWh']}
            rows={[...view.years].reverse().map((y) => {
              const last = y.points.at(-1);
              return [
                String(y.year),
                last ? formatDate(last.date) : '–',
                last ? formatKwh(last.kwh) : '–',
              ];
            })}
          />
        }
      >
        <CumulativeChart years={view.years} color={color} />
      </ChartCard>

      {energy === 'gas' ? (
        <GasTemperature
          analysisIntervals={analysis?.intervals ?? []}
          temps={data.temps}
          color={color}
        />
      ) : null}

      <CostCharts energy={energy} costs={costs} bounds={view.bounds} />
    </>
  );
}

function GasTemperature({
  analysisIntervals,
  temps,
  color,
}: {
  analysisIntervals: Interval[];
  temps: ReadonlyMap<string, number> | null;
  color: string;
}) {
  if (!temps) {
    return (
      <Card className="flex-row items-center justify-between gap-3 px-5 text-sm">
        <span className="text-muted-foreground">
          Gas gegen Außentemperatur: Wetter unter „Mehr“ aktivieren (optional).
        </span>
        <Button asChild size="sm" variant="outline">
          <Link to="/mehr">Einstellungen</Link>
        </Button>
      </Card>
    );
  }
  const { points, regression } = temperatureScatter(analysisIntervals, temps);
  if (points.length === 0) return null;
  return (
    <ChartCard
      title="Gas und Außentemperatur"
      description={`Je Ableseintervall Ø kWh pro Tag gegen Ø Außentemperatur${
        regression
          ? ` – pro Grad wärmer ${formatNumber(Math.abs(regression.slope), 1, 1)} kWh/Tag ${regression.slope < 0 ? 'weniger' : 'mehr'} (R² ${formatNumber(regression.r2, 2, 2)})`
          : ''
      }. Wetterdaten: Open-Meteo.com`}
      legend={[
        { label: 'Intervall', color },
        { label: 'Trend', color: 'var(--muted-foreground)', variant: 'dashed' },
      ]}
      table={
        <DataTable
          caption="Gas und Außentemperatur"
          head={['Zeitraum', 'Ø °C', 'kWh/Tag']}
          rows={[...points]
            .reverse()
            .map((p) => [
              `${formatDate(p.from)} – ${formatDate(addDays(p.to, -1))}`,
              formatNumber(p.meanTemp, 1, 1),
              formatPerDay(p.perDay),
            ])}
        />
      }
    >
      <TemperatureChart points={points} regression={regression} color={color} />
    </ChartCard>
  );
}
