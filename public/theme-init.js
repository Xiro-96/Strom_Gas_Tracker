// Setzt das Theme vor dem ersten Paint (kein Aufblitzen). Spiegelt src/app/theme/theme.ts –
// Schlüssel und Farben dort ändern heißt: hier ebenfalls ändern (Test: theme-init.test.ts).
(function () {
  var pref = 'dark';
  try {
    var stored = window.localStorage.getItem('sgt-theme');
    if (stored === 'light' || stored === 'dark' || stored === 'system') pref = stored;
  } catch (e) {
    // Storage gesperrt → Standard Dark
  }
  var dark =
    pref === 'system'
      ? typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-color-scheme: dark)').matches
      : pref === 'dark';
  var root = document.documentElement;
  root.classList.toggle('dark', dark);
  root.style.colorScheme = dark ? 'dark' : 'light';
  var meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', dark ? '#0b0f17' : '#f7f8fa');
})();
