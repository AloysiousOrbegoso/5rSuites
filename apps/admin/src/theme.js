// Light/dark theme. Stored choice wins; otherwise follow the OS. index.html applies
// it before first paint so there is no flash.
const KEY = 'admin-theme';

export function currentTheme() {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

export function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  try { localStorage.setItem(KEY, theme); } catch { /* private mode */ }
}
