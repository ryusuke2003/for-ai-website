import { describe, expect, it } from 'vitest';
import { hasTodoOverlap, placeTodoWithoutOverlap } from './todoSchedule.js';

function todo(id, startMinute, duration = 30) {
  return { id, text: id, completed: false, startMinute, duration };
}

describe('placeTodoWithoutOverlap', () => {
  it('下方向へ移動したタスクを優先し、衝突したタスクを後ろへ押す', () => {
    const todos = [todo('a', 18 * 60, 30), todo('b', 18 * 60 + 30, 30)];
    const result = placeTodoWithoutOverlap(todos, todos[0], 18 * 60 + 30, 'forward');

    expect(result.find((item) => item.id === 'a').startMinute).toBe(18 * 60 + 30);
    expect(result.find((item) => item.id === 'b').startMinute).toBe(19 * 60);
    expect(hasTodoOverlap(result)).toBe(false);
  });

  it('後ろのタスクへ衝突が連鎖しても順番に押し出す', () => {
    const todos = [
      todo('a', 18 * 60, 30),
      todo('b', 18 * 60 + 30, 30),
      todo('c', 19 * 60, 30),
    ];
    const result = placeTodoWithoutOverlap(todos, todos[0], 18 * 60 + 30, 'forward');

    expect(result.find((item) => item.id === 'a').startMinute).toBe(18 * 60 + 30);
    expect(result.find((item) => item.id === 'b').startMinute).toBe(19 * 60);
    expect(result.find((item) => item.id === 'c').startMinute).toBe(19 * 60 + 30);
    expect(hasTodoOverlap(result)).toBe(false);
  });

  it('上方向へ移動した場合は衝突したタスクを前へ押す', () => {
    const todos = [
      todo('a', 18 * 60, 30),
      todo('b', 18 * 60 + 30, 30),
      todo('c', 19 * 60, 30),
    ];
    const result = placeTodoWithoutOverlap(todos, todos[2], 18 * 60 + 30, 'backward');

    expect(result.find((item) => item.id === 'c').startMinute).toBe(18 * 60 + 30);
    expect(result.find((item) => item.id === 'b').startMinute).toBe(18 * 60);
    expect(result.find((item) => item.id === 'a').startMinute).toBe(17 * 60 + 30);
    expect(hasTodoOverlap(result)).toBe(false);
  });

  it('新規タスクは配置位置を優先し、既存タスクを後ろへ押す', () => {
    const todos = [todo('existing', 19 * 60, 30)];
    const inserted = todo('new', 19 * 60, 25);
    const result = placeTodoWithoutOverlap(todos, inserted, 19 * 60, 'forward');

    expect(result.find((item) => item.id === 'new').startMinute).toBe(19 * 60);
    expect(result.find((item) => item.id === 'existing').startMinute).toBe(19 * 60 + 25);
    expect(hasTodoOverlap(result)).toBe(false);
  });

  it('押し出し先が日付を越える場合は配置を拒否する', () => {
    const todos = [todo('late', 23 * 60 + 30, 30)];
    const inserted = todo('new', 23 * 60 + 30, 30);

    expect(placeTodoWithoutOverlap(todos, inserted, 23 * 60 + 30, 'forward')).toBeNull();
  });

  it('前へ押し出せず0時を越える場合も配置を拒否する', () => {
    const todos = [todo('early', 0, 30), todo('moving', 30, 30)];

    expect(placeTodoWithoutOverlap(todos, todos[1], 0, 'backward')).toBeNull();
  });
});
