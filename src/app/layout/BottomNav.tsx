import { NavLink } from 'react-router';
import { NAV_ITEMS } from '@/app/navigation';
import { cn } from '@/lib/utils';

export function BottomNav() {
  return (
    <nav
      aria-label="Hauptnavigation"
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/85 pb-safe backdrop-blur-xl md:hidden"
    >
      <ul className="mx-auto grid h-16 max-w-md grid-cols-5 items-center px-2">
        {NAV_ITEMS.map(({ to, label, icon: Icon, primary, ariaLabel }) => (
          <li key={to} className="flex justify-center">
            {primary ? (
              <NavLink
                to={to}
                aria-label={ariaLabel ?? label}
                className="-mt-7 grid size-15 place-items-center rounded-full bg-linear-to-br from-amber-300 to-cyan-400 text-slate-950 shadow-lg ring-4 shadow-black/30 ring-background transition-transform active:scale-95"
              >
                <Icon aria-hidden="true" className="size-7" strokeWidth={2.5} />
              </NavLink>
            ) : (
              <NavLink
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  cn(
                    'flex min-w-16 flex-col items-center gap-1 rounded-xl px-2 py-1.5 text-[11px] font-medium transition-colors',
                    isActive ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon
                      aria-hidden="true"
                      className={cn('size-5.5', isActive && 'stroke-[2.4]')}
                    />
                    <span>{label}</span>
                  </>
                )}
              </NavLink>
            )}
          </li>
        ))}
      </ul>
    </nav>
  );
}
