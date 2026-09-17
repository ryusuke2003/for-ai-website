function formatMinute(value) {
  const safe = Math.min(1440, Math.max(0, Math.trunc(value)));
  if (safe === 1440) return '24:00';
  return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`;
}

export function formatTrayTodoSchedule(todos) {
  if (!Array.isArray(todos) || todos.length === 0) return '';

  return todos
    .filter((todo) => todo && typeof todo.text === 'string')
    .map((todo) => ({
      ...todo,
      startMinute: Number(todo.startMinute),
      duration: Number(todo.duration),
    }))
    .filter((todo) => (
      Number.isFinite(todo.startMinute)
      && todo.startMinute >= 0
      && todo.startMinute < 1440
      && Number.isFinite(todo.duration)
      && todo.duration > 0
    ))
    .sort((left, right) => left.startMinute - right.startMinute || String(left.id ?? '').localeCompare(String(right.id ?? '')))
    .map((todo) => {
      const start = Math.trunc(todo.startMinute);
      const end = Math.min(1440, start + Math.trunc(todo.duration));
      return `${formatMinute(start)}-${formatMinute(end)} ${todo.text.trim()}`.trimEnd();
    })
    .join('\n');
}

function copyWithLegacyCommand(text, documentRef) {
  if (!documentRef?.body || typeof documentRef.execCommand !== 'function') return false;

  const textarea = documentRef.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.setAttribute('aria-hidden', 'true');
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  textarea.style.top = '0';
  documentRef.body.appendChild(textarea);

  try {
    textarea.select();
    return documentRef.execCommand('copy') === true;
  } catch {
    return false;
  } finally {
    textarea.remove();
  }
}

export async function copyTextToClipboard(
  text,
  {
    clipboard = globalThis.navigator?.clipboard,
    documentRef = globalThis.document,
  } = {},
) {
  if (typeof text !== 'string' || text.length === 0) return false;

  if (clipboard && typeof clipboard.writeText === 'function') {
    try {
      await clipboard.writeText(text);
      return true;
    } catch {
      // WebViewや権限制約でClipboard APIが使えない場合は旧方式へフォールバックする。
    }
  }

  return copyWithLegacyCommand(text, documentRef);
}
