import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { TodoPage } from './TodoPage.jsx';

const TEMPLATE_STORAGE_KEY = 'one.todoTemplates.v1';

describe('Todo template panel', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('テンプレートが多数ある状態でも新しいテンプレートを追加して保存できる', () => {
    const existing = Array.from({ length: 8 }, (_, index) => ({
      id: `template-${index}`,
      text: `既存テンプレート${index + 1}`,
      duration: 25,
    }));
    localStorage.setItem(TEMPLATE_STORAGE_KEY, JSON.stringify(existing));

    render(<TodoPage />);

    const input = screen.getByRole('textbox', { name: 'テンプレート名' });
    const saveButton = screen.getByRole('button', { name: 'テンプレートを保存' });

    expect(saveButton.disabled).toBe(true);

    fireEvent.change(input, { target: { value: '新しいテンプレート' } });
    expect(saveButton.disabled).toBe(false);

    fireEvent.click(saveButton);

    expect(screen.getByText('新しいテンプレート')).not.toBeNull();
    expect(input.value).toBe('');

    const stored = JSON.parse(localStorage.getItem(TEMPLATE_STORAGE_KEY));
    expect(stored).toHaveLength(existing.length + 1);
    expect(stored.at(-1)).toMatchObject({
      text: '新しいテンプレート',
      duration: 25,
    });
  });
});
