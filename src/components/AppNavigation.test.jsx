import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AppNavigation } from './AppNavigation.jsx';

describe('AppNavigation', () => {
  it('タイマー画面ではTodoへの遷移ボタンを表示する', () => {
    const onNavigate = vi.fn();
    render(<AppNavigation page="timer" onNavigate={onNavigate} />);

    fireEvent.click(screen.getByRole('button', { name: 'Todoリスト画面へ移動' }));

    expect(onNavigate).toHaveBeenCalledWith('todo');
  });

  it('Todo画面ではタイマーへ戻るボタンを表示する', () => {
    const onNavigate = vi.fn();
    render(<AppNavigation page="todo" onNavigate={onNavigate} />);

    fireEvent.click(screen.getByRole('button', { name: 'タイマー画面へ移動' }));

    expect(onNavigate).toHaveBeenCalledWith('timer');
  });
});
