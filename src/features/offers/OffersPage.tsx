import { ExternalLink, FilePlus2, Plus, Tags, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { ChartCard, DataTable } from '@/components/charts/ChartCard';
import { EmptyState } from '@/components/common/EmptyState';
import { Field } from '@/components/common/Field';
import { PageHeader } from '@/components/common/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useOffers } from '@/data/hooks';
import { deleteOffer } from '@/data/repositories/offers';
import { pricePeriodAt } from '@/domain/costs';
import { addDays } from '@/domain/dates';
import { DEFAULT_GAS_FACTORS, gasFactorsAt } from '@/domain/gas';
import { breakEvenKwh, offerWarnings, rankOffers, type RankedOffer } from '@/domain/offers';
import type { EnergyType, Offer } from '@/domain/types';
import { ContractWizard, type WizardInitial } from '@/features/contracts/ContractWizard';
import { Notice, Section } from '@/features/contracts/detail/Section';
import { currentMeters, parseDecimal } from '@/features/contracts/labels';
import { useCostData } from '@/features/contracts/useCostData';
import { OfferBars } from '@/features/offers/OfferBars';
import { OfferDialog } from '@/features/offers/OfferDialog';
import { ENERGY, ENERGY_TYPES } from '@/features/shared/energy';
import { formatCt, formatEur, formatKwh, formatNumber } from '@/lib/format';

const decimal = (n: number, digits: number) => formatNumber(n, 0, digits).replace(/\./g, '');

function wizardInitial(offer: Offer, deliveryStart: string): WizardInitial {
  return {
    energyType: offer.energyType,
    provider: offer.provider,
    providerGroup: offer.providerGroup ?? '',
    tariffName: offer.tariffName,
    deliveryStart,
    energyPrice: decimal(offer.energyPriceCt, 4),
    energyPriceUnit: 'ct_per_kwh',
    basePrice: decimal(offer.basePriceEurPerYear, 2),
    basePriceUnit: 'year',
    minTermMonths: offer.minTermMonths ? String(offer.minTermMonths) : '12',
    guaranteeScope: offer.priceGuaranteeScope ?? 'limited',
    bonuses: offer.bonuses.map((b) => ({
      kind: b.kind,
      amount: decimal(b.amountEur, 2),
      settlement: b.kind === 'instant' ? ('payout' as const) : ('offset_in_bill' as const),
      requiresDeliveryMonths: b.requiresDeliveryMonths ? String(b.requiresDeliveryMonths) : '',
      condition: '',
    })),
  };
}

const savingText = (eur: number | undefined, against: string) =>
  eur === undefined
    ? null
    : eur >= 0.5
      ? `${formatEur(eur)} günstiger als ${against}`
      : eur <= -0.5
        ? `${formatEur(-eur)} teurer als ${against}`
        : `so teuer wie ${against}`;

export function OffersPage() {
  const cost = useCostData();
  const offers = useOffers();
  const [selected, setSelected] = useState<EnergyType | undefined>();
  const [kwhInput, setKwhInput] = useState<Partial<Record<EnergyType, string>>>({});
  const [dialogOpen, setDialogOpen] = useState(false);
  const [wizard, setWizard] = useState<WizardInitial | null>(null);
  const header = (
    <PageHeader title="Angebote" description="Mit deinem echten Verbrauch vergleichen" />
  );

  if (cost.status === 'loading' || !offers) {
    return (
      <>
        {header}
        <Card className="h-64 animate-pulse bg-muted/40" aria-busy="true" aria-label="Lädt" />
      </>
    );
  }

  const { energy: energyData, contracts, today } = cost;
  const available = energyData.energies.length > 0 ? energyData.energies : ENERGY_TYPES;
  const energy =
    selected && available.includes(selected) ? selected : (available[0] ?? 'electricity');
  const meta = ENERGY[energy];
  const costs = cost.byEnergy[energy];
  const forecastKwh = costs?.annual?.kwh;
  const kwhText =
    kwhInput[energy] ?? (forecastKwh ? String(Math.round(forecastKwh / 10) * 10) : '');
  const kwh = parseDecimal(kwhText);
  const validKwh = Number.isFinite(kwh) && kwh > 0;
  const active = costs?.active;
  const currentPrice = active ? pricePeriodAt(active.periods, today) : undefined;
  const reference = energyData.settings.referenceTariffs.find((r) => r.energyType === energy);
  const list = offers.filter((o) => o.energyType === energy);
  const ranked: RankedOffer<Offer>[] = validKwh
    ? rankOffers(list, kwh, { current: currentPrice, reference })
    : [];
  const meters = currentMeters(energyData.meters);
  const gasMeter = meters.gas;
  const gasFactors = gasMeter ? gasFactorsAt(gasMeter, today) : DEFAULT_GAS_FACTORS;
  const switchStart = active?.deliveryEnd ? addDays(active.deliveryEnd, 1) : today;
  const [first, second] = ranked;
  const breakEven = first && second ? breakEvenKwh(first.offer, second.offer) : null;

  return (
    <>
      <PageHeader
        title="Angebote"
        description="Mit deinem echten Verbrauch vergleichen"
        actions={
          <Button
            onClick={() => {
              setDialogOpen(true);
            }}
          >
            <Plus aria-hidden="true" />
            Angebot erfassen
          </Button>
        }
      />
      <div className="flex flex-wrap items-end gap-3">
        <ToggleGroup
          type="single"
          aria-label="Energieart"
          value={energy}
          onValueChange={(v) => {
            if (v === 'electricity' || v === 'gas') setSelected(v);
          }}
        >
          {ENERGY_TYPES.map((type) => {
            const Icon = ENERGY[type].icon;
            return (
              <ToggleGroupItem key={type} value={type} aria-label={ENERGY[type].label}>
                <Icon aria-hidden="true" className={ENERGY[type].text} />
                {ENERGY[type].label}
              </ToggleGroupItem>
            );
          })}
        </ToggleGroup>
        <Field
          label="Verbrauch pro Jahr (kWh)"
          className="w-48"
          hint={
            forecastKwh
              ? `Prognose: ${formatKwh(forecastKwh)}`
              : 'Noch keine Prognose – Wert eintragen'
          }
        >
          <Input
            inputMode="decimal"
            value={kwhText}
            onChange={(e) => {
              setKwhInput((s) => ({ ...s, [energy]: e.target.value }));
            }}
          />
        </Field>
      </div>

      {list.length === 0 ? (
        <EmptyState
          icon={Tags}
          title={`Noch keine ${meta.label}angebote`}
          description="Trage Angebote aus Vergleichsportalen oder vom Anbieter ein. Die App rechnet mit deinem Verbrauch und zeigt Jahr 1 mit Bonus und das Folgejahr ohne Bonus."
          action={
            <Button
              onClick={() => {
                setDialogOpen(true);
              }}
            >
              <Plus aria-hidden="true" />
              Angebot erfassen
            </Button>
          }
        />
      ) : !validKwh ? (
        <Notice tone="warning">Bitte den Jahresverbrauch eintragen, um zu vergleichen.</Notice>
      ) : (
        <>
          <ol aria-label={`${meta.label}angebote nach Jahr 1`} className="flex flex-col gap-3">
            {ranked.map((r) => (
              <OfferCard
                key={r.offer.id}
                ranked={r}
                warnings={offerWarnings(r.offer, { contracts: contracts.contracts, today, kwh })}
                hasCurrent={currentPrice !== undefined}
                referenceLabel={reference?.label}
                onContract={() => {
                  setWizard(wizardInitial(r.offer, switchStart));
                }}
              />
            ))}
          </ol>

          {breakEven && first && second ? (
            <Section title="Break-even" description="Folgejahr ohne Bonus">
              <p className="text-sm">
                Zwischen <strong>{first.offer.provider}</strong> und{' '}
                <strong>{second.offer.provider}</strong>: ab {formatKwh(breakEven.kwh)} pro Jahr ist{' '}
                <strong>{(breakEven.cheaperAbove === 'a' ? first : second).offer.provider}</strong>{' '}
                im Folgejahr günstiger, darunter{' '}
                {(breakEven.cheaperAbove === 'a' ? second : first).offer.provider}. Dein Verbrauch:{' '}
                {formatKwh(kwh)}.
              </p>
            </Section>
          ) : null}

          <ChartCard
            title="Jahr 1 und Folgejahr"
            description="Jahr 1 mit Bonus, Folgejahr ohne – Portale ranken nur nach Jahr 1. Der Preis nach der Garantie ist unbekannt."
            legend={[
              { label: 'Jahr 1', color: meta.color, variant: 'swatch' },
              { label: 'Folgejahr', color: meta.color, variant: 'ghost' },
            ]}
            table={
              <DataTable
                caption={`${meta.label}angebote Jahr 1 und Folgejahr`}
                head={['Angebot', 'Jahr 1', 'Folgejahr', '2 Jahre']}
                rows={ranked.map((r) => [
                  `${r.offer.provider} – ${r.offer.tariffName}`,
                  formatEur(r.costs.year1Eur),
                  formatEur(r.costs.followYearEur),
                  formatEur(r.costs.twoYearEur),
                ])}
              />
            }
          >
            <OfferBars
              color={meta.color}
              data={[
                ...ranked.map((r) => ({
                  name: r.offer.provider,
                  year1Eur: r.costs.year1Eur,
                  followYearEur: r.costs.followYearEur,
                })),
                ...(currentPrice
                  ? [
                      {
                        name: 'Aktuell',
                        year1Eur:
                          (kwh * currentPrice.energyPriceCt) / 100 +
                          currentPrice.basePriceEurPerYear,
                        followYearEur:
                          (kwh * currentPrice.energyPriceCt) / 100 +
                          currentPrice.basePriceEurPerYear,
                      },
                    ]
                  : []),
              ]}
            />
          </ChartCard>
        </>
      )}
      <p className="text-xs text-muted-foreground">
        Portale rechnen mit geschätztem Verbrauch und ranken nach den Kosten im ersten Jahr
        inklusive Bonus. Hier zählt dein Prognoseverbrauch{energy === 'gas' ? ' (Normaljahr)' : ''}.
        Info, ohne Gewähr.
      </p>

      <OfferDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        energyType={energy}
        gasFactors={gasFactors}
      />
      <ContractWizard
        open={wizard !== null}
        onOpenChange={(open) => {
          if (!open) setWizard(null);
        }}
        meters={meters}
        defaultEnergy={energy}
        {...(wizard ? { initial: wizard } : {})}
      />
    </>
  );
}

function OfferCard({
  ranked,
  warnings,
  hasCurrent,
  referenceLabel,
  onContract,
}: {
  ranked: RankedOffer<Offer>;
  warnings: { code: string; text: string }[];
  hasCurrent: boolean;
  referenceLabel: string | undefined;
  onContract: () => void;
}) {
  const { offer, costs } = ranked;
  const vsCurrent = hasCurrent ? savingText(ranked.savingVsCurrentEur, 'dein Vertrag') : null;
  const vsReference = referenceLabel
    ? savingText(ranked.savingVsReferenceEur, referenceLabel)
    : null;
  return (
    <li className="flex flex-col gap-3 rounded-2xl border bg-card p-4 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold">
            {ranked.rankYear1}. {offer.provider}
          </p>
          <p className="truncate text-sm text-muted-foreground">
            {offer.tariffName} · {formatCt(offer.energyPriceCt)} ·{' '}
            {formatEur(offer.basePriceEurPerYear)}/Jahr
          </p>
        </div>
        {ranked.rankTwoYear === 1 ? <Badge variant="savings">günstigste 2 Jahre</Badge> : null}
      </div>
      <dl className="grid grid-cols-3 gap-2 text-sm">
        <div>
          <dt className="text-xs text-muted-foreground">Jahr 1</dt>
          <dd className="font-semibold tabular-nums">{formatEur(costs.year1Eur)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Folgejahr</dt>
          <dd className="font-semibold tabular-nums">{formatEur(costs.followYearEur)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">2 Jahre</dt>
          <dd className="font-semibold tabular-nums">{formatEur(costs.twoYearEur)}</dd>
        </div>
      </dl>
      <p className="text-xs text-muted-foreground">
        Effektiv {formatCt(costs.effectiveYear1Ct, 2)} im 1. Jahr,{' '}
        {formatCt(costs.effectiveFollowCt, 2)} danach
        {costs.bonusEur > 0 ? ` · Boni ${formatEur(costs.bonusEur)}` : ''}
        {offer.priceGuaranteeMonths
          ? ` · Preisgarantie ${String(offer.priceGuaranteeMonths)} Monate`
          : ''}
      </p>
      {vsCurrent || vsReference ? (
        <p className="text-sm">{[vsCurrent, vsReference].filter(Boolean).join(' · ')} (Jahr 1)</p>
      ) : null}
      {warnings.map((w) => (
        <Notice key={w.code} tone="warning">
          {w.text}
        </Notice>
      ))}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={onContract}>
          <FilePlus2 aria-hidden="true" />
          Als neuen Vertrag anlegen
        </Button>
        {offer.url ? (
          <Button asChild size="sm" variant="ghost">
            <a href={offer.url} target="_blank" rel="noopener noreferrer">
              <ExternalLink aria-hidden="true" />
              Zum Angebot
            </a>
          </Button>
        ) : null}
        <Button
          size="sm"
          variant="ghost"
          aria-label={`Angebot ${offer.provider} löschen`}
          onClick={() => {
            void deleteOffer(offer.id);
          }}
        >
          <Trash2 aria-hidden="true" />
        </Button>
      </div>
    </li>
  );
}
