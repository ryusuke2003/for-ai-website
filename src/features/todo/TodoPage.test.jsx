import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { TodoPage } from './TodoPage.jsx';

const TODO_STORAGE_KEY = 'one.todos.v1';

describe('TodoPage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('Todoを追加し、完了と削除ができる', () => {
    render(<TodoPage />);

    const input = screen.getByRole('textbox', { name: 'やること' });
    fireEvent.change(input, { target: { value: 'テストを書く' } });
    fireEvent.click(screen.getByRole('button', { name: '追加' }));

    expect(screen.getByText('テストを書く')).not.toBeNull();
    expect(screen.getByText('残り 1件')).not.toBeNull();

    fireEvent.click(screen.getByRole('checkbox'));
    expect(screen.getByText('全部完了しています。')).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'テストを書くを削除' }));
    expect(screen.getByText('まだTodoはありません。')).not.toBeNull();
  });

  it('保存済みTodoを読み込む', () => {
    localStorage.setItem(TODO_STORAGE_KEY, JSON.stringify([
      { id: '1', text: '保存済みタスク', completed: false },
    ]));

    render(<TodoPage />);

    expect(screen.getByText('保存済みタスク')).not.toBeNull();
    expect(screen.getByText('残り 1件')).not.toBeNull();
  });
});
