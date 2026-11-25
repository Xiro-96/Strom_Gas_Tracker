import { FileUp } from 'lucide-react';
import { useMemo, useState } from 'react';
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
import { Textarea } from '@/components/ui/textarea';
import { importReadings, type ImportSummary } from '@/data/repositories/importReadings';
import { parseReadingsCsv } from '@/domain/csv';
import { formatDate, formatNumber } from '@/lib/format';

const EXAMPLE = 'Datum;Energie;Stand\n03.11.2025;Strom;14321,6\n03.11.2025;Gas;21234,567';

export function ImportDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [text, setText] = useState('');
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const parsed = useMemo(() => (text.trim() ? parseReadingsCsv(text) : null), [text]);
  const counts = parsed
    ? {
        strom: parsed.rows.filter((r) => r.energyType === 'electricity').length,
        gas: parsed.rows.filter((r) => r.energyType === 'gas').length,
      }
    : null;

  const close = (next: boolean) => {
    if (!next) {
      setText('');
      setSummary(null);
    }
    onOpenChange(next);
  };

  const run = async () => {
    if (!parsed || parsed.rows.length === 0) return;
    setBusy(true);
    try {
      const result = await importReadings(parsed.rows);
      setSummary(result);
      toast.success(`${result.created} Ablesungen importiert`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ablesungen importieren</DialogTitle>
          <DialogDescription>
            CSV im Excel-Format (Semikolon, Dezimalkomma): Datum;Energie;Stand. Fehlende Zähler
            werden angelegt, vorhandene Stände nie überschrieben.
          </DialogDescription>
        </DialogHeader>

        {summary ? (
          <div className="flex flex-col gap-3 text-sm" role="status">
            <p className="font-medium">
              {summary.created} neu · {summary.skipped} schon vorhanden
              {summary.conflicts.length > 0 ? ` · ${summary.conflicts.length} Konflikte` : ''}
            </p>
            {summary.metersCreated.length > 0 ? (
              <p className="text-muted-foreground">
                Neu angelegt:{' '}
                {summary.metersCreated
                  .map((e) => (e === 'gas' ? 'Gaszähler' : 'Stromzähler'))
                  .join(', ')}
                . Zählernummer, MaLo-ID und Gasfaktoren kannst du unter „Mehr → Zähler“ ergänzen.
              </p>
            ) : null}
            {summary.conflicts.map((c) => (
              <p key={`${c.energyType}-${c.date}`} className="text-warning">
                {formatDate(c.date)}: vorhanden {formatNumber(c.existing, 0, 3)}, Datei{' '}
                {formatNumber(c.incoming, 0, 3)} – nicht übernommen.
              </p>
            ))}
            {summary.warnings.map((w) => (
              <p key={w} className="text-warning">
                {w}
              </p>
            ))}
            <DialogFooter>
              <Button
                onClick={() => {
                  close(false);
                }}
              >
                Fertig
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <>
            <Field label="Datei wählen">
              <Input
                type="file"
                accept=".csv,.txt,text/csv,text/plain"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void file.text().then(setText);
                }}
              />
            </Field>
            <Field label="… oder Text einfügen">
              <Textarea
                rows={6}
                value={text}
                placeholder={EXAMPLE}
                spellCheck={false}
                className="font-mono text-sm"
                onChange={(e) => {
                  setText(e.target.value);
                }}
              />
            </Field>
            {parsed && counts ? (
              <div className="flex flex-col gap-1 text-sm" aria-live="polite">
                <p>
                  Erkannt: <strong>{counts.strom}</strong> Strom- und <strong>{counts.gas}</strong>{' '}
                  Gasstände
                </p>
                {parsed.errors.slice(0, 5).map((e) => (
                  <p key={e.line} className="text-danger">
                    Zeile {e.line}: {e.message}
                  </p>
                ))}
                {parsed.errors.length > 5 ? (
                  <p className="text-danger">… und {parsed.errors.length - 5} weitere Fehler</p>
                ) : null}
              </div>
            ) : null}
            <DialogFooter>
              <Button
                variant="ghost"
                onClick={() => {
                  close(false);
                }}
              >
                Abbrechen
              </Button>
              <Button
                disabled={!parsed || parsed.rows.length === 0 || busy}
                onClick={() => void run()}
              >
                <FileUp aria-hidden="true" />
                Importieren
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
