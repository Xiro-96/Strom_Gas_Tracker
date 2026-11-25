import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Field } from '@/components/common/Field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { bills as billRepo, transactions as txRepo } from '@/data/repositories/contracts';
import { isISODate } from '@/domain/dates';
import type { Bill, Contract, ISODate, Transaction } from '@/domain/types';
import { Section } from '@/features/contracts/detail/Section';
import { BILL_KIND_LABEL, parseDecimal, TRANSACTION_KIND_LABEL } from '@/features/contracts/labels';
import { useDraft } from '@/features/contracts/useDraft';
import { describeBalance, formatDate, formatEur, formatKwh } from '@/lib/format';

const demoFlag = (contract: Contract) => (contract.isDemo ? { isDemo: true } : {});

export function TransactionsSection({
  contract,
  transactions,
  today,
}: {
  contract: Contract;
  transactions: Transaction[];
  today: ISODate;
}) {
  const [adding, setAdding] = useState(false);
  return (
    <Section
      title="Zahlungen"
      action={
        adding ? null : (
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setAdding(true);
            }}
          >
            <Plus aria-hidden="true" />
            Zahlung
          </Button>
        )
      }
    >
      <p className="text-xs text-muted-foreground">
        Abschläge laut Plan zählen automatisch. Hier nur Abweichungen erfassen (z. B. ausgefallener
        Abschlag) sowie Bonus-Auszahlungen, Erstattungen und Rechnungsausgleich.
      </p>
      {transactions.length > 0 ? (
        <ul className="flex flex-col divide-y">
          {[...transactions].reverse().map((tx) => (
            <li key={tx.id} className="flex items-center justify-between gap-3 py-2 text-sm">
              <div className="flex flex-col">
                <span className="font-medium">
                  {formatDate(tx.date)} · {TRANSACTION_KIND_LABEL[tx.kind]}
                </span>
                <span className="text-muted-foreground">
                  {tx.amountEur >= 0 ? 'an den Anbieter' : 'vom Anbieter / nicht gezahlt'}{' '}
                  {formatEur(Math.abs(tx.amountEur))}
                  {tx.note ? ` · ${tx.note}` : ''}
                </span>
              </div>
              <Button
                size="icon"
                variant="ghost"
                aria-label={`Zahlung vom ${formatDate(tx.date)} löschen`}
                onClick={() => {
                  void txRepo.remove(tx.id);
                }}
              >
                <Trash2 aria-hidden="true" />
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
      {adding ? (
        <TransactionForm
          contract={contract}
          today={today}
          onDone={() => {
            setAdding(false);
          }}
        />
      ) : null}
    </Section>
  );
}

function TransactionForm({
  contract,
  today,
  onDone,
}: {
  contract: Contract;
  today: ISODate;
  onDone: () => void;
}) {
  const { values, bind } = useDraft({
    date: today,
    amount: '',
    direction: 'in',
    kind: 'installment',
    note: '',
  });
  const [errors, setErrors] = useState<{ date?: string; amount?: string }>({});
  return (
    <form
      aria-label="Zahlung erfassen"
      noValidate
      className="flex flex-col gap-3 rounded-xl border p-3"
      onSubmit={(event) => {
        event.preventDefault();
        const amount = parseDecimal(values.amount);
        const next: typeof errors = {};
        if (!isISODate(values.date)) next.date = 'Bitte das Datum wählen.';
        if (!(amount > 0)) next.amount = 'Bitte den Betrag angeben.';
        setErrors(next);
        if (Object.keys(next).length > 0) return;
        void txRepo
          .add({
            contractId: contract.id,
            date: values.date,
            amountEur: values.direction === 'in' ? amount : -amount,
            kind: values.kind as Transaction['kind'],
            ...(values.note ? { note: values.note } : {}),
            ...demoFlag(contract),
          })
          .then(() => {
            toast.success('Zahlung gespeichert');
            onDone();
          });
      }}
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="Datum" error={errors.date}>
          <Input type="date" {...bind('date')} />
        </Field>
        <Field label="Betrag (€)" error={errors.amount}>
          <Input inputMode="decimal" autoComplete="off" {...bind('amount')} />
        </Field>
        <Field label="Richtung">
          <NativeSelect {...bind('direction')}>
            <option value="in">an den Anbieter</option>
            <option value="out">vom Anbieter / nicht gezahlt</option>
          </NativeSelect>
        </Field>
        <Field label="Art">
          <NativeSelect {...bind('kind')}>
            {Object.entries(TRANSACTION_KIND_LABEL).map(([value, text]) => (
              <option key={value} value={value}>
                {text}
              </option>
            ))}
          </NativeSelect>
        </Field>
      </div>
      <Field label="Notiz (optional)">
        <Input autoComplete="off" {...bind('note')} />
      </Field>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onDone}>
          Abbrechen
        </Button>
        <Button type="submit">Speichern</Button>
      </div>
    </form>
  );
}

export function BillsSection({ contract, bills }: { contract: Contract; bills: Bill[] }) {
  const [adding, setAdding] = useState(false);
  return (
    <Section
      title="Rechnungen"
      action={
        adding ? null : (
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setAdding(true);
            }}
          >
            <Plus aria-hidden="true" />
            Rechnung
          </Button>
        )
      }
    >
      {bills.length === 0 && !adding ? (
        <p className="text-sm text-muted-foreground">Noch keine Rechnung erfasst.</p>
      ) : null}
      <ul className="flex flex-col divide-y">
        {bills.map((bill) => {
          const balance = bill.balanceEur !== undefined ? describeBalance(bill.balanceEur) : null;
          return (
            <li key={bill.id} className="flex items-center justify-between gap-3 py-2 text-sm">
              <div className="flex flex-col">
                <span className="font-medium">
                  {BILL_KIND_LABEL[bill.kind]} {formatDate(bill.periodFrom)} –{' '}
                  {formatDate(bill.periodTo)}
                </span>
                <span className="text-muted-foreground">
                  {[
                    bill.consumptionKwh !== undefined ? formatKwh(bill.consumptionKwh) : null,
                    bill.totalEur !== undefined ? formatEur(bill.totalEur) : null,
                    balance
                      ? `${balance.label}${balance.label === 'Ausgeglichen' ? '' : ` ${balance.amount}`}`
                      : null,
                    bill.bonusIncluded ? 'Bonus verrechnet' : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </div>
              <Button
                size="icon"
                variant="ghost"
                aria-label={`${BILL_KIND_LABEL[bill.kind]} bis ${formatDate(bill.periodTo)} löschen`}
                onClick={() => {
                  void billRepo.remove(bill.id);
                }}
              >
                <Trash2 aria-hidden="true" />
              </Button>
            </li>
          );
        })}
      </ul>
      {adding ? (
        <BillForm
          contract={contract}
          onDone={() => {
            setAdding(false);
          }}
        />
      ) : null}
    </Section>
  );
}

function BillForm({ contract, onDone }: { contract: Contract; onDone: () => void }) {
  const { values, bind } = useDraft({
    kind: contract.deliveryEnd ? 'final' : 'annual',
    periodFrom: contract.deliveryStart,
    periodTo: contract.deliveryEnd ?? '',
    issuedAt: '',
    consumption: '',
    total: '',
    balance: '',
    balanceKind: 'credit',
    bonusIncluded: 'no',
  });
  const [error, setError] = useState<string>();
  return (
    <form
      aria-label="Rechnung erfassen"
      noValidate
      className="flex flex-col gap-3 rounded-xl border p-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (
          !isISODate(values.periodFrom) ||
          !isISODate(values.periodTo) ||
          values.periodTo < values.periodFrom
        ) {
          setError('Bitte den Abrechnungszeitraum angeben.');
          return;
        }
        const consumption = parseDecimal(values.consumption);
        const total = parseDecimal(values.total);
        const balance = parseDecimal(values.balance);
        void billRepo
          .add({
            contractId: contract.id,
            kind: values.kind === 'final' ? 'final' : 'annual',
            periodFrom: values.periodFrom,
            periodTo: values.periodTo,
            ...(isISODate(values.issuedAt) ? { issuedAt: values.issuedAt } : {}),
            ...(Number.isFinite(consumption) ? { consumptionKwh: consumption } : {}),
            ...(Number.isFinite(total) ? { totalEur: total } : {}),
            ...(Number.isFinite(balance)
              ? {
                  balanceEur:
                    values.balanceKind === 'credit' ? -Math.abs(balance) : Math.abs(balance),
                }
              : {}),
            bonusIncluded: values.bonusIncluded === 'yes',
            ...demoFlag(contract),
          })
          .then(() => {
            toast.success('Rechnung gespeichert');
            onDone();
          });
      }}
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="Art">
          <NativeSelect {...bind('kind')}>
            <option value="annual">Jahresrechnung</option>
            <option value="final">Schlussrechnung</option>
          </NativeSelect>
        </Field>
        <Field label="Rechnungsdatum">
          <Input type="date" {...bind('issuedAt')} />
        </Field>
        <Field label="Zeitraum von" error={error}>
          <Input type="date" {...bind('periodFrom')} />
        </Field>
        <Field label="Zeitraum bis">
          <Input type="date" {...bind('periodTo')} />
        </Field>
        <Field label="Verbrauch (kWh)">
          <Input inputMode="decimal" autoComplete="off" {...bind('consumption')} />
        </Field>
        <Field label="Gesamtkosten (€)">
          <Input inputMode="decimal" autoComplete="off" {...bind('total')} />
        </Field>
        <Field label="Saldo (€)">
          <Input inputMode="decimal" autoComplete="off" {...bind('balance')} />
        </Field>
        <Field label="Saldo ist">
          <NativeSelect {...bind('balanceKind')}>
            <option value="credit">Guthaben</option>
            <option value="debit">Nachzahlung</option>
          </NativeSelect>
        </Field>
        <Field label="Bonus verrechnet?">
          <NativeSelect {...bind('bonusIncluded')}>
            <option value="no">nein</option>
            <option value="yes">ja</option>
          </NativeSelect>
        </Field>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onDone}>
          Abbrechen
        </Button>
        <Button type="submit">Speichern</Button>
      </div>
    </form>
  );
}
