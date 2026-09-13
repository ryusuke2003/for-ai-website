const NAV_BUTTON_CLASS = 'mb-6 rounded-full border border-[var(--one-border)] bg-[var(--one-card)] px-4 py-2 text-[0.8rem] font-extrabold text-[var(--one-fg)] shadow-[var(--one-card-shadow)] backdrop-blur-[14px] transition-[background,border-color] hover:border-[var(--one-border-strong)] hover:bg-[var(--one-active-bg)] max-[560px]:mb-5';

export function AppNavigation({ page, onNavigate }) {
  const todoActive = page === 'todo';
  const targetPage = todoActive ? 'timer' : 'todo';
  const label = todoActive ? '← タイマー' : 'Todo →';
  const ariaLabel = todoActive ? 'タイマー画面へ移動' : 'Todoリスト画面へ移動';

  return (
    <button
      className={NAV_BUTTON_CLASS}
      type="button"
      aria-label={ariaLabel}
      onClick={() => onNavigate(targetPage)}
    >
      {label}
    </button>
  );
}
