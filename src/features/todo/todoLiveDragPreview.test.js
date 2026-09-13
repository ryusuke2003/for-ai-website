import { describe, expect, it } from 'vitest';
import { hasTodoOverlap } from './todoSchedule.js';
import { buildLivePreviewSchedule } from './todoLiveDragPreview.js';

function todo(id, startMinute, duration = 30) {
  return { id, startMinute, duration };
}

describe('buildLivePreviewSchedule', () => {
  it('下へドラッグ中は衝突する予定をリアルタイム配置用に後ろへ押す', () => {
    const todos = [todo('a', 18 * 60), todo('b', 18 * 60 + 30), todo('c', 19 * 60)];
    const preview = buildLivePreviewSchedule(
      todos,
      { kind: 'task', id: 'a', duration: 30, originalStartMinute: 18 * 60 },
      18 * 60 + 30,
    );

    expect(preview.find((item) => item.id === 'a').startMinute).toBe(18 * 60 + 30);
    expect(preview.find((item) => item.id === 'b').startMinute).toBe(19 * 60);
    expect(preview.find((item) => item.id === 'c').startMinute).toBe(19 * 60 + 30);
    expect(hasTodoOverlap(preview)).toBe(false);
  });

  it('上へドラッグ中は衝突する予定を前へ押す', () => {
    const todos = [todo('a', 18 * 60), todo('b', 18 * 60 + 30), todo('c', 19 * 60)];
    const preview = buildLivePreviewSchedule(
      todos,
      { kind: 'task', id: 'c', duration: 30, originalStartMinute: 19 * 60 },
      18 * 60 + 30,
    );

    expect(preview.find((item) => item.id === 'c').startMinute).toBe(18 * 60 + 30);
    expect(preview.find((item) => item.id === 'b').startMinute).toBe(18 * 60);
    expect(preview.find((item) => item.id === 'a').startMinute).toBe(17 * 60 + 30);
    expect(hasTodoOverlap(preview)).toBe(false);
  });

  it('新規タスクのドラッグ中も既存予定を後ろへ押すプレビューを作る', () => {
    const todos = [todo('existing', 19 * 60, 30)];
    const preview = buildLivePreviewSchedule(
      todos,
      { kind: 'new', id: '__todo-live-preview__', duration: 25 },
      19 * 60,
    );

    expect(preview.find((item) => item.id === 'existing').startMinute).toBe(19 * 60 + 25);
    expect(hasTodoOverlap(preview)).toBe(false);
  });
});
