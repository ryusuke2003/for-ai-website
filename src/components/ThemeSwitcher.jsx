import { useEffect, useState } from 'react';

const THEME_STORAGE_KEY = 'one.theme.v1';
const VALID_THEMES = new Set(['system', 'light', 'dark']);
const THEME_OPTIONS = [
  { value: 'system', label: '自動' },
  { value: 'light', label: 'ライト' },
  { value: 'dark', label: 'ダーク' },
];

function reportThemeStorageFailure() {
  if (typeof globalThis.reportStorageFailure === 'function') {
    globalThis.reportStorageFailure();
    return;
  }
  window.dispatchEvent(new Event('one:storage-error'));
}

function themeFromDocument() {
  const current = document.documentElement.dataset.theme;
  return current === 'light' || current === 'dark' ? current : 'system';
}

function readStoredTheme() {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === null) return { ok: true, theme: 'system' };
    if (!VALID_THEMES.has(stored)) return { ok: false, theme: null };
    return { ok: true, theme: stored };
  } catch {
    reportThemeStorageFailure();
    return { ok: false, theme: null };
  }
}

function writeThemePreference(theme) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
    if (localStorage.getItem(THEME_STORAGE_KEY) === theme) return true;
  } catch {
    reportThemeStorageFailure();
    return false;
  }

  reportThemeStorageFailure();
  return false;
}

function applyThemeToDocument(theme) {
  if (theme === 'light' || theme === 'dark') {
    document.documentElement.dataset.theme = theme;
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
}

function currentThemeMessage(theme) {
  if (theme === 'light') return '表示テーマはライトです。';
  if (theme === 'dark') return '表示テーマはダークです。';
  return '表示テーマは自動です。';
}

function changedThemeMessage(theme) {
  if (theme === 'light') return '表示テーマをライトにしました。';
  if (theme === 'dark') return '表示テーマをダークにしました。';
  return '表示テーマを自動にしました。端末のライト・ダーク設定に合わせます。';
}

export function ThemeSwitcher() {
  const [theme, setTheme] = useState(themeFromDocument);
  const [status, setStatus] = useState(() => currentThemeMessage(themeFromDocument()));

  useEffect(() => {
    applyThemeToDocument(theme);
  }, [theme]);

  useEffect(() => {
    function refreshThemePreferenceFromStorage() {
      const stored = readStoredTheme();
      if (!stored.ok) return;
      applyThemeToDocument(stored.theme);
      setTheme(stored.theme);
    }

    function refreshThemeWhenVisible() {
      if (document.visibilityState === 'visible') refreshThemePreferenceFromStorage();
    }

    function handleStorage(event) {
      if (event.key !== THEME_STORAGE_KEY) return;
      if (event.newValue !== null && !VALID_THEMES.has(event.newValue)) return;

      const nextTheme = event.newValue ?? 'system';
      applyThemeToDocument(nextTheme);
      setTheme(nextTheme);
      setStatus(changedThemeMessage(nextTheme));
    }

    window.addEventListener('storage', handleStorage);
    document.addEventListener('visibilitychange', refreshThemeWhenVisible);
    window.addEventListener('pageshow', refreshThemePreferenceFromStorage);

    return () => {
      window.removeEventListener('storage', handleStorage);
      document.removeEventListener('visibilitychange', refreshThemeWhenVisible);
      window.removeEventListener('pageshow', refreshThemePreferenceFromStorage);
    };
  }, []);

  function chooseTheme(nextTheme) {
    if (!VALID_THEMES.has(nextTheme)) return;

    applyThemeToDocument(nextTheme);
    setTheme(nextTheme);
    const persisted = writeThemePreference(nextTheme);
    setStatus(
      persisted
        ? changedThemeMessage(nextTheme)
        : `${changedThemeMessage(nextTheme)} このブラウザには設定を保存できませんでした。`,
    );
  }

  return (
    <>
      <div
        className="theme-switcher mb-6 flex items-center justify-end gap-1.5 text-[0.76rem] font-extrabold max-[560px]:mb-5 max-[560px]:justify-start"
        role="group"
        aria-label="表示テーマ"
        aria-describedby="theme-status"
      >
        <span className="mr-0.5 tracking-[0.06em]" aria-hidden="true">表示</span>
        {THEME_OPTIONS.map((option) => (
          <button
            className="rounded-full border-0 bg-transparent px-2.5 py-1.5 font-extrabold text-inherit"
            key={option.value}
            type="button"
            data-theme-choice={option.value}
            aria-pressed={theme === option.value}
            onClick={() => chooseTheme(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
      <p id="theme-status" className="sr-only" role="status" aria-live="polite">
        {status}
      </p>
    </>
  );
}
