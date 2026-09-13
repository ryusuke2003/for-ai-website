import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  canRestoreTodoSchedule,
  resetTodoSchedule,
  restoreTodoSchedule,
} from './resetTodoSchedule.js';
import { TodoPage } from './TodoPage.jsx';

const ACTION_CLASS = 'rounded-full border border-[var(--one-border)] bg-transparent px-3 py-1.5 text-[0.72rem] font-extrabold text-[var(--one-muted)] transition hover:border-[var(--one-border-strong)] hover:text-[var(--one-fg)]';

function TimelineHeaderActions({ version, restoreAvailable, onRestore, onReset }) {
  const [target, setTarget] = useState(null);

  useEffect(() => {
    const timelineTitle = document.getElementById('timeline-title');
    const header = timelineTitle?.parentElement?.parentElement;
    const date = header?.lastElementChild;

    if (!(header instanceof HTMLElement) || !(date instanceof HTMLElement)) {
      setTarget(null);
      return undefined;
    }

    date.style.order = '3';
    setTarget(header);

    return () => {
      date.style.order = '';
    };
  }, [version]);

  function scrollToCurrentTime() {
    const timeline = document.querySelector('[data-testid="todo-timeline"]');
    const viewport = timeline?.parentElement;
    if (!timeline || !viewport) return;

    const now = new Date();
    const currentMinute = now.getHours() * 60 + now.getMinutes();
    const timelineHeight = timeline.scrollHeight || timeline.getBoundingClientRect().height;
    if (!timelineHeight) return;

    const pixelsPerMinute = timelineHeight / (24 * 60);
    const top = Math.max(0, (currentMinute - 60) * pixelsPerMinute);

    if (typeof viewport.scrollTo === 'function') {
      viewport.scrollTo({ top, behavior: 'smooth' });
      return;
    }

    viewport.scrollTop = top;
  }

  if (!target) return null;

  return createPortal(
    <span className="order-2 ml-auto inline-flex flex-wrap items-center justify-end gap-2 align-middle">
      <button className={ACTION_CLASS} type="button" onClick={scrollToCurrentTime}>
        現在時刻へ
      </button>
      <button className={ACTION_CLASS} type="button" onClick={onReset}>
        今日の予定をリセット
      </button>
      {restoreAvailable ? (
        <button className={ACTION_CLASS} type="button" onClick={onRestore}>
          リセットを復元
        </button>
      ) : null}
    </span>,
    target,
  );
}

export function TodoPageWithActions() {
  const [version, setVersion] = useState(0);
  const [status, setStatus] = useState('');
  const [restoreAvailable, setRestoreAvailable] = useState(canRestoreTodoSchedule);

  function resetTodaySchedule() {
    if (!resetTodoSchedule()) {
      setStatus('予定をリセットできませんでした。');
      return;
    }

    setVersion((current) => current + 1);
    setRestoreAvailable(canRestoreTodoSchedule());
    setStatus('今日の予定をリセットしました。復元できます。');
  }

  function restoreTodaySchedule() {
    if (!restoreTodoSchedule()) {
      setStatus('予定を復元できませんでした。');
      return;
    }

    setVersion((current) => current + 1);
    setRestoreAvailable(false);
    setStatus('リセット前の予定を復元しました。');
  }

  return (
    <>
      <p className="sr-only" aria-live="polite">{status}</p>
      <TodoPage key={version} />
      <TimelineHeaderActions
        version={version}
        restoreAvailable={restoreAvailable}
        onRestore={restoreTodaySchedule}
        onReset={resetTodaySchedule}
      />
    </>
  );
}
