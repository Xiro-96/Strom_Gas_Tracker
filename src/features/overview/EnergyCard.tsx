import { Link } from 'react-router';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { EnergyAnalysis } from '@/domain/analysis';
import { lastWindowAverage, readingStatus, trendVsPreviousYear } from '@/domain/consumption';
import { todayISO } from '@/domain/dates';
import { forecastAnnual, type AnnualForecast } from '@/domain/forecast';
import { gasFactorsAt } from '@/domain/gas';
import { Sparkline } from '@/features/overview/Sparkline';
import { ENERGY } from '@/features/shared/energy';
import {
  formatDate,
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
}: {
  analysis: EnergyAnalysis;
  readingIntervalDays: number;
  baseLoadShare: number;
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
            <span className="text-muted-foreground">
              {' · '}
              {forecast.uncertain ? 'unsicher – noch wenig Daten' : BASIS_LABEL[forecast.method]}
            </span>
          </p>
        ) : null}
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
