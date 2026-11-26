import { Plus } from 'lucide-react';
import { Link, NavLink } from 'react-router';
import { NAV_ITEMS, SECONDARY_NAV_ITEMS, type NavItem } from '@/app/navigation';
import { AppLogo } from '@/components/common/AppLogo';
import { buttonVariants } from '@/components/ui/button-variants';
import { cn } from '@/lib/utils';

function SidebarLink({ to, label, icon: Icon }: NavItem) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors',
          isActive
            ? 'bg-accent text-accent-foreground'
            : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground',
        )
      }
    >
      <Icon aria-hidden="true" className="size-4.5" />
      {label}
    </NavLink>
  );
}

export function Sidebar() {
  const main = NAV_ITEMS.filter((item) => !item.primary && item.to !== '/mehr');
  const more = NAV_ITEMS.find((item) => item.to === '/mehr');
  return (
    <aside className="sticky top-0 hidden h-dvh flex-col gap-6 border-r px-4 py-6 md:flex print:hidden">
      <Link to="/" className="flex items-center gap-3 px-2">
        <AppLogo className="size-9" />
        <span className="leading-tight">
          <span className="block text-sm font-semibold">Strom &amp; Gas</span>
          <span className="block text-xs text-muted-foreground">Tracker</span>
        </span>
      </Link>
      <Link to="/erfassen" className={cn(buttonVariants({ size: 'lg' }), 'w-full')}>
        <Plus aria-hidden="true" />
        Zählerstand erfassen
      </Link>
      <nav aria-label="Seitenleiste" className="flex flex-1 flex-col gap-6">
        <ul className="flex flex-col gap-1">
          {main.map((item) => (
            <li key={item.to}>
              <SidebarLink {...item} />
            </li>
          ))}
        </ul>
        <div>
          <p className="px-3 pb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Analyse &amp; Wechsel
          </p>
          <ul className="flex flex-col gap-1">
            {SECONDARY_NAV_ITEMS.map((item) => (
              <li key={item.to}>
                <SidebarLink {...item} />
              </li>
            ))}
          </ul>
        </div>
        {more ? (
          <ul className="mt-auto">
            <li>
              <SidebarLink {...more} />
            </li>
          </ul>
        ) : null}
      </nav>
    </aside>
  );
}
