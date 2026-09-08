const themeButtons = [...document.querySelectorAll('[data-theme-choice]')];
const themeStatus = document.querySelector('#theme-status');

function writeThemePreference(theme) {
  if (!safeWrite(THEME_STORAGE_KEY, theme)) return false;

  const stored = safeRead(THEME_STORAGE_KEY);
  if (storageAccessFailed) return false;
  if (stored === theme) return true;

  reportStorageFailure();
  return false;
}

function applyThemePreference(theme, { persist = true, announce = true } = {}) {
  const nextTheme = VALID_THEMES.has(theme) ? theme : 'system';

  if (nextTheme === 'light' || nextTheme === 'dark') {
    document.documentElement.dataset.theme = nextTheme;
  } else {
    document.documentElement.removeAttribute('data-theme');
  }

  themeButtons.forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.themeChoice === nextTheme));
  });

  let message = nextTheme === 'system'
    ? '表示テーマを自動にしました。端末のライト・ダーク設定に合わせます。'
    : nextTheme === 'light'
      ? '表示テーマをライトにしました。'
      : '表示テーマをダークにしました。';

  if (persist && !writeThemePreference(nextTheme)) {
    message += ' このブラウザには設定を保存できませんでした。';
  }
  if (announce) themeStatus.textContent = message;
}

function refreshThemePreferenceFromStorage() {
  if (storageAccessFailed) return false;

  const storedTheme = safeRead(THEME_STORAGE_KEY);
  if (storageAccessFailed) return false;

  const nextTheme = VALID_THEMES.has(storedTheme) ? storedTheme : 'system';
  applyThemePreference(nextTheme, { persist: false, announce: false });
  return true;
}

function refreshThemeWhenVisible() {
  if (document.visibilityState === 'visible') refreshThemePreferenceFromStorage();
}

themeButtons.forEach((button) => {
  button.addEventListener('click', () => {
    applyThemePreference(button.dataset.themeChoice);
  });
});

window.addEventListener('storage', (event) => {
  if (event.key !== THEME_STORAGE_KEY) return;
  const nextTheme = VALID_THEMES.has(event.newValue) ? event.newValue : 'system';
  applyThemePreference(nextTheme, { persist: false });
});

document.addEventListener('visibilitychange', refreshThemeWhenVisible);
window.addEventListener('pageshow', refreshThemePreferenceFromStorage);

applyThemePreference(initialTheme, { persist: false, announce: false });
