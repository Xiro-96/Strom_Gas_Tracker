import { useState } from 'react';
import { toast } from 'sonner';
import { Field } from '@/components/common/Field';
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
import { replaceMeter } from '@/data/repositories/meters';
import { todayISO } from '@/domain/dates';
import { parseMeterInput } from '@/domain/parse';
import type { Meter, Reading } from '@/domain/types';
import { formatDate, formatMeterValue, UNIT_LABEL } from '@/lib/format';

interface MeterChangeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  meter: Meter;
  lastReading?: Reading;
}

/** Zählerwechsel durch den Netzbetreiber: Endstand alt, Startstand neu – die Auswertung läuft durch. */
export function MeterChangeDialog(props: MeterChangeDialogProps) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent>{props.open ? <MeterChangeForm {...props} /> : null}</DialogContent>
    </Dialog>
  );
}

function MeterChangeForm({ onOpenChange, meter, lastReading }: MeterChangeDialogProps) {
  const today = todayISO();
  const [date, setDate] = useState(today);
  const [oldValue, setOldValue] = useState('');
  const [newValue, setNewValue] = useState('0');
  const [meterNumber, setMeterNumber] = useState('');
  const oldParsed = parseMeterInput(oldValue, {
    decimals: meter.decimals,
    lastValue: lastReading?.value,
  });
  const newParsed = parseMeterInput(newValue, { decimals: meter.decimals });
  const oldTooLow =
    oldParsed.ok && lastReading !== undefined && oldParsed.value < lastReading.value;
  const dateInvalid = date > today || (lastReading !== undefined && date < lastReading.date);
  const canSave = oldParsed.ok && newParsed.ok && !oldTooLow && !dateInvalid;

  const save = async () => {
    if (!oldParsed.ok || !newParsed.ok || !canSave) return;
    await replaceMeter({
      oldMeterId: meter.id,
      date,
      oldFinalValue: oldParsed.value,
      newStartValue: newParsed.value,
      newMeter: {
        name: meter.name,
        decimals: meter.decimals,
        ...(meterNumber.trim() ? { meterNumber: meterNumber.trim() } : {}),
      },
    });
    toast.success('Zählerwechsel gespeichert');
    onOpenChange(false);
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Zählerwechsel</DialogTitle>
        <DialogDescription>
          Endstand des alten und Startstand des neuen Zählers – meist steht beides im Schreiben des
          Netzbetreibers.
        </DialogDescription>
      </DialogHeader>
      <form
        className="flex flex-col gap-4"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <Field
          label="Wechseldatum"
          error={
            dateInvalid
              ? 'Das Datum muss zwischen der letzten Ablesung und heute liegen.'
              : undefined
          }
        >
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
          label={`Endstand alter Zähler (${UNIT_LABEL[meter.unit]})`}
          hint={
            lastReading
              ? `Zuletzt ${formatMeterValue(lastReading.value, meter.decimals, meter.unit)} am ${formatDate(lastReading.date)}`
              : undefined
          }
          error={oldTooLow ? 'Der Endstand ist kleiner als die letzte Ablesung.' : undefined}
        >
          <Input
            inputMode="decimal"
            autoComplete="off"
            value={oldValue}
            onChange={(e) => {
              setOldValue(e.target.value);
            }}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={`Startstand neu (${UNIT_LABEL[meter.unit]})`}>
            <Input
              inputMode="decimal"
              autoComplete="off"
              value={newValue}
              onChange={(e) => {
                setNewValue(e.target.value);
              }}
            />
          </Field>
          <Field label="Neue Zählernummer">
            <Input
              autoComplete="off"
              value={meterNumber}
              onChange={(e) => {
                setMeterNumber(e.target.value);
              }}
            />
          </Field>
        </div>
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
          <Button type="submit" disabled={!canSave}>
            Wechsel speichern
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}
