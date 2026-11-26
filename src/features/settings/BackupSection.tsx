import { DatabaseBackup, FileDown, FileSpreadsheet, ShieldCheck, Upload } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  backupFileName,
  exportBackup,
  exportReadingsCsv,
  importBackup,
  markBackedUp,
  parseBackup,
} from '@/data/backup/backup';
import type { Backup } from '@/data/backup/schema';
import { useBackupStatus } from '@/data/hooks';
import { todayISO } from '@/domain/dates';
import { downloadFile } from '@/lib/download';
import { formatDate } from '@/lib/format';

type PersistState = 'unsupported' | 'persisted' | 'not-persisted' | 'unknown';

async function persistedState(): Promise<PersistState> {
  try {
    if (typeof navigator.storage.persisted !== 'function') return 'unsupported';
    return (await navigator.storage.persisted()) ? 'persisted' : 'not-persisted';
  } catch {
    return 'unsupported';
  }
}

async function requestPersist(): Promise<boolean> {
  try {
    return typeof navigator.storage.persist === 'function'
      ? await navigator.storage.persist()
      : false;
  } catch {
    return false;
  }
}

/** Spec Phase 4 – Sicherung, Wiederherstellung, CSV-Export, Speicher-Schutz, Safari-Hinweis. */
export function BackupSection() {
  const status = useBackupStatus();
  const [includePhotos, setIncludePhotos] = useState(true);
  const [pending, setPending] = useState<Backup | null>(null);
  const [persist, setPersist] = useState<PersistState>('unknown');
  const fileRef = useRef<HTMLInputElement>(null);
  const photosId = useId();

  useEffect(() => {
    let active = true;
    void persistedState().then((state) => {
      if (active) setPersist(state);
    });
    return () => {
      active = false;
    };
  }, []);

  const createBackup = async () => {
    const backup = await exportBackup({ includePhotos });
    downloadFile(JSON.stringify(backup), backupFileName(todayISO()), 'application/json');
    await markBackedUp();
    if (persist === 'not-persisted' && (await requestPersist())) setPersist('persisted');
    toast.success('Sicherung erstellt', {
      description: 'Am besten in iCloud Drive, Google Drive oder auf einem anderen Gerät ablegen.',
    });
  };

  const restore = async (mode: 'merge' | 'replace') => {
    if (!pending) return;
    const summary = await importBackup(pending, mode);
    setPending(null);
    toast.success(mode === 'replace' ? 'Daten wiederhergestellt' : 'Sicherung zusammengeführt', {
      description: `${String(summary.added)} neu, ${String(summary.updated)} aktualisiert, ${String(summary.photos)} Fotos.`,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>Sicherung</h2>
        </CardTitle>
        <CardDescription>
          Alle Daten liegen nur auf diesem Gerät. Sichere sie regelmäßig als Datei – damit lässt
          sich alles auf einem anderen Gerät wiederherstellen.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-sm">
          {status?.lastBackupAt
            ? `Letzte Sicherung: ${formatDate(status.lastBackupAt.slice(0, 10))}`
            : 'Noch keine Sicherung erstellt.'}
        </p>
        <label htmlFor={photosId} className="flex items-center gap-3 text-sm">
          <input
            id={photosId}
            type="checkbox"
            className="size-5 accent-primary"
            checked={includePhotos}
            onChange={(e) => {
              setIncludePhotos(e.target.checked);
            }}
          />
          Fotos einschließen (Datei wird größer)
        </label>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => void createBackup()}>
            <DatabaseBackup aria-hidden="true" />
            Sicherung erstellen
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              fileRef.current?.click();
            }}
          >
            <Upload aria-hidden="true" />
            Sicherung wiederherstellen
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="sr-only"
            aria-label="Sicherungsdatei wählen"
            tabIndex={-1}
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (!file) return;
              void file.text().then((text) => {
                const parsed = parseBackup(text);
                if (parsed.ok) setPending(parsed.backup);
                else toast.error(parsed.error);
              });
            }}
          />
          <Button
            variant="outline"
            onClick={() => {
              void exportReadingsCsv().then((csv) => {
                // BOM, damit Excel Umlaute richtig anzeigt
                downloadFile(`\uFEFF${csv}`, `ablesungen-${todayISO()}.csv`, 'text/csv;charset=utf-8');
              });
            }}
          >
            <FileSpreadsheet aria-hidden="true" />
            Ablesungen als CSV
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-3 rounded-xl border px-3 py-2 text-sm">
          <ShieldCheck aria-hidden="true" className="size-4 text-muted-foreground" />
          <span className="flex-1">
            {persist === 'persisted'
              ? 'Speicher geschützt – der Browser löscht die Daten nicht von selbst.'
              : persist === 'unsupported'
                ? 'Dieser Browser kann den Speicher nicht dauerhaft schützen.'
                : 'Speicher nicht dauerhaft geschützt.'}
          </span>
          {persist === 'not-persisted' ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                void requestPersist().then((ok) => {
                  setPersist(ok ? 'persisted' : 'not-persisted');
                  if (!ok)
                    toast.info(
                      'Der Browser hat den Schutz (noch) nicht erteilt – regelmäßig sichern.',
                    );
                });
              }}
            >
              Speicher schützen
            </Button>
          ) : null}
        </div>
        <p className="text-xs text-muted-foreground">
          Hinweis für iPhone/iPad: Safari kann Website-Daten nach längerer Nichtnutzung löschen.
          Lege die App auf den Home-Bildschirm und sichere regelmäßig.
        </p>
      </CardContent>

      <Dialog
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open) setPending(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sicherung wiederherstellen?</DialogTitle>
            <DialogDescription>
              {pending
                ? `Sicherung vom ${formatDate(pending.exportedAt.slice(0, 10))}: ${String(pending.data.meters.length)} Zähler, ${String(pending.data.readings.length)} Ablesungen, ${String(pending.data.contracts.length)} Verträge, ${String(pending.data.offers.length)} Angebote, ${String(pending.data.photos?.length ?? 0)} Fotos.`
                : ''}
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            <strong className="text-foreground">Zusammenführen</strong> behält deine Daten und
            übernimmt Neues; bei Doppeltem gewinnt die neuere Änderung.{' '}
            <strong className="text-foreground">Alles ersetzen</strong> löscht die Daten auf diesem
            Gerät und stellt die Sicherung samt Einstellungen her.
          </p>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                setPending(null);
              }}
            >
              Abbrechen
            </Button>
            <Button variant="outline" onClick={() => void restore('merge')}>
              Zusammenführen
            </Button>
            <Button variant="destructive" onClick={() => void restore('replace')}>
              <FileDown aria-hidden="true" />
              Alles ersetzen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
