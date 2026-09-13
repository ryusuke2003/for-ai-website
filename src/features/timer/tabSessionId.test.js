import { beforeEach, describe, expect, it, vi } from 'vitest';

const TAB_SESSION_KEY = 'one.activeSession.v1';

async function loadTimerStore() {
  vi.resetModules();
  return import('./timerStore.js');
}

describe('タブセッションID', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('16バイトのWeb Crypto乱数を固定長hexへ変換して保存する', async () => {
    vi.useFakeTimers();
    const getRandomValues = vi.spyOn(globalThis.crypto, 'getRandomValues').mockImplementation((bytes) => {
      bytes.fill(0xab);
      return bytes;
    });
    const random = vi.spyOn(Math, 'random');
    const { timerActions } = await loadTimerStore();

    expect(timerActions.toggle()).toBe(true);
    expect(getRandomValues).toHaveBeenCalled();
    const bytes = getRandomValues.mock.calls.at(-1)[0];
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes).toHaveLength(16);
    expect(localStorage.getItem(TAB_SESSION_KEY)).toBe('ab'.repeat(16));
    expect(random).not.toHaveBeenCalled();

    timerActions.reset();
    vi.useRealTimers();
  });

  it('Web Cryptoが使えない場合は弱い代替IDを作らず単一タブ動作へフォールバックする', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('crypto', {});
    const { timerActions } = await loadTimerStore();
    const { tabCoordination } = await import('./tabGuard.js');

    expect(timerActions.toggle()).toBe(true);
    expect(localStorage.getItem(TAB_SESSION_KEY)).toBeNull();
    expect(tabCoordination.isEnabled()).toBe(false);

    timerActions.reset();
    vi.useRealTimers();
  });

  it('Web Cryptoの乱数生成が失敗してもセッションIDを書き込まない', async () => {
    vi.useFakeTimers();
    vi.spyOn(globalThis.crypto, 'getRandomValues').mockImplementation(() => {
      throw new Error('crypto unavailable');
    });
    const { timerActions } = await loadTimerStore();
    const { tabCoordination } = await import('./tabGuard.js');

    expect(timerActions.toggle()).toBe(true);
    expect(localStorage.getItem(TAB_SESSION_KEY)).toBeNull();
    expect(tabCoordination.isEnabled()).toBe(false);

    timerActions.reset();
    vi.useRealTimers();
  });
});
