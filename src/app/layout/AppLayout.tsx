import { Outlet, useLocation } from 'react-router';
import { BottomNav } from '@/app/layout/BottomNav';
import { Sidebar } from '@/app/layout/Sidebar';
import { StartupHints } from '@/features/switch/StartupHints';

export function AppLayout() {
  const { pathname } = useLocation();
  return (
    <div className="min-h-dvh md:grid md:grid-cols-[16rem_minmax(0,1fr)] print:block">
      <a
        href="#inhalt"
        onClick={(event) => {
          // Hash-Router: ein echter Sprung auf #inhalt würde die Route wechseln.
          event.preventDefault();
          document.getElementById('inhalt')?.focus();
        }}
        className="sr-only z-50 rounded-lg bg-primary px-4 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Zum Inhalt springen
      </a>
      <Sidebar />
      <main
        id="inhalt"
        tabIndex={-1}
        className="mx-auto w-full max-w-3xl px-4 pt-[calc(env(safe-area-inset-top,0px)+1.5rem)] pb-[calc(env(safe-area-inset-bottom,0px)+7rem)] outline-none md:px-8 md:pt-10 md:pb-12"
      >
        {/* Sanfter Seitenwechsel per CSS; prefers-reduced-motion schaltet ihn global ab. */}
        <div
          key={pathname}
          className="flex animate-in flex-col gap-6 duration-200 ease-out fade-in-0 slide-in-from-bottom-1"
        >
          <Outlet />
        </div>
      </main>
      <BottomNav />
      <StartupHints />
    </div>
  );
}
