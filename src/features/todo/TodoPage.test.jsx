import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TodoPage } from './TodoPage.jsx';

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

describe('TodoPage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
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

  it('テンプレートを空のタイムラインへドロップすると選択中の開始時刻でTodoを作成する', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 14, 9, 0, 0));
    render(<TodoPage />);

    fireEvent.change(screen.getByRole('textbox', { name: 'テンプレート名' }), {
      target: { value: '暗記問題' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'テンプレートを保存' }));

    const draggableTemplate = screen.getByText('暗記問題').closest('[draggable="true"]');
    const timeline = screen.getByTestId('todo-timeline');
    const transfer = dataTransfer({ rejectCustomType: true });

    fireEvent.dragStart(draggableTemplate, { dataTransfer: transfer });
    dropAt(timeline, transfer, 60);

    expect(screen.getByRole('article', { name: '09:00 暗記問題' })).not.toBeNull();
  });

  it('最初の予定から最後の予定までだけ時間軸を表示する', () => {
    localStorage.setItem(TODO_STORAGE_KEY, JSON.stringify([
      { id: 'first', text: '勉強1', completed: false, startMinute: 19 * 60 + 10, duration: 25 },
      { id: 'second', text: '勉強2', completed: false, startMinute: 19 * 60 + 35, duration: 25 },
      { id: 'last', text: '勉強3', completed: false, startMinute: 20 * 60 + 30, duration: 25 },
    ]));

    render(<TodoPage />);

    const timeline = screen.getByTestId('todo-timeline');
    expect(timeline.dataset.rangeStart).toBe(String(19 * 60 + 10));
    expect(timeline.dataset.rangeEnd).toBe(String(20 * 60 + 55));
    expect(screen.getByText('19:10')).not.toBeNull();
    expect(screen.getByText('20:55')).not.toBeNull();
    expect(screen.queryByText('16:00')).toBeNull();
    expect(screen.queryByText('24:00')).toBeNull();
  });

  it('短いTodoでも開始時刻と終了時刻を横に表示する', () => {
    localStorage.setItem(TODO_STORAGE_KEY, JSON.stringify([
      { id: 'time-range', text: '勉強', completed: false, startMinute: 18 * 60 + 30, duration: 25 },
    ]));

    render(<TodoPage />);

    expect(screen.getByText('勉強')).not.toBeNull();
    expect(screen.getByText('18:30–18:55')).not.toBeNull();
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
