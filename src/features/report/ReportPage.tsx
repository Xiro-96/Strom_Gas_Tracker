import { FileChartColumn, Printer } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { EmptyState } from '@/components/common/EmptyState';
import { PageHeader } from '@/components/common/PageHeader';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { NativeSelect } from '@/components/ui/native-select';
import { yearReport } from '@/domain/report';
import { switchSavings } from '@/domain/savings';
import { todayISO } from '@/domain/dates';
import { Section } from '@/features/contracts/detail/Section';
import { useCostData } from '@/features/contracts/useCostData';
import { ENERGY } from '@/features/shared/energy';
import {
  formatCt,
  formatDate,
  formatEur,
  formatKwh,
  formatMonth,
  formatNumber,
} from '@/lib/format';

/** Drucken im hellen Design – „Als PDF sichern“ im Druckdialog. */
function printLight() {
  const html = document.documentElement;
  const wasDark = html.classList.contains('dark');
  if (wasDark) html.classList.remove('dark');
  const restore = () => {
    if (wasDark) html.classList.add('dark');
    window.removeEventListener('afterprint', restore);
  };
  window.addEventListener('afterprint', restore);
  window.print();
}

const Row = ({ label, value }: { label: string; value: string }) => (
  <div className="contents">
    <dt className="text-muted-foreground">{label}</dt>
    <dd className="text-right tabular-nums">{value}</dd>
  </div>
);

/** Spec Phase 4 – Jahresbericht als Druckansicht. */
export function ReportPage() {
  const cost = useCostData();
  const [chosen, setChosen] = useState<number | undefined>();
  const header = (
    <PageHeader title="Jahresbericht" description="Verbrauch, Kosten und Verträge eines Jahres" />
  );
  if (cost.status === 'loading') {
    return (
      <>
        {header}
        <Card className="h-64 animate-pulse bg-muted/40" aria-busy="true" aria-label="Lädt" />
      </>
    );
  }
  const energies = cost.energy.energies;
  const years = [
    ...new Set(
      energies.flatMap((e) =>
        (cost.energy.analyses[e]?.daily ?? []).map((p) => Number(p.date.slice(0, 4))),
      ),
    ),
  ].sort((a, b) => b - a);
  const fallbackYear = Number(todayISO().slice(0, 4));
  const year = chosen !== undefined && years.includes(chosen) ? chosen : (years[0] ?? fallbackYear);
  if (years.length === 0) {
    return (
      <>
        {header}
        <EmptyState
          icon={FileChartColumn}
          title="Noch keine Verbrauchsdaten"
          description="Ab der zweiten Ablesung entsteht hier ein Jahresbericht zum Ausdrucken oder als PDF."
          action={
            <Button asChild>
              <Link to="/">Zur Übersicht</Link>
            </Button>
          }
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={`Jahresbericht ${String(year)}`}
        description={`Strom & Gas Tracker · erstellt am ${formatDate(todayISO())}`}
        actions={
          <Button className="print:hidden" onClick={printLight}>
            <Printer aria-hidden="true" />
            Drucken / PDF
          </Button>
        }
      />
      <div className="flex items-end gap-3 print:hidden">
        <label className="flex flex-col gap-2 text-sm font-medium">
          Jahr
          <NativeSelect
            value={String(year)}
            onChange={(e) => {
              setChosen(Number(e.target.value));
            }}
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </NativeSelect>
        </label>
      </div>
      {energies.map((energy) => {
        const analysis = cost.energy.analyses[energy];
        const costs = cost.byEnergy[energy];
        if (!analysis) return null;
        const r = yearReport({ year, daily: analysis.daily, bundles: costs?.bundles ?? [] });
        if (r.days === 0) return null;
        const reference = cost.energy.settings.referenceTariffs.find(
          (t) => t.energyType === energy,
        );
        const daily = analysis.daily.filter((p) => p.date.startsWith(String(year)));
        const savings = reference
          ? switchSavings({ bundles: costs?.bundles ?? [], daily, reference })
          : null;
        const label = ENERGY[energy].label;
        return (
          <Section
            key={energy}
            title={label}
            description={`${String(r.days)} Tage mit Verbrauch${r.lastDataDay ? `, bis ${formatDate(r.lastDataDay)}` : ''}`}
          >
            <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-sm">
              <Row label="Verbrauch" value={formatKwh(r.kwh)} />
              <Row label="Arbeitspreis" value={formatEur(r.energyEur)} />
              <Row label="Grundpreis" value={formatEur(r.baseEur)} />
              <Row
                label="Boni (erhalten/verrechnet)"
                value={r.bonusEur > 0 ? `−${formatEur(r.bonusEur)}` : formatEur(0)}
              />
              <Row label="Kosten gesamt" value={formatEur(r.energyEur + r.baseEur - r.bonusEur)} />
              <Row
                label="Effektivpreis"
                value={Number.isFinite(r.effectiveCt) ? formatCt(r.effectiveCt, 2) : '–'}
              />
              {savings && reference ? (
                <Row
                  label={`Ggü. ${reference.label}`}
                  value={
                    savings.savedEur >= 0
                      ? `${formatEur(savings.savedEur)} gespart`
                      : `${formatEur(-savings.savedEur)} mehr`
                  }
                />
              ) : null}
            </dl>
            <table className="w-full text-sm tabular-nums">
              <caption className="sr-only">{`Monatswerte ${label} ${String(year)}`}</caption>
              <thead className="text-left text-xs text-muted-foreground">
                <tr>
                  <th scope="col" className="py-1.5 pr-3 font-medium">
                    Monat
                  </th>
                  <th scope="col" className="py-1.5 pl-3 text-right font-medium">
                    kWh
                  </th>
                  <th scope="col" className="py-1.5 pl-3 text-right font-medium">
                    Kosten
                  </th>
                  <th scope="col" className="py-1.5 pl-3 text-right font-medium">
                    Abschlag
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {r.months.map((m) => (
                  <tr key={m.month}>
                    <td className="py-1 pr-3">
                      {formatMonth(m.month).replace(` ${String(year)}`, '')}
                    </td>
                    <td className="py-1 pl-3 text-right">{formatNumber(m.kwh, 0, 0)}</td>
                    <td className="py-1 pl-3 text-right">{formatEur(m.energyEur + m.baseEur)}</td>
                    <td className="py-1 pl-3 text-right">{formatEur(m.installmentEur)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {r.contracts.length > 0 ? (
              <ul className="text-sm" aria-label={`Verträge ${label} ${String(year)}`}>
                {r.contracts.map((c) => (
                  <li key={c.id}>
                    {c.provider} ({c.tariffName}): {formatDate(c.from)} –{' '}
                    {c.to ? formatDate(c.to) : 'läuft'}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                Kein Vertrag erfasst – Kosten nicht bewertet.
              </p>
            )}
          </Section>
        );
      })}
      <p className="text-xs text-muted-foreground">
        Monatswerte aus der Tagesverteilung der Ablesungen (Gas mit Gradtag-Gewichtung). Info, ohne
        Gewähr.
      </p>
    </>
  );
}
