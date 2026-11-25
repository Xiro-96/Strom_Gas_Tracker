export function InstallGuide() {
  return (
    <div className="grid gap-4 text-sm sm:grid-cols-2">
      <div>
        <h3 className="font-medium">iPhone &amp; iPad (Safari)</h3>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-muted-foreground">
          <li>Diese Seite in Safari öffnen.</li>
          <li>Auf „Teilen“ tippen (Quadrat mit Pfeil).</li>
          <li>„Zum Home-Bildschirm“ wählen und bestätigen.</li>
        </ol>
      </div>
      <div>
        <h3 className="font-medium">Android (Chrome)</h3>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-muted-foreground">
          <li>Diese Seite in Chrome öffnen.</li>
          <li>Menü ⋮ öffnen.</li>
          <li>„App installieren“ bzw. „Zum Startbildschirm hinzufügen“ wählen.</li>
        </ol>
      </div>
      <p className="text-muted-foreground sm:col-span-2">
        Am Computer (Chrome, Edge) erscheint das Installieren-Symbol rechts in der Adressleiste.
        Installiert startet die App auch ohne Internet.
      </p>
    </div>
  );
}
