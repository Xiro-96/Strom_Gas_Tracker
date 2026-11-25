import { useState } from 'react';
import { toast } from 'sonner';
import { Field } from '@/components/common/Field';
import { IssueList } from '@/components/common/IssueList';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { addReading, updateReading } from '@/data/repositories/readings';
import { todayISO } from '@/domain/dates';
import { parseMeterInput } from '@/domain/parse';
import { checkReading } from '@/domain/plausibility';
import type { Meter, Reading, ReadingKind } from '@/domain/types';
import { KIND_LABEL } from '@/features/history/kinds';
import { meterInputValue, UNIT_LABEL } from '@/lib/format';

const EDITABLE_KINDS: ReadingKind[] = ['regular', 'switch', 'from_bill', 'estimated'];

interface ReadingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  meter: Meter;
  readings: Reading[];
  baseLoadShare: number;
  /** Bearbeiten statt Nachtragen. */
  reading?: Reading;
}

export function ReadingDialog(props: ReadingDialogProps) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent>
        {props.open ? <ReadingForm key={props.reading?.id ?? 'neu'} {...props} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function ReadingForm({
  onOpenChange,
  meter,
  readings,
  baseLoadShare,
  reading,
}: ReadingDialogProps) {
  const today = todayISO();
  const [value, setValue] = useState(reading ? meterInputValue(reading.value, meter.decimals) : '');
  const [date, setDate] = useState(reading?.date ?? today);
  const [kind, setKind] = useState<ReadingKind>(reading?.kind ?? 'regular');
  const [note, setNote] = useState(reading?.note ?? '');
  const parsed = parseMeterInput(value, { decimals: meter.decimals });
  const check = parsed.ok
    ? checkReading({
        value: parsed.value,
        date,
        today,
        fractionDigits: parsed.fractionDigits,
        meter,
        readings: readings.filter((r) => r.meterId === meter.id),
        baseLoadShare,
        editingId: reading?.id,
      })
    : null;
  const replacesSameDay = check?.issues.some((i) => i.code === 'same_date') ?? false;

  const save = async () => {
    if (!parsed.ok || !check?.canSave) return;
    const fields = { date, value: parsed.value, kind, note: note.trim() || undefined };
    if (reading) await updateReading(reading.id, fields);
    else await addReading({ meterId: meter.id, ...fields }, { replaceSameDate: replacesSameDay });
    toast.success(reading ? 'Ablesung geändert' : 'Ablesung nachgetragen');
    onOpenChange(false);
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>{reading ? 'Ablesung bearbeiten' : 'Ablesung nachtragen'}</DialogTitle>
        <DialogDescription>{meter.name}</DialogDescription>
      </DialogHeader>
      <form
        className="flex flex-col gap-4"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <div className="grid grid-cols-2 gap-3">
          <Field label="Datum">
            <Input
              type="date"
              max={today}
              value={date}
              onChange={(e) => {
                setDate(e.target.value);
              }}
            />
          </Field>
          <Field
            label={`Stand (${UNIT_LABEL[meter.unit]})`}
            error={parsed.ok || value === '' ? undefined : parsed.error}
          >
            <Input
              inputMode="decimal"
              autoComplete="off"
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
              }}
            />
          </Field>
        </div>
        <Field label="Art">
          <NativeSelect
            value={kind}
            onChange={(e) => {
              setKind(e.target.value as ReadingKind);
            }}
          >
            {(EDITABLE_KINDS.includes(kind) ? EDITABLE_KINDS : [kind, ...EDITABLE_KINDS]).map(
              (k) => (
                <option key={k} value={k}>
                  {KIND_LABEL[k]}
                </option>
              ),
            )}
          </NativeSelect>
        </Field>
        <Field label="Notiz (optional)">
          <Input
            value={note}
            maxLength={200}
            onChange={(e) => {
              setNote(e.target.value);
            }}
          />
        </Field>
        {check ? <IssueList issues={check.issues} /> : null}
        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              onOpenChange(false);
            }}
          >
            Abbrechen
          </Button>
          <Button type="submit" disabled={!parsed.ok || !check?.canSave}>
            {replacesSameDay ? 'Ersetzen und speichern' : 'Speichern'}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}
