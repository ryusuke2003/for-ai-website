import { describe, expect, it } from 'vitest';
import { buildTrayTimelineMarks } from './trayTimelineMarks.js';

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
