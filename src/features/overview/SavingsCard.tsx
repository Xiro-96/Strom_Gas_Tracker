import type { SwitchSavings } from '@/domain/savings';
import type { EnergyType } from '@/domain/types';
import { Section } from '@/features/contracts/detail/Section';
import type { EnergyCosts } from '@/features/contracts/useCostData';
import { ENERGY, ENERGY_TYPES } from '@/features/shared/energy';
import { formatDate, formatEur } from '@/lib/format';
import { cn } from '@/lib/utils';

const verdict = (eur: number) =>
  eur >= 0 ? `${formatEur(eur)} gespart` : `${formatEur(-eur)} mehr bezahlt`;

/** Spec Phase 4 – Wechsel-Bilanz „Durch Wechseln gespart seit …“ gegenüber dem Referenztarif. */
export function SavingsCard({
  byEnergy,
  labels,
}: {
  byEnergy: Partial<Record<EnergyType, EnergyCosts>>;
  labels: Partial<Record<EnergyType, string>>;
}) {
  const entries = ENERGY_TYPES.flatMap((e) => {
    const savings = byEnergy[e]?.savings;
    return savings ? [{ energy: e, savings }] : [];
  });
  if (entries.length === 0) return null;
  const total = entries.reduce((s, x) => s + x.savings.savedEur, 0);
  const since = entries.map((x) => x.savings.since).sort()[0] ?? '';
  return (
    <Section
      title="Durch Wechseln gespart"
      description={`seit ${formatDate(since)} gegenüber dem Referenztarif`}
    >
      <p
        className={cn(
          'text-2xl font-semibold tabular-nums',
          total >= 0 ? 'text-savings' : 'text-warning',
        )}
      >
        {verdict(total)}
      </p>
      <ul className="flex flex-col gap-1 text-sm">
        {entries.map(({ energy, savings }: { energy: EnergyType; savings: SwitchSavings }) => (
          <li key={energy} className="flex justify-between gap-3">
            <span className="text-muted-foreground">
              {ENERGY[energy].label} ggü. {labels[energy] ?? 'Referenz'}
            </span>
            <span className="tabular-nums">{verdict(savings.savedEur)}</span>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">
        Tatsächliche Kosten abzüglich erhaltener Boni gegenüber dem Referenztarif, für jeden
        belieferten Tag.
      </p>
    </Section>
  );
}
