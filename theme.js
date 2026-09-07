const themeButtons = [...document.querySelectorAll('[data-theme-choice]')];
const themeStatus = document.querySelector('#theme-status');

function writeThemePreference(theme) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
    return localStorage.getItem(THEME_STORAGE_KEY) === theme;
  } catch {
    return false;
  }
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

themeButtons.forEach((button) => {
  button.addEventListener('click', () => {
    applyThemePreference(button.dataset.themeChoice);
  });
});

window.addEventListener('storage', (event) => {
  if (event.key !== THEME_STORAGE_KEY) return;
  applyThemePreference(readStoredTheme(), { persist: false });
});

applyThemePreference(initialTheme, { persist: false, announce: false });
