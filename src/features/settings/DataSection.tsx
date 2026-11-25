import { FileUp, FlaskConical } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useHasDemoData, useMeters } from '@/data/hooks';
import { loadDemoData, removeDemoData } from '@/data/repositories/demo';
import { ImportDialog } from '@/features/settings/ImportDialog';

export function DataSection() {
  const [importOpen, setImportOpen] = useState(false);
  const hasDemo = useHasDemoData();
  const meters = useMeters();
  const ownMeters = (meters ?? []).some((m) => !m.isDemo);
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>Daten</h2>
        </CardTitle>
        <CardDescription>
          Altdaten übernehmen oder die App mit erfundenen Daten ausprobieren.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          onClick={() => {
            setImportOpen(true);
          }}
        >
          <FileUp aria-hidden="true" />
          Ablesungen importieren
        </Button>
        {hasDemo ? (
          <Button
            variant="outline"
            onClick={() => {
              void removeDemoData().then(() => toast.success('Demo-Daten entfernt'));
            }}
          >
            <FlaskConical aria-hidden="true" />
            Demo-Daten entfernen
          </Button>
        ) : (
          <Button
            variant="outline"
            disabled={ownMeters}
            title={ownMeters ? 'Nur ohne eigene Zähler möglich' : undefined}
            onClick={() => {
              void loadDemoData()
                .then(() => toast.success('Demo-Daten geladen'))
                .catch((error: unknown) =>
                  toast.error(error instanceof Error ? error.message : String(error)),
                );
            }}
          >
            <FlaskConical aria-hidden="true" />
            Demo-Daten laden
          </Button>
        )}
      </CardContent>
      <ImportDialog open={importOpen} onOpenChange={setImportOpen} />
    </Card>
  );
}
