(function () {
  var preference = 'system';
  try {
    var stored = window.localStorage.getItem('vyrnn.theme');
    if (stored === 'light' || stored === 'dark' || stored === 'system') preference = stored;
  } catch (error) {
    preference = 'system';
  }
  var dark = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-color-scheme: dark)').matches;
  var root = document.documentElement;
  root.dataset.theme = preference === 'system' ? (dark ? 'dark' : 'light') : preference;
  root.dataset.themePreference = preference;
})();
