import { toast } from 'sonner';
import { Field } from '@/components/common/Field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { updateContract } from '@/data/repositories/contracts';
import { bonusSafety, formatDuration } from '@/domain/bonus';
import { isISODate } from '@/domain/dates';
import type { Bonus, Contract } from '@/domain/types';
import { Notice, Section } from '@/features/contracts/detail/Section';
import { BONUS_KIND_LABEL } from '@/features/contracts/labels';
import { useDraft } from '@/features/contracts/useDraft';
import { formatDate } from '@/lib/format';

type Cancellation = NonNullable<Contract['cancellation']>;

export function CancellationSection({
  contract,
  bonuses,
}: {
  contract: Contract;
  bonuses: Bonus[];
}) {
  const c = contract.cancellation ?? {};
  const { values, bind } = useDraft({
    sentAt: c.sentAt ?? '',
    channel: c.channel ?? '',
    reason: c.reason ?? 'regular',
    confirmedAt: c.confirmedAt ?? '',
    confirmedEnd: c.confirmedEnd ?? '',
  });
  const plannedEnd = isISODate(values.confirmedEnd) ? values.confirmedEnd : contract.deliveryEnd;
  const atRisk = bonuses
    .filter((b) => b.requiresDeliveryMonths && b.status !== 'forfeited')
    .map((b) => ({
      bonus: b,
      safety: bonusSafety(contract.deliveryStart, plannedEnd, b.requiresDeliveryMonths ?? 12),
    }))
    .filter((r) => r.safety.ok === false);

  return (
    <Section title="Kündigung">
      <form
        aria-label="Kündigung"
        noValidate
        className="flex flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          const cancellation: Cancellation = {
            ...(isISODate(values.sentAt) ? { sentAt: values.sentAt } : {}),
            ...(values.channel.trim() ? { channel: values.channel.trim() } : {}),
            ...(isISODate(values.confirmedAt) ? { confirmedAt: values.confirmedAt } : {}),
            ...(isISODate(values.confirmedEnd) ? { confirmedEnd: values.confirmedEnd } : {}),
            reason: values.reason,
          };
          const status: Contract['status'] = cancellation.sentAt
            ? 'cancelled'
            : contract.status === 'cancelled'
              ? 'active'
              : contract.status;
          updateContract(contract.id, {
            cancellation,
            status,
            ...(cancellation.confirmedEnd ? { deliveryEnd: cancellation.confirmedEnd } : {}),
          })
            .then(() => toast.success('Kündigung gespeichert'))
            .catch((error: unknown) =>
              toast.error(error instanceof Error ? error.message : String(error)),
            );
        }}
      >
        <div className="grid grid-cols-2 gap-3">
          <Field label="Gesendet am">
            <Input type="date" {...bind('sentAt')} />
          </Field>
          <Field label="Kanal">
            <Input autoComplete="off" placeholder="E-Mail, Kundenportal …" {...bind('channel')} />
          </Field>
          <Field label="Grund">
            <NativeSelect {...bind('reason')}>
              <option value="regular">ordentlich</option>
              <option value="price_change">Preisänderung (Sonderkündigung)</option>
              <option value="move">Umzug</option>
            </NativeSelect>
          </Field>
          <Field label="Bestätigung erhalten am">
            <Input type="date" {...bind('confirmedAt')} />
          </Field>
          <Field
            label="Bestätigtes Lieferende"
            hint="Letzter Liefertag – wird als Lieferende übernommen"
          >
            <Input type="date" {...bind('confirmedEnd')} />
          </Field>
        </div>
        {atRisk.map(({ bonus, safety }) => (
          <Notice key={bonus.id} tone="danger">
            {BONUS_KIND_LABEL[bonus.kind]} in Gefahr: nur{' '}
            {safety.delivered ? formatDuration(safety.delivered) : '–'} Belieferung. Nötiges
            Lieferende: mindestens {formatDate(safety.requiredEnd)}.
          </Notice>
        ))}
        <p className="text-xs text-muted-foreground">
          Kündigung in Textform reicht (E-Mail oder Kundenportal). Lass dir das Lieferende
          schriftlich bestätigen.
        </p>
        <Button type="submit" variant="outline" className="self-end">
          Speichern
        </Button>
      </form>
    </Section>
  );
}
