import { beforeEach, describe, expect, it, vi } from 'vitest';

const TAB_STORAGE_PROBE_KEY = 'one.tabStorageProbe.v1';
const TIMER_STORAGE_KEY = 'one.timer.v1';

async function loadTimerStore() {
  vi.resetModules();
  return import('./timerStore.js');
}

describe('実行時の保存障害フォールバック', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('保存障害イベントを受けると複数タブ調停を無効化する', async () => {
    await loadTimerStore();
    const { tabCoordination } = await import('./tabGuard.js');

    expect(tabCoordination.isEnabled()).toBe(true);
    window.dispatchEvent(new Event('one:storage-error'));
    expect(tabCoordination.isEnabled()).toBe(false);
  });

  it('タブ間保存プローブの読み戻し不一致では調停を有効化しない', async () => {
    const originalGetItem = Storage.prototype.getItem;
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function getItem(key) {
      if (key === TAB_STORAGE_PROBE_KEY) return null;
      return originalGetItem.call(this, key);
    });

    await loadTimerStore();
    const { tabCoordination } = await import('./tabGuard.js');
    expect(tabCoordination.isEnabled()).toBe(false);
  });

  it('タイマー保存例外を全体の保存障害へ通知する', async () => {
    const { timerActions } = await loadTimerStore();
    const storageError = vi.fn();
    window.addEventListener('one:storage-error', storageError, { once: true });
    const originalSetItem = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function setItem(key, value) {
      if (key === TIMER_STORAGE_KEY) throw new DOMException('quota exceeded', 'QuotaExceededError');
      return originalSetItem.call(this, key, value);
    });

    expect(timerActions.selectMinutes(50)).toBe(true);
    expect(storageError).toHaveBeenCalledTimes(1);
  });

  it('進捗の再読込で保存障害が起きても現在の表示値を0へ巻き戻さない', async () => {
    vi.resetModules();
    localStorage.setItem('one.doneCount', '8');
    localStorage.setItem('one.history.v1', JSON.stringify({ '2026-09-13': 2 }));
    const progressStore = await import('../progress/progressStore.js');
    const originalGetItem = Storage.prototype.getItem;
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function getItem(key) {
      if (key === 'one.doneCount') throw new DOMException('storage blocked', 'SecurityError');
      return originalGetItem.call(this, key);
    });

    window.dispatchEvent(new Event('pageshow'));
    expect(progressStore.getProgressSnapshot()).toEqual({
      doneCount: '8',
      history: { '2026-09-13': 2 },
    });
  });
});
