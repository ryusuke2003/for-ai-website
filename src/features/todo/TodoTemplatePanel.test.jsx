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

  it('保存済みテンプレートの名前と所要時間をモーダルから編集できる', () => {
    localStorage.setItem(TEMPLATE_STORAGE_KEY, JSON.stringify([
      { id: 'study-template', text: '勉強', duration: 25 },
    ]));

    render(<TodoPage />);

    fireEvent.click(screen.getByRole('button', { name: '勉強テンプレートを編集' }));

    expect(screen.getByRole('dialog', { name: 'テンプレートを編集' })).not.toBeNull();

    const editInput = screen.getByRole('textbox', { name: 'テンプレート名を編集' });
    fireEvent.change(editInput, { target: { value: 'A-1過去問' } });

    const durationPicker = screen.getByRole('spinbutton', { name: '編集するテンプレートの所要時間' });
    fireEvent.wheel(durationPicker, { deltaY: 100 });
    expect(Number(durationPicker.getAttribute('aria-valuenow'))).toBe(30);

    fireEvent.click(screen.getByRole('button', { name: '変更を保存' }));

    expect(screen.queryByRole('dialog', { name: 'テンプレートを編集' })).toBeNull();
    expect(screen.getByText('A-1過去問')).not.toBeNull();
    const templateCard = screen.getByLabelText('A-1過去問テンプレートをドラッグ');
    const templateDetails = templateCard.querySelector('strong + span');
    expect(Array.from(templateDetails.children).map((line) => line.textContent)).toEqual([
      '30分',
      '時間割にドラッグ',
    ]);
    expect(Array.from(templateDetails.children).every((line) => line.classList.contains('block'))).toBe(true);

    expect(JSON.parse(localStorage.getItem(TEMPLATE_STORAGE_KEY))).toEqual([
      { id: 'study-template', text: 'A-1過去問', duration: 30 },
    ]);
  });
});
