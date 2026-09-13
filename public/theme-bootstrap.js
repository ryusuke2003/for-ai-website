const THEME_STORAGE_KEY = 'one.theme.v1';
const VALID_THEMES = new Set(['system', 'light', 'dark']);

function readStoredTheme() {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return VALID_THEMES.has(stored) ? stored : 'system';
  } catch {
    return 'system';
  }
}

const initialTheme = readStoredTheme();
if (initialTheme === 'light' || initialTheme === 'dark') {
  document.documentElement.dataset.theme = initialTheme;
} else {
  document.documentElement.removeAttribute('data-theme');
}
