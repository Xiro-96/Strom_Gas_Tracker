import { Euro } from 'lucide-react';
import { Link } from 'react-router';
import { ChartCard, DataTable } from '@/components/charts/ChartCard';
import { EmptyState } from '@/components/common/EmptyState';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { Bounds } from '@/domain/charts';
import { monthKey } from '@/domain/dates';
import type { EnergyType } from '@/domain/types';
import {
  CumulativeCostChart,
  EffectivePriceChart,
  MonthlyCostChart,
} from '@/features/analytics/costMarks';
import type { EnergyCosts } from '@/features/contracts/useCostData';
import { ENERGY } from '@/features/shared/energy';
import {
  describeBalance,
  formatCt,
  formatDate,
  formatEur,
  formatKwh,
  formatMonth,
} from '@/lib/format';

const INK = 'var(--foreground)';

/** Diagramme 4, 5 und 7 – Kosten, Abschläge und Effektivpreis aus den Verträgen. */
export function CostCharts({
  energy,
  costs,
  bounds,
}: {
  energy: EnergyType;
  costs: EnergyCosts | undefined;
  bounds: Bounds;
}) {
  const meta = ENERGY[energy];
  if (!costs || costs.bundles.length === 0) {
    return (
      <EmptyState
        icon={Euro}
        title="Noch keine Kosten"
        description={`Kosten je Monat, Abschläge und Effektivpreis erscheinen, sobald ein ${meta.label}vertrag angelegt ist.`}
        action={
          <Button asChild variant="outline">
            <Link to="/vertraege">Vertrag anlegen</Link>
          </Button>
        }
      />
    );
  }

  const months = costs.monthly.filter(
    (m) => m.month >= bounds.from.slice(0, 7) && `${m.month}-01` < bounds.to,
  );
  const forecast = costs.currentForecast;
  const balance = forecast ? describeBalance(forecast.balanceEur) : null;
  const monthEnds = costs.cumulative.filter((p, i, all) => {
    const next = all[i + 1];
    return !next || monthKey(next.date) !== monthKey(p.date);
  });

  return (
    <>
      <ChartCard
        title="Kosten je Monat"
        description="Grund- und Arbeitspreis gestapelt, Boni als negative Balken; die Linie ist der Abschlag."
        legend={[
          { label: 'Arbeitspreis', color: meta.color },
          { label: 'Grundpreis', color: meta.baseColor },
          { label: 'Boni', color: 'var(--chart-bonus)' },
          { label: 'Abschlag', color: INK },
        ]}
        table={
          <DataTable
            caption={`Kosten je Monat ${meta.label}`}
            head={['Monat', 'Arbeitspreis', 'Grundpreis', 'Boni', 'Abschlag']}
            rows={[...months]
              .reverse()
              .map((m) => [
                `${formatMonth(m.month)}${m.uncoveredDays > 0 ? ` (${m.uncoveredDays} Tage ohne Vertrag)` : ''}`,
                formatEur(m.energyEur),
                formatEur(m.baseEur),
                m.bonusEur < 0 ? formatEur(m.bonusEur) : '–',
                formatEur(m.installmentEur),
              ])}
          />
        }
      >
        {months.length > 0 ? (
          <MonthlyCostChart months={months} color={meta.color} baseColor={meta.baseColor} />
        ) : (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Im gewählten Zeitraum gibt es keine Kosten.
          </p>
        )}
      </ChartCard>

      {forecast && balance && costs.current && costs.cumulative.length > 0 ? (
        <ChartCard
          title="Abschläge vs. Kosten"
          description={`${costs.current.provider}, ${formatDate(forecast.periodFrom)} – ${formatDate(forecast.periodTo)} kumuliert; gestrichelt = Prognose bis Lieferende.`}
          legend={[
            { label: 'Kosten', color: meta.color },
            { label: 'Prognose', color: meta.color, variant: 'dashed' },
            { label: 'Abschläge', color: INK },
          ]}
          table={
            <DataTable
              caption={`Abschläge und Kosten kumuliert ${meta.label}`}
              head={['bis', 'Kosten', 'Abschläge', 'Differenz']}
              rows={[...monthEnds]
                .reverse()
                .map((p) => [
                  `${formatDate(p.date)}${p.projected ? ' (Prognose)' : ''}`,
                  formatEur(p.costEur),
                  formatEur(p.installmentsEur),
                  formatEur(p.installmentsEur - p.costEur),
                ])}
            />
          }
        >
          <Badge
            variant={
              balance.label === 'Guthaben'
                ? 'savings'
                : balance.label === 'Nachzahlung'
                  ? 'warning'
                  : 'secondary'
            }
          >
            Saldo: {balance.label}
            {balance.label === 'Ausgeglichen' ? '' : ` ${balance.amount}`}
          </Badge>
          <CumulativeCostChart points={costs.cumulative} color={meta.color} />
        </ChartCard>
      ) : null}

      {costs.effective.length > 0 ? (
        <ChartCard
          title="Effektivpreis je Vertragsjahr"
          description="(Arbeits- + Grundkosten − Boni) ÷ kWh – was das Wechseln bringt. * = laufendes Jahr (Prognose)."
          legend={[
            { label: 'mit Bonus', color: meta.color },
            { label: 'ohne Bonus', color: meta.color, variant: 'ghost' },
          ]}
          table={
            <DataTable
              caption={`Effektivpreis je Vertragsjahr ${meta.label}`}
              head={['Vertrag', 'kWh', 'mit Bonus', 'ohne Bonus']}
              rows={[...costs.effective]
                .reverse()
                .map((e) => [
                  `${e.label}${e.complete ? '' : ' (Prognose)'}`,
                  formatKwh(e.kwh),
                  formatCt(e.withBonusCt, 2),
                  formatCt(e.withoutBonusCt, 2),
                ])}
            />
          }
        >
          <EffectivePriceChart entries={costs.effective} color={meta.color} />
        </ChartCard>
      ) : null}
    </>
  );
}
