import { describe, expect, it } from 'vitest';
import { buildTrayTimelineMarks, shouldHideTrayTimelineMarkLabel } from './trayTimelineMarks.js';

describe('buildTrayTimelineMarks', () => {
  it('最初と最後の時刻に加えて、十分離れた30分刻みを返す', () => {
    expect(buildTrayTimelineMarks(90, 175)).toEqual([90, 120, 150, 175]);
  });

  it('最後の時刻に近い30分刻みは省き、最後の時刻を優先する', () => {
    expect(buildTrayTimelineMarks(95, 155)).toEqual([95, 120, 155]);
  });

  it('最初の時刻に近い30分刻みは省き、最初の時刻を優先する', () => {
    expect(buildTrayTimelineMarks(118, 190)).toEqual([118, 150, 190]);
  });

  it('08:10〜08:35のような短い範囲では30分刻みより端点を優先する', () => {
    expect(buildTrayTimelineMarks(8 * 60 + 10, 8 * 60 + 35)).toEqual([490, 515]);
  });

  it('30分未満の範囲では最初と最後だけ返す', () => {
    expect(buildTrayTimelineMarks(90, 110)).toEqual([90, 110]);
  });
});

describe('shouldHideTrayTimelineMarkLabel', () => {
  it('現在時刻ラベルと描画上で重なる30分目盛りを隠す', () => {
    expect(shouldHideTrayTimelineMarkLabel(150, 152, 4)).toBe(true);
    expect(shouldHideTrayTimelineMarkLabel(150, 154, 4)).toBe(true);
  });

  it('十分離れた30分目盛りは表示する', () => {
    expect(shouldHideTrayTimelineMarkLabel(150, 155, 4)).toBe(false);
    expect(shouldHideTrayTimelineMarkLabel(150, 144, 4)).toBe(false);
  });

  it('不正な縮尺では既存ラベルを消さない', () => {
    expect(shouldHideTrayTimelineMarkLabel(150, 152, 0)).toBe(false);
  });
});
