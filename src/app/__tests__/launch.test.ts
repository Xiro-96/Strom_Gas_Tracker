import { applyLaunchAction, parseLaunchAction } from '@/app/launch';

describe('parseLaunchAction', () => {
  it('leitet die Manifest-Shortcuts auf die Erfassung', () => {
    expect(parseLaunchAction('?ablesen=strom')).toBe('/erfassen/strom');
    expect(parseLaunchAction('?ablesen=gas')).toBe('/erfassen/gas');
  });

  it('ignoriert unbekannte oder fehlende Aktionen', () => {
    expect(parseLaunchAction('?ablesen=wasser')).toBeNull();
    expect(parseLaunchAction('?foo=bar')).toBeNull();
    expect(parseLaunchAction('')).toBeNull();
  });
});

describe('applyLaunchAction', () => {
  it('ersetzt die URL durch die Hash-Route und entfernt den Query-String', () => {
    window.history.replaceState(null, '', '/Strom_Gas_Tracker/?ablesen=gas');
    applyLaunchAction(window);
    expect(window.location.pathname).toBe('/Strom_Gas_Tracker/');
    expect(window.location.search).toBe('');
    expect(window.location.hash).toBe('#/erfassen/gas');
  });

  it('lässt die URL ohne Aktion unverändert', () => {
    window.history.replaceState(null, '', '/Strom_Gas_Tracker/#/verlauf');
    applyLaunchAction(window);
    expect(window.location.hash).toBe('#/verlauf');
  });
});
