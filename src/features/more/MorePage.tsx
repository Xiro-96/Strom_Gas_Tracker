import { ChevronRight, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router';
import { SECONDARY_NAV_ITEMS } from '@/app/navigation';
import { PageHeader } from '@/components/common/PageHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { InstallGuide } from '@/features/settings/InstallGuide';
import { ThemeSetting } from '@/features/settings/ThemeSetting';

export function MorePage() {
  return (
    <>
      <PageHeader title="Mehr" description="Weitere Bereiche und Einstellungen" />

      <Card className="py-2">
        <nav aria-label="Weitere Bereiche">
          <ul className="divide-y">
            {SECONDARY_NAV_ITEMS.map(({ to, label, icon: Icon }) => (
              <li key={to}>
                <Link
                  to={to}
                  className="flex items-center gap-3 px-5 py-3.5 text-sm font-medium hover:bg-accent/50"
                >
                  <Icon aria-hidden="true" className="size-5 text-muted-foreground" />
                  <span className="flex-1">{label}</span>
                  <ChevronRight aria-hidden="true" className="size-4 text-muted-foreground" />
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            <h2>Darstellung</h2>
          </CardTitle>
          <CardDescription>Dunkel ist Standard. „System“ folgt deinem Gerät.</CardDescription>
        </CardHeader>
        <CardContent>
          <ThemeSetting />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            <h2>App installieren</h2>
          </CardTitle>
          <CardDescription>
            Auf den Home-Bildschirm legen – startet dann wie eine App.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <InstallGuide />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck aria-hidden="true" className="size-5 text-savings" />
            <h2>Datenschutz</h2>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            Alle Daten bleiben auf diesem Gerät. Es gibt kein Konto, keine Cloud, kein Tracking und
            keine Werbung.
          </p>
          <p>
            Einzige mögliche Verbindung nach außen: Wetterdaten von Open-Meteo – und auch nur, wenn
            du das später ausdrücklich einschaltest.
          </p>
        </CardContent>
      </Card>

      <p className="text-center text-xs text-muted-foreground">
        Strom &amp; Gas Tracker · Version {__APP_VERSION__}
      </p>
    </>
  );
}
