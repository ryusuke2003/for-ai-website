import { describe, expect, it, vi } from 'vitest';
import { copyTextToClipboard, formatTrayTodoSchedule } from './trayTodoCopy.js';

describe('formatTrayTodoSchedule', () => {
  it('開始時刻順に1件1行で時間割を整形する', () => {
    expect(formatTrayTodoSchedule([
      { id: 'c', text: '間違えた問題', startMinute: 165, duration: 25 },
      { id: 'a', text: '休憩', startMinute: 150, duration: 5 },
      { id: 'b', text: '単語', startMinute: 155, duration: 10 },
    ])).toBe([
      '02:30-02:35 休憩',
      '02:35-02:45 単語',
      '02:45-03:10 間違えた問題',
    ].join('\n'));
  });

  it('24時をまたがず24:00で終端する', () => {
    expect(formatTrayTodoSchedule([
      { id: 'late', text: '振り返り', startMinute: 1430, duration: 20 },
    ])).toBe('23:50-24:00 振り返り');
  });

  it('予定がなければ空文字を返す', () => {
    expect(formatTrayTodoSchedule([])).toBe('');
  });
});

describe('copyTextToClipboard', () => {
  it('Clipboard APIで改行を含む文字列をそのままコピーする', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const text = '02:30-02:35 休憩\n02:35-02:45 単語';

    await expect(copyTextToClipboard(text, {
      clipboard: { writeText },
      documentRef: null,
    })).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith(text);
  });

  it('空文字はコピーしない', async () => {
    const writeText = vi.fn();

    await expect(copyTextToClipboard('', {
      clipboard: { writeText },
      documentRef: null,
    })).resolves.toBe(false);
    expect(writeText).not.toHaveBeenCalled();
  });
});
