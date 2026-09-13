import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const originalNotification = window.Notification;

function restoreNotification() {
  Object.defineProperty(window, 'Notification', {
    configurable: true,
    writable: true,
    value: originalNotification,
  });
  if (globalThis !== window) {
    Object.defineProperty(globalThis, 'Notification', {
      configurable: true,
      writable: true,
      value: originalNotification,
    });
  }
  delete globalThis.__ONE_NATIVE_NOTIFICATION__;
}

describe('nativeNotificationBridge', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    localStorage.clear();
    restoreNotification();
  });

  afterEach(() => {
    vi.doUnmock('@tauri-apps/api/core');
    restoreNotification();
  });

  it('Web版ではNotificationを置き換えない', async () => {
    vi.doMock('@tauri-apps/api/core', () => ({
      isTauri: () => false,
      invoke: vi.fn(),
    }));

    await import('./nativeNotificationBridge.js');

    expect(window.Notification).toBe(originalNotification);
    expect(globalThis.__ONE_NATIVE_NOTIFICATION__).toBeUndefined();
  });

  it('Tauri版では権限要求と通知送信をRust側へ委譲する', async () => {
    const invoke = vi.fn(async (command) => {
      if (command === 'request_notification_permission') return 'granted';
      return undefined;
    });
    vi.doMock('@tauri-apps/api/core', () => ({
      isTauri: () => true,
      invoke,
    }));

    await import('./nativeNotificationBridge.js');

    expect(globalThis.__ONE_NATIVE_NOTIFICATION__).toBe(true);
    expect(Notification.permission).toBe('default');
    await expect(Notification.requestPermission()).resolves.toBe('granted');
    expect(invoke).toHaveBeenCalledWith('request_notification_permission');
    expect(invoke).toHaveBeenCalledWith('show_native_notification', {
      title: 'タイマー',
      body: '完了通知をオンにしました。タイマー完了時に通知します。',
    });

    new Notification('集中スプリント完了', {
      body: 'ONEで完了した集中を記録してください。',
    });
    expect(invoke).toHaveBeenCalledWith('show_native_notification', {
      title: '集中スプリント完了',
      body: 'ONEで完了した集中を記録してください。',
    });
  });

  it('保存済みONなら再起動後もネイティブ通知をONとして復元する', async () => {
    localStorage.setItem('one.completionNotification.v1', '1');
    vi.doMock('@tauri-apps/api/core', () => ({
      isTauri: () => true,
      invoke: vi.fn(),
    }));

    await import('./nativeNotificationBridge.js');

    expect(Notification.permission).toBe('granted');
  });
});
