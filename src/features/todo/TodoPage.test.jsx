import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { TodoPage } from './TodoPage.jsx';

const TODO_STORAGE_KEY = 'one.todos.v2';
const LEGACY_TODO_STORAGE_KEY = 'one.todos.v1';

function dataTransfer() {
  const values = new Map();
  return {
    effectAllowed: 'none',
    dropEffect: 'none',
    setData(type, value) {
      values.set(type, value);
    },
    getData(type) {
      return values.get(type) ?? '';
    },
  };
}

describe('TodoPage', () => {
  beforeEach(() => {
    localStorage.clear();
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

  it('テンプレートを保存し、クリックでタスク入力欄へ反映できる', () => {
    render(<TodoPage />);

    fireEvent.change(screen.getByRole('textbox', { name: 'テンプレート名' }), {
      target: { value: 'セキスペ復習' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'テンプレートを保存' }));

    const templateButton = screen.getByRole('button', { name: /セキスペ復習/ });
    fireEvent.click(templateButton);

    expect(screen.getByRole('textbox', { name: 'やること' }).value).toBe('セキスペ復習');
  });

  it('テンプレートをタイムラインへドロップしてTodoを作成できる', () => {
    render(<TodoPage />);

    fireEvent.change(screen.getByRole('textbox', { name: 'テンプレート名' }), {
      target: { value: '暗記問題' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'テンプレートを保存' }));

    const templateButton = screen.getByRole('button', { name: /暗記問題/ });
    const draggableTemplate = templateButton.closest('[draggable="true"]');
    const timeline = screen.getByTestId('todo-timeline');
    const transfer = dataTransfer();

    timeline.getBoundingClientRect = () => ({
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: 700,
      bottom: 1728,
      width: 700,
      height: 1728,
      toJSON() {},
    });

    fireEvent.dragStart(draggableTemplate, { dataTransfer: transfer });
    fireEvent.drop(timeline, { dataTransfer: transfer, clientY: 9 * 72 });

    expect(screen.getByRole('article', { name: '09:00 暗記問題' })).not.toBeNull();
  });

  it('旧Todoデータを予定表形式へ移行して読み込む', () => {
    localStorage.setItem(LEGACY_TODO_STORAGE_KEY, JSON.stringify([
      { id: '1', text: '保存済みタスク', completed: false },
    ]));

    render(<TodoPage />);

    expect(screen.getByText('保存済みタスク')).not.toBeNull();
    expect(screen.getByRole('article', { name: '09:00 保存済みタスク' })).not.toBeNull();
    expect(JSON.parse(localStorage.getItem(TODO_STORAGE_KEY))[0]).toMatchObject({
      text: '保存済みタスク',
      startMinute: 540,
      duration: 25,
    });
  });
});
