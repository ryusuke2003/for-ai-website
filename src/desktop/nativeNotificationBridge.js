import { invoke, isTauri } from '@tauri-apps/api/core';

const COMPLETION_NOTIFICATION_STORAGE_KEY = 'one.completionNotification.v1';
let nativePermission = 'default';

function storedNotificationEnabled() {
  try {
    return localStorage.getItem(COMPLETION_NOTIFICATION_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

class TauriNotification {
  static get permission() {
    return nativePermission;
  }

  static async requestPermission() {
    try {
      const permission = await invoke('request_notification_permission');
      nativePermission = permission === 'granted' ? 'granted' : permission === 'denied' ? 'denied' : 'default';
      if (nativePermission === 'granted') {
        await invoke('show_native_notification', {
          title: 'タイマー',
          body: '完了通知をオンにしました。タイマー完了時に通知します。',
        });
      }
      return nativePermission;
    } catch {
      nativePermission = 'denied';
      return nativePermission;
    }
  }

  constructor(title, options = {}) {
    this.title = title;
    this.options = options;
    this.close = () => {};
    this.addEventListener = () => {};

    void invoke('show_native_notification', {
      title,
      body: typeof options.body === 'string' ? options.body : '',
    }).catch(() => {});
  }
}

export function installNativeNotificationBridge() {
  if (!isTauri()) return false;

  nativePermission = storedNotificationEnabled() ? 'granted' : 'default';
  Object.defineProperty(window, 'Notification', {
    configurable: true,
    writable: true,
    value: TauriNotification,
  });
  if (globalThis !== window) {
    Object.defineProperty(globalThis, 'Notification', {
      configurable: true,
      writable: true,
      value: TauriNotification,
    });
  }
  globalThis.__ONE_NATIVE_NOTIFICATION__ = true;
  return true;
}

installNativeNotificationBridge();
