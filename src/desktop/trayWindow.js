import { invoke, isTauri } from '@tauri-apps/api/core';

export async function openFullWindow(target) {
  const normalizedTarget = target === 'todo' ? 'todo' : 'timer';

  if (!isTauri()) {
    window.location.hash = normalizedTarget === 'todo' ? 'todo' : '';
    return false;
  }

  try {
    await invoke('open_full_window', { target: normalizedTarget });
    return true;
  } catch {
    return false;
  }
}
