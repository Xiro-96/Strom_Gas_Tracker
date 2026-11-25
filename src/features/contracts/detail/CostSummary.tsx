import { HowCalculated } from '@/components/common/HowCalculated';
import type { ContractForecast } from '@/domain/contractForecast';
import type { AnnualForecast } from '@/domain/forecast';
import type { Contract, ISODate } from '@/domain/types';
import { Notice, Section, Stat } from '@/features/contracts/detail/Section';
import {
  BONUS_KIND_LABEL,
  currentInstallment,
  FORECAST_METHOD_LABEL,
} from '@/features/contracts/labels';
import { describeBalance, formatCt, formatDate, formatEur, formatKwh } from '@/lib/format';

function balanceText(balanceEur: number): string {
  const { label, amount } = describeBalance(balanceEur);
  if (label === 'Guthaben')
    return `Voraussichtlich ${amount} Guthaben – du könntest den Abschlag senken.`;
  if (label === 'Nachzahlung')
    return `Voraussichtlich ${amount} Nachzahlung – ein höherer Abschlag vermeidet sie.`;
  return 'Abschläge passen – voraussichtlich ausgeglichen.';
}

export function CostSummary({
  contract,
  forecast,
  annual,
  today,
}: {
  contract: Contract;
  forecast: ContractForecast;
  annual: AnnualForecast | null;
  today: ISODate;
}) {
  const { actual, total } = forecast;
  const balance = describeBalance(forecast.balanceEur);
  const installment = currentInstallment(contract, today);
  const recommended = forecast.recommendedEur;
  const lastActual = actual.coveredDays > 0 ? actual.to : null;

  return (
    <Section
      title={`Abrechnungszeitraum ${formatDate(forecast.periodFrom)} – ${formatDate(forecast.periodTo)}`}
      action={
        <HowCalculated>
          <p className="font-medium">
            Kosten je Tag = kWh × Arbeitspreis ÷ 100 + Grundpreis ÷ Tage im Jahr
          </p>
          <p>
            Verbrauch: {formatKwh(actual.kwh)} gemessen
            {forecast.projectedKwh > 0
              ? ` + ${formatKwh(forecast.projectedKwh)} Prognose (${annual ? FORECAST_METHOD_LABEL[annual.method] : '–'})`
              : ''}{' '}
            = {formatKwh(total.kwh)} an {total.days} Liefertagen.
          </p>
          <p>
            Arbeitskosten {formatEur(total.energyEur)} + Grundkosten {formatEur(total.baseEur)} ={' '}
            {formatEur(total.totalEur)}
          </p>
          <p>
            Saldo = Kosten − verrechnete Boni − Abschläge = {formatEur(total.totalEur)} −{' '}
            {formatEur(forecast.offsetBonusEur)} − {formatEur(forecast.installmentsEur)} ={' '}
            {formatEur(forecast.balanceEur)} (+ Nachzahlung, − Guthaben)
          </p>
          <p>
            Empfohlener Abschlag = (Kosten − verrechnete Boni − bereits gezahlt) ÷ offene Abschläge
            {forecast.remainingInstallments > 0
              ? ` = (${formatEur(total.totalEur)} − ${formatEur(forecast.offsetBonusEur)} − ${formatEur(forecast.paidEur)}) ÷ ${forecast.remainingInstallments}`
              : ''}
          </p>
          <p>Effektivpreis = (Arbeits- + Grundkosten − Boni) ÷ kWh × 100</p>
          <p className="text-muted-foreground">Gerundet wird nur in der Anzeige.</p>
        </HowCalculated>
      }
    >
      <dl className="grid grid-cols-2 gap-4">
        <Stat
          label="Kosten bisher"
          value={formatEur(actual.totalEur)}
          hint={
            lastActual
              ? `${formatKwh(actual.kwh)} bis ${formatDate(lastActual)}`
              : 'noch keine Messwerte'
          }
        />
        <Stat
          label="Kosten Prognose"
          value={formatEur(total.totalEur)}
          hint={formatKwh(total.kwh)}
        />
        <Stat
          label="Abschläge"
          value={formatEur(forecast.installmentsEur)}
          hint={`davon gezahlt ${formatEur(forecast.paidEur)}`}
        />
        <Stat
          label="Boni"
          value={formatEur(forecast.bonusEur)}
          hint={`verrechnet ${formatEur(forecast.offsetBonusEur)}`}
        />
        <Stat
          label="Empfohlener Abschlag"
          value={Number.isFinite(recommended) ? formatEur(Math.max(0, recommended)) : '–'}
          hint={
            Number.isFinite(recommended)
              ? `pro Monat · aktuell ${installment ? formatEur(installment.amountEur) : '–'}`
              : 'keine offenen Abschläge'
          }
        />
        <Stat
          label="Effektivpreis"
          value={
            Number.isFinite(forecast.effective.withBonusCt)
              ? formatCt(forecast.effective.withBonusCt)
              : '–'
          }
          hint={
            Number.isFinite(forecast.effective.withoutBonusCt)
              ? `ohne Bonus ${formatCt(forecast.effective.withoutBonusCt)}`
              : undefined
          }
        />
      </dl>
      <Notice
        tone={
          balance.label === 'Nachzahlung'
            ? 'warning'
            : balance.label === 'Guthaben'
              ? 'savings'
              : 'muted'
        }
      >
        <p className="font-medium">
          Saldo: {balance.label}
          {balance.label === 'Ausgeglichen' ? '' : ` ${balance.amount}`}
        </p>
        <p>{balanceText(forecast.balanceEur)}</p>
      </Notice>
      {forecast.bonusWarnings.map((warning) => (
        <Notice key={`${warning.kind}-${warning.amountEur}`} tone="danger">
          {BONUS_KIND_LABEL[warning.kind]} {formatEur(warning.amountEur)} in Gefahr: Lieferung bis
          mindestens {formatDate(warning.requiredEnd)} nötig. Er ist nicht im Saldo enthalten.
        </Notice>
      ))}
      {annual === null && total.missingDays > 0 ? (
        <Notice tone="muted">
          Noch keine Prognose möglich – {total.missingDays} Liefertage ohne Verbrauchswert sind
          nicht bewertet. Mit weiteren Ablesungen wird die Rechnung vollständig.
        </Notice>
      ) : annual?.uncertain ? (
        <Notice tone="muted">Prognose unsicher – noch wenige Ablesungen (±20 %).</Notice>
      ) : null}
    </Section>
  );
}
