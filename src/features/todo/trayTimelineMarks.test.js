import { describe, expect, it } from 'vitest';
import { buildTrayTimelineMarks } from './trayTimelineMarks.js';

describe('buildTrayTimelineMarks', () => {
  it('最初と最後の時刻に加えて、その間を30分刻みで返す', () => {
    expect(buildTrayTimelineMarks(90, 175)).toEqual([90, 120, 150, 175]);
  });

  it('開始時刻が30分境界でなくても次の30分境界から刻む', () => {
    expect(buildTrayTimelineMarks(95, 155)).toEqual([95, 120, 150, 155]);
  });

  it('30分未満の範囲では最初と最後だけ返す', () => {
    expect(buildTrayTimelineMarks(90, 110)).toEqual([90, 110]);
  });
});
