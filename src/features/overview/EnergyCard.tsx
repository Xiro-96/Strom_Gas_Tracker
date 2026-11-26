import { Link } from 'react-router';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { EnergyAnalysis } from '@/domain/analysis';
import { lastWindowAverage, readingStatus, trendVsPreviousYear } from '@/domain/consumption';
import { todayISO } from '@/domain/dates';
import { forecastAnnual, type AnnualForecast } from '@/domain/forecast';
import { gasFactorsAt } from '@/domain/gas';
import type { EnergyCosts } from '@/features/contracts/useCostData';
import { Sparkline } from '@/features/overview/Sparkline';
import { ENERGY } from '@/features/shared/energy';
import {
  describeBalance,
  formatDate,
  formatEur,
  formatKwh,
  formatMeterValue,
  formatNumber,
  formatRelativeDays,
  formatTrend,
} from '@/lib/format';
import { cn } from '@/lib/utils';

const BASIS_LABEL: Record<AnnualForecast['method'], string> = {
  last365: 'Basis: letzte 365 Tage',
  normalYear: 'Normaljahr (gradtagbereinigt)',
  avg90: 'Ø 90 Tage × 365',
};

export function EnergyCard({
  analysis,
  readingIntervalDays,
  baseLoadShare,
  costs,
}: {
  analysis: EnergyAnalysis;
  readingIntervalDays: number;
  baseLoadShare: number;
  costs?: EnergyCosts | undefined;
}) {
  const meta = ENERGY[analysis.energyType];
  const Icon = meta.icon;
  const avg = lastWindowAverage(analysis.daily, 30);
  const trend = avg ? trendVsPreviousYear(analysis.daily, avg.from, avg.to) : null;
  const last = analysis.lastReading;
  const status = readingStatus(last?.date, todayISO(), readingIntervalDays);
  const meter = analysis.currentMeter;
  const forecast = forecastAnnual(analysis.daily, analysis.intervals, {
    energyType: analysis.energyType,
    baseLoadShare,
  });
  const factors = meter && last ? gasFactorsAt(meter, last.date) : undefined;
  const forecastM3 =
    forecast && factors && analysis.energyType === 'gas'
      ? forecast.kwh / (factors.zFactor * factors.calorificValue)
      : undefined;

  return (
    <Card className="relative overflow-hidden">
      <div
        aria-hidden="true"
        className={cn(
          'pointer-events-none absolute inset-0 bg-linear-to-br to-transparent',
          analysis.energyType === 'gas' ? 'from-gas/12' : 'from-electricity/12',
        )}
      />
      <CardHeader className="relative">
        <CardTitle className="flex items-center gap-3 text-base">
          <span className={cn('grid size-9 place-items-center rounded-xl', meta.soft, meta.text)}>
            <Icon aria-hidden="true" className="size-5" />
          </span>
          <h2>{meta.label}</h2>
        </CardTitle>
      </CardHeader>
      <CardContent className="relative flex flex-col gap-3">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-3xl font-semibold tracking-tight tabular-nums">
              {avg ? formatNumber(avg.perDay, 1, 1) : '–'}
              <span className="ml-1.5 text-base font-medium text-muted-foreground">kWh/Tag</span>
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {avg ? 'Ø der letzten 30 Tage' : 'Noch kein Verbrauch – zweite Ablesung fehlt'}
              {trend !== null ? (
                <>
                  {' · '}
                  <span className={cn('font-medium', trend > 0 ? 'text-warning' : 'text-savings')}>
                    {formatTrend(trend)}
                  </span>{' '}
                  ggü. Vorjahr
                </>
              ) : null}
            </p>
          </div>
          <Sparkline intervals={analysis.intervals} color={meta.color} />
        </div>
        {forecast ? (
          <p className="text-sm">
            <span className="text-muted-foreground">Jahresprognose </span>
            <span className="font-semibold tabular-nums">
              {forecast.uncertain ? '≈ ' : ''}
              {formatKwh(forecast.kwh)}
            </span>
            {forecastM3 !== undefined ? (
              <span className="tabular-nums"> (≈ {formatNumber(forecastM3, 0, 0)} m³)</span>
            ) : null}
            {costs?.annualCostEur != null ? (
              <span className="tabular-nums"> · ≈ {formatEur(costs.annualCostEur)}</span>
            ) : null}
            <span className="text-muted-foreground">
              {' · '}
              {forecast.uncertain ? 'unsicher – noch wenig Daten' : BASIS_LABEL[forecast.method]}
            </span>
          </p>
        ) : null}
        <CostRow costs={costs} />
        <div className="flex items-center justify-between gap-3 border-t pt-3 text-sm">
          <div className="min-w-0">
            {last && meter ? (
              <p className="truncate">
                <span className="tabular-nums">
                  {formatMeterValue(last.value, meter.decimals, meter.unit)}
                </span>
                <span className="text-muted-foreground"> · {formatDate(last.date)}</span>
              </p>
            ) : (
              <p className="text-muted-foreground">Noch keine Ablesung</p>
            )}
            {status.daysSince !== null ? (
              <p className="text-xs text-muted-foreground">
                Abgelesen {formatRelativeDays(status.daysSince)}{' '}
                {status.state === 'overdue' ? (
                  <Badge variant="danger" className="ml-1">
                    überfällig
                  </Badge>
                ) : status.state === 'due' ? (
                  <Badge variant="warning" className="ml-1">
                    fällig
                  </Badge>
                ) : null}
              </p>
            ) : null}
          </div>
          <Link
            to={`/erfassen/${meta.slug}`}
            className="shrink-0 rounded-lg px-2 py-1 font-medium underline-offset-4 hover:underline"
            aria-label={`${meta.label} ablesen`}
          >
            Ablesen →
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

function CostRow({ costs }: { costs: EnergyCosts | undefined }) {
  const active = costs?.active;
  const forecast = active ? costs.forecasts[active.id] : undefined;
  if (!costs || !active || !forecast) {
    return (
      <p className="border-t pt-3 text-sm text-muted-foreground">
        Kein laufender Vertrag –{' '}
        <Link
          to="/vertraege"
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          Vertrag anlegen
        </Link>{' '}
        für Kosten und Abschlags-Check.
      </p>
    );
  }
  const balance = describeBalance(forecast.balanceEur);
  const month = costs.monthToDate;
  return (
    <Link
      to={`/vertraege/${active.id}`}
      aria-label={`Kosten und Abschlag ${active.provider}`}
      className="-mx-2 grid grid-cols-2 gap-3 rounded-xl border-t px-2 pt-3 text-sm transition-colors hover:bg-accent/40"
    >
      <span className="flex flex-col">
        <span className="text-xs text-muted-foreground">Kosten diesen Monat</span>
        <span className="font-semibold tabular-nums">
          {month ? formatEur(month.totalEur) : '–'}
        </span>
        {month && month.estimatedDays > 0 ? (
          <span className="text-xs text-muted-foreground">
            davon {month.estimatedDays} Tage geschätzt
          </span>
        ) : null}
      </span>
      <span className="flex flex-col">
        <span className="text-xs text-muted-foreground">Abschlags-Saldo</span>
        <span
          className={cn(
            'font-semibold tabular-nums',
            balance.label === 'Guthaben' && 'text-savings',
            balance.label === 'Nachzahlung' && 'text-warning',
          )}
        >
          {balance.label}
          {balance.label === 'Ausgeglichen' ? '' : ` ${balance.amount}`}
        </span>
        <span className="text-xs text-muted-foreground">
          bis {formatDate(forecast.periodTo)}
          {Number.isFinite(forecast.recommendedEur)
            ? ` · Abschlag ${formatEur(Math.max(0, forecast.recommendedEur))} empfohlen`
            : ''}
        </span>
      </span>
    </Link>
  );
}
