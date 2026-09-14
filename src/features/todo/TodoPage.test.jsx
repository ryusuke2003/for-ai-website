import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TodoPage } from './TodoPage.jsx';
import { startTodoLiveDragPreview } from './todoLiveDragPreview.js';

const TODO_STORAGE_KEY = 'one.todos.v2';
const LEGACY_TODO_STORAGE_KEY = 'one.todos.v1';

function dataTransfer({ rejectCustomType = false } = {}) {
  const values = new Map();
  return {
    effectAllowed: 'none',
    dropEffect: 'none',
    setData(type, value) {
      if (rejectCustomType && type !== 'text/plain') {
        throw new Error('custom drag types are not available');
      }
      values.set(type, value);
    },
    getData(type) {
      return values.get(type) ?? '';
    },
  };
}

function dropAt(element, transfer, clientY) {
  const event = new MouseEvent('drop', {
    bubbles: true,
    cancelable: true,
    clientY,
  });
  Object.defineProperty(event, 'dataTransfer', { value: transfer });
  fireEvent(element, event);
}

function dragOverAt(element, transfer, clientY) {
  const event = new MouseEvent('dragover', {
    bubbles: true,
    cancelable: true,
    clientY,
  });
  Object.defineProperty(event, 'dataTransfer', { value: transfer });
  fireEvent(element, event);
}

describe('TodoPage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('現在時刻線のラベルを分境界ごとに更新する', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 14, 11, 59, 30));

    render(<TodoPage />);
    expect(screen.getByTestId('todo-current-time-line').textContent).toContain('現在 11:59');

    act(() => {
      vi.advanceTimersByTime(30_000);
    });

    expect(screen.getByTestId('todo-current-time-line').textContent).toContain('現在 12:00');
  });

  it('初期表示では過去の完了済み予定を飛ばして次の未完了予定へ移動する', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 14, 12, 0));
    localStorage.setItem(TODO_STORAGE_KEY, JSON.stringify([
      { id: 'completed', text: '完了済み', completed: true, startMinute: 10 * 60 + 30, duration: 25 },
      { id: 'next', text: '次の予定', completed: false, startMinute: 13 * 60, duration: 25 },
    ]));

    render(<TodoPage />);

    const viewport = screen.getByTestId('todo-timeline').parentElement;
    expect(viewport.scrollTop).toBe(((13 * 60 - 60) / 60) * 300);
  });

  it('次の未完了予定がなければ現在時刻へ移動する', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 14, 12, 0));
    localStorage.setItem(TODO_STORAGE_KEY, JSON.stringify([
      { id: 'completed', text: '完了済み', completed: true, startMinute: 10 * 60 + 30, duration: 25 },
    ]));

    render(<TodoPage />);

    const viewport = screen.getByTestId('todo-timeline').parentElement;
    expect(viewport.scrollTop).toBe(((12 * 60 - 60) / 60) * 300);
  });

  it('時刻と所要時間を指定してTodoを追加し、完了と削除ができる', () => {
    render(<TodoPage />);

    const input = screen.getByRole('textbox', { name: 'やること' });
    fireEvent.change(input, { target: { value: 'テストを書く' } });
    fireEvent.click(screen.getByRole('button', { name: /に追加$/ }));

    expect(screen.getByText('テストを書く')).not.toBeNull();
    expect(screen.getByText(/残り 1件/)).not.toBeNull();

    fireEvent.click(screen.getByRole('checkbox', { name: 'テストを書くを完了' }));
    expect(screen.getByText('今日の予定は全部完了しています。')).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'テストを書くを削除' }));
    expect(screen.getByText('時間を決めて追加するか、タスクを予定表へドラッグできます。')).not.toBeNull();
  });

  it('編集モーダルでタスク名・開始時刻・所要時間を変更して保存できる', () => {
    localStorage.setItem(TODO_STORAGE_KEY, JSON.stringify([
      { id: 'edit-me', text: 'A-1過去問', completed: false, startMinute: 11 * 60 + 5, duration: 25 },
    ]));

    render(<TodoPage />);
    fireEvent.click(screen.getByRole('button', { name: 'A-1過去問を編集' }));

    const dialog = screen.getByRole('dialog', { name: '予定を編集' });
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'タスク名' }), {
      target: { value: 'A-1復習' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: '開始・分を進める' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'かかる時間を進める' }));
    fireEvent.click(within(dialog).getByRole('button', { name: '変更を保存' }));

    expect(screen.queryByRole('dialog', { name: '予定を編集' })).toBeNull();
    expect(screen.getByRole('article', { name: '11:10 A-1復習' })).not.toBeNull();
    expect(screen.getByText('11:10–11:40')).not.toBeNull();
    expect(JSON.parse(localStorage.getItem(TODO_STORAGE_KEY))[0]).toMatchObject({
      id: 'edit-me',
      text: 'A-1復習',
      startMinute: 11 * 60 + 10,
      duration: 30,
    });
  });

  it('編集で時間が重なる場合は後続Todoを押し出して重複を防ぐ', () => {
    localStorage.setItem(TODO_STORAGE_KEY, JSON.stringify([
      { id: 'first', text: '前半', completed: false, startMinute: 10 * 60, duration: 25 },
      { id: 'second', text: '後半', completed: false, startMinute: 10 * 60 + 30, duration: 25 },
    ]));

    render(<TodoPage />);
    fireEvent.click(screen.getByRole('button', { name: '前半を編集' }));

    const dialog = screen.getByRole('dialog', { name: '予定を編集' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'かかる時間を進める' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'かかる時間を進める' }));
    fireEvent.click(within(dialog).getByRole('button', { name: '変更を保存' }));

    expect(screen.getByText('10:00–10:35')).not.toBeNull();
    expect(screen.getByRole('article', { name: '10:35 後半' })).not.toBeNull();
    expect(screen.getByText('10:35–11:00')).not.toBeNull();
  });

  it('時間ピッカーをホイール操作で変更できる', () => {
    render(<TodoPage />);

    const hourPicker = screen.getByRole('spinbutton', { name: '開始・時' });
    const before = Number(hourPicker.getAttribute('aria-valuenow'));
    fireEvent.wheel(hourPicker, { deltaY: 100 });

    expect(Number(hourPicker.getAttribute('aria-valuenow'))).toBe((before + 1) % 24);
  });

  it('テンプレートを保存し、使うボタンでタスク入力欄へ反映できる', () => {
    render(<TodoPage />);

    fireEvent.change(screen.getByRole('textbox', { name: 'テンプレート名' }), {
      target: { value: 'セキスペ復習' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'テンプレートを保存' }));

    expect(screen.getByText('セキスペ復習').closest('button')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'セキスペ復習を入力欄で使う' }));

    expect(screen.getByRole('textbox', { name: 'やること' }).value).toBe('セキスペ復習');
  });

  it('テンプレートをタイムラインへドロップしてTodoを作成できる', () => {
    startTodoLiveDragPreview();
    render(<TodoPage />);

    fireEvent.change(screen.getByRole('textbox', { name: 'テンプレート名' }), {
      target: { value: '暗記問題' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'テンプレートを保存' }));

    const draggableTemplate = screen.getByText('暗記問題').closest('[draggable="true"]');
    const timeline = screen.getByTestId('todo-timeline');
    const transfer = dataTransfer({ rejectCustomType: true });

    timeline.getBoundingClientRect = () => ({
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: 700,
      bottom: 7200,
      width: 700,
      height: 7200,
      toJSON() {},
    });

    fireEvent.dragStart(draggableTemplate, { dataTransfer: transfer });
    dragOverAt(timeline, transfer, 9 * 300);
    expect(screen.getByRole('status').textContent).toBe('ここで離すと 09:00–09:25');
    dragOverAt(timeline, transfer, 9 * 300 + 28 * 5);
    expect(screen.getByRole('status').textContent).toBe('ここで離すと 09:30–09:55');
    dropAt(timeline, transfer, 9 * 300 + 28 * 5);

    expect(screen.getByRole('article', { name: '09:30 暗記問題' })).not.toBeNull();
  });

  it('短いTodoでも開始時刻と終了時刻を横に表示する', () => {
    localStorage.setItem(TODO_STORAGE_KEY, JSON.stringify([
      { id: 'time-range', text: '勉強', completed: false, startMinute: 18 * 60 + 30, duration: 25 },
    ]));

    render(<TodoPage />);

    expect(screen.getByText('勉強')).not.toBeNull();
    expect(screen.getByText('18:30–18:55')).not.toBeNull();
  });

  it('5分Todoを連続配置してもカード同士が重ならない高さにする', () => {
    localStorage.setItem(TODO_STORAGE_KEY, JSON.stringify([
      { id: 'first-five', text: '5分その1', completed: false, startMinute: 20 * 60, duration: 5 },
      { id: 'second-five', text: '5分その2', completed: false, startMinute: 20 * 60 + 5, duration: 5 },
    ]));

    render(<TodoPage />);

    const first = screen.getByRole('article', { name: '20:00 5分その1' });
    const second = screen.getByRole('article', { name: '20:05 5分その2' });
    const firstTop = Number.parseFloat(first.style.top);
    const firstHeight = Number.parseFloat(first.style.height);
    const secondTop = Number.parseFloat(second.style.top);

    expect(firstHeight).toBeLessThanOrEqual(secondTop - firstTop);
  });

  it('旧Todoデータを予定表形式へ移行して読み込む', () => {
    localStorage.setItem(LEGACY_TODO_STORAGE_KEY, JSON.stringify([
      { id: '1', text: '保存済みタスク', completed: false },
    ]));

    render(<TodoPage />);

    expect(screen.getByText('保存済みタスク')).not.toBeNull();
    expect(screen.getByRole('article', { name: '09:00 保存済みタスク' })).not.toBeNull();
    expect(screen.getByText('09:00–09:25')).not.toBeNull();
    expect(JSON.parse(localStorage.getItem(TODO_STORAGE_KEY))[0]).toMatchObject({
      text: '保存済みタスク',
      startMinute: 540,
      duration: 25,
    });
  });
});
