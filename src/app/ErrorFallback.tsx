import { TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function ErrorFallback({ error }: { error: Error }) {
  return (
    <div role="alert" className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 p-6">
      <div className="grid size-12 place-items-center rounded-2xl bg-danger/15 text-danger">
        <TriangleAlert aria-hidden="true" className="size-6" />
      </div>
      <h1 className="text-xl font-semibold">Etwas ist schiefgelaufen</h1>
      <p className="text-sm text-muted-foreground">
        Deine Daten sind davon nicht betroffen – sie liegen sicher auf diesem Gerät. Lade die App
        neu. Falls der Fehler bleibt, hilft die Meldung unten bei der Suche.
      </p>
      <code className="block overflow-x-auto rounded-xl bg-muted p-3 text-xs">{error.message}</code>
      <div className="flex gap-2">
        <Button
          onClick={() => {
            window.location.reload();
          }}
        >
          Neu laden
        </Button>
        <Button variant="outline" asChild>
          <a href={import.meta.env.BASE_URL}>Zur Übersicht</a>
        </Button>
      </div>
    </div>
  );
}
