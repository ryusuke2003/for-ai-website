import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

function createTimerState(overrides = {}) {
  return {
    running: false,
    completionReady: false,
    remainingSeconds: 60,
    selectedMinutes: 5,
    endAt: null,
    ...overrides,
  };
}

function installAudioContext() {
  const oscillators = [];

  class FakeAudioContext {
    constructor() {
      this.state = 'running';
      this.currentTime = 0;
      this.destination = {};
    }

    resume = vi.fn().mockResolvedValue(undefined);
    close = vi.fn().mockResolvedValue(undefined);
    createOscillator = vi.fn(() => {
      const oscillator = {
        type: 'sine',
        frequency: { setValueAtTime: vi.fn() },
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
      };
      oscillators.push(oscillator);
      return oscillator;
    });
    createGain = vi.fn(() => ({
      gain: {
        setValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
      connect: vi.fn(),
    }));
  }

  Object.defineProperty(window, 'AudioContext', {
    configurable: true,
    value: FakeAudioContext,
  });

  return { oscillators };
}

function installNotification({ permission = 'granted' } = {}) {
  const instances = [];
  class FakeNotification {
    static permission = permission;
    static requestPermission = vi.fn().mockResolvedValue(permission);

    constructor(title, options) {
      this.title = title;
      this.options = options;
      this.close = vi.fn();
      this.addEventListener = vi.fn();
      instances.push(this);
    }
  }

  Object.defineProperty(window, 'Notification', {
    configurable: true,
    value: FakeNotification,
  });
  if (globalThis !== window) {
    Object.defineProperty(globalThis, 'Notification', {
      configurable: true,
      value: FakeNotification,
    });
  }
  return { FakeNotification, instances };
}

describe('useCompletionEffectsControl', () => {
  beforeEach(() => {
    vi.resetModules();
    localStorage.clear();
    installAudioContext();
    installNotification();
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'visible',
    });
    Object.defineProperty(navigator, 'locks', {
      configurable: true,
      value: {
        request: vi.fn(async (_name, callback) => callback()),
      },
    });
  });

  it('完了音を明示的にONにして保存する', async () => {
    const { oscillators } = installAudioContext();
    vi.resetModules();
    installNotification();
    Object.defineProperty(navigator, 'locks', {
      configurable: true,
      value: { request: vi.fn(async (_name, callback) => callback()) },
    });

    const { useCompletionEffectsControl } = await import('./useCompletionEffectsControl.js');
    const { result } = renderHook(() => useCompletionEffectsControl(createTimerState()));

    await act(async () => result.current.sound.toggle());

    expect(result.current.sound.pressed).toBe(true);
    expect(localStorage.getItem('one.completionSound.v1')).toBe('1');
    expect(result.current.sound.status).toContain('完了音');
    expect(oscillators).toHaveLength(6);
  });

  it('完了通知のON操作で権限を要求し、許可時だけ保存する', async () => {
    const { FakeNotification } = installNotification({ permission: 'default' });
    vi.resetModules();
    installAudioContext();
    Object.defineProperty(navigator, 'locks', {
      configurable: true,
      value: { request: vi.fn(async (_name, callback) => callback()) },
    });

    const { useCompletionEffectsControl } = await import('./useCompletionEffectsControl.js');
    const { result } = renderHook(() => useCompletionEffectsControl(createTimerState()));

    await act(async () => result.current.notification.toggle());

    expect(FakeNotification.requestPermission).toHaveBeenCalledOnce();
    expect(localStorage.getItem('one.completionNotification.v1')).toBe('0');
  });

  it('別タブの保存変更を反映し、不正値は無視する', async () => {
    const { useCompletionEffectsControl } = await import('./useCompletionEffectsControl.js');
    const { result } = renderHook(() => useCompletionEffectsControl(createTimerState()));

    act(() => {
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'one.completionSound.v1',
        newValue: '1',
        storageArea: localStorage,
      }));
    });
    expect(result.current.sound.pressed).toBe(true);

    act(() => {
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'one.completionSound.v1',
        newValue: 'invalid',
        storageArea: localStorage,
      }));
    });
    expect(result.current.sound.pressed).toBe(true);
  });

  it('実際に走っていたタイマーが0秒完了したときだけ完了副作用をclaimする', async () => {
    localStorage.setItem('one.completionSound.v1', '1');
    const locksRequest = vi.fn(async (_name, callback) => callback());
    Object.defineProperty(navigator, 'locks', {
      configurable: true,
      value: { request: locksRequest },
    });

    const { useCompletionEffectsControl } = await import('./useCompletionEffectsControl.js');
    const running = createTimerState({
      running: true,
      remainingSeconds: 1,
      endAt: Date.now() + 1000,
    });
    const { rerender } = renderHook(({ state }) => useCompletionEffectsControl(state), {
      initialProps: { state: running },
    });

    rerender({
      state: createTimerState({
        running: false,
        completionReady: true,
        remainingSeconds: 0,
        endAt: null,
      }),
    });

    await waitFor(() => expect(locksRequest).toHaveBeenCalled());
    expect(localStorage.getItem('one.completionEffectClaim.v1')).not.toBeNull();
  });

  it('通知ONならタイマー画面が前面でも完了通知を出す', async () => {
    localStorage.setItem('one.completionNotification.v1', '1');
    const { instances } = installNotification({ permission: 'granted' });
    vi.resetModules();
    installAudioContext();
    Object.defineProperty(navigator, 'locks', {
      configurable: true,
      value: { request: vi.fn(async (_name, callback) => callback()) },
    });

    const { useCompletionEffectsControl } = await import('./useCompletionEffectsControl.js');
    const endAt = Date.now() + 1000;
    const running = createTimerState({
      running: true,
      remainingSeconds: 1,
      endAt,
    });
    const { rerender } = renderHook(({ state }) => useCompletionEffectsControl(state), {
      initialProps: { state: running },
    });

    rerender({
      state: createTimerState({
        running: false,
        completionReady: true,
        remainingSeconds: 0,
        endAt: null,
      }),
    });

    await waitFor(() => expect(instances).toHaveLength(1));
    expect(instances[0].title).toBe('集中スプリント完了');
  });
});
