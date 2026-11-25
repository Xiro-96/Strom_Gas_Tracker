/**
 * Startaktionen aus den Manifest-Shortcuts („Strom ablesen“, „Gas ablesen“).
 * Shortcuts zeigen auf `…/?ablesen=strom|gas`, weil Fragmente in Shortcut-URLs nicht überall
 * zuverlässig ankommen. Vor dem Start des Hash-Routers wird daraus die passende Hash-Route.
 */
const LAUNCH_ROUTES: Record<string, string> = {
  strom: '/erfassen/strom',
  gas: '/erfassen/gas',
};

export function parseLaunchAction(search: string): string | null {
  const target = new URLSearchParams(search).get('ablesen');
  if (!target) return null;
  return LAUNCH_ROUTES[target] ?? null;
}

export function applyLaunchAction(win: Window): void {
  const route = parseLaunchAction(win.location.search);
  if (!route) return;
  win.history.replaceState(null, '', `${win.location.pathname}#${route}`);
}
