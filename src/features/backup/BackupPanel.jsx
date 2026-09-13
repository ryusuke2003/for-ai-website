import { useRef } from 'react';
import { useBackupControl } from './useBackupControl.js';
import { usePrivacyResetControl } from './usePrivacyResetControl.js';

const ACTIONS_CLASS = 'flex flex-wrap justify-center gap-2.5';
const BUTTON_CLASS = 'min-h-12 rounded-full border border-[var(--one-control-border)] px-[22px] font-extrabold disabled:cursor-not-allowed disabled:opacity-45';
const SECONDARY_BUTTON_CLASS = `${BUTTON_CLASS} bg-transparent text-inherit`;
const PRIMARY_BUTTON_CLASS = `${BUTTON_CLASS} bg-[var(--one-primary-bg)] text-[var(--one-primary-fg)]`;
const HINT_CLASS = 'hint mt-3 text-[0.82rem] text-[var(--one-muted)]';

export function BackupPanel() {
  const backup = useBackupControl();
  const reset = usePrivacyResetControl();
  const fileInputRef = useRef(null);
  const exportButtonRef = useRef(null);
  const undoButtonRef = useRef(null);
  const resetButtonRef = useRef(null);
  const resetConfirmButtonRef = useRef(null);
  const resetCancelButtonRef = useRef(null);

  return (
    <>
      <div className={ACTIONS_CLASS}>
        <button className={SECONDARY_BUTTON_CLASS} id="backup-export-button" type="button" aria-describedby="backup-hint" ref={exportButtonRef} onClick={backup.exportBackup}>
          JSONを書き出す
        </button>
        <button className={SECONDARY_BUTTON_CLASS} id="backup-import-button" type="button" aria-describedby="backup-hint" disabled={backup.importDisabled} onClick={() => fileInputRef.current?.click()}>
          JSONから復元
        </button>
        <button
          className={SECONDARY_BUTTON_CLASS}
          id="backup-undo-button"
          type="button"
          aria-describedby="backup-hint"
          hidden={backup.undoHidden}
          disabled={backup.undoDisabled}
          ref={undoButtonRef}
          onClick={() => {
            if (backup.undoLastRestore()) queueMicrotask(() => exportButtonRef.current?.focus());
          }}
        >
          直前の復元を取り消す
        </button>
      </div>
      <input
        id="backup-file-input"
        type="file"
        accept="application/json,.json"
        hidden
        disabled={backup.importDisabled}
        ref={fileInputRef}
        onChange={async (event) => {
          const [file] = event.target.files ?? [];
          event.target.value = '';
          if (file && await backup.importBackup(file)) queueMicrotask(() => undoButtonRef.current?.focus());
        }}
      />
      <p className={HINT_CLASS} id="backup-hint">
        累計・日次履歴・選択中のタイマー時間だけを端末上のJSONファイルへ保存します。実行中タイマー、タブ間セッションID、今日の目標、表示・通知などのUI設定は含めません。復元直前の記録は端末内に1世代だけ退避し、復元後の記録が変わっていない間だけ取り消せます。
      </p>
      <p className={HINT_CLASS} id="backup-status" role="status" aria-live="polite">{backup.backupStatus}</p>

      <div className="mt-7 border-t border-[var(--one-border-soft)] pt-6" aria-labelledby="data-reset-title">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h3 className="m-0 text-[0.95rem]" id="data-reset-title">この端末のONEデータ</h3>
          <span className="text-[0.72rem] font-bold text-[var(--one-subtle)]">プライバシー</span>
        </div>
        <p className={HINT_CLASS} id="data-reset-hint">
          タイマー、集中記録、今日の目標、復元用データ、表示テーマ、完了音、完了通知、画面維持など、ONEがこのブラウザに保存したデータを削除できます。すでにダウンロードしたJSONバックアップは端末上の別ファイルなので削除されません。
        </p>
        <div className={`${ACTIONS_CLASS} mt-4`}>
          <button
            className={SECONDARY_BUTTON_CLASS}
            id="data-reset-button"
            type="button"
            aria-describedby="data-reset-hint data-reset-status"
            hidden={reset.resetButtonHidden}
            ref={resetButtonRef}
            onClick={() => {
              reset.openReset();
              queueMicrotask(() => resetConfirmButtonRef.current?.focus());
            }}
          >
            この端末のデータを削除
          </button>
        </div>
        <div id="data-reset-confirm" hidden={reset.resetConfirmHidden}>
          <p className={HINT_CLASS}>この操作は取り消せません。必要な記録がある場合は先にJSONを書き出してください。</p>
          <div className={`${ACTIONS_CLASS} mt-4`}>
            <button className={PRIMARY_BUTTON_CLASS} id="data-reset-confirm-button" type="button" aria-describedby="data-reset-hint data-reset-status" disabled={reset.resetConfirmDisabled} ref={resetConfirmButtonRef} onClick={reset.confirmReset}>
              本当にすべて削除
            </button>
            <button
              className={SECONDARY_BUTTON_CLASS}
              id="data-reset-cancel-button"
              type="button"
              disabled={reset.resetCancelDisabled}
              ref={resetCancelButtonRef}
              onClick={() => {
                reset.cancelReset();
                queueMicrotask(() => resetButtonRef.current?.focus());
              }}
            >
              キャンセル
            </button>
          </div>
        </div>
        <p className={HINT_CLASS} id="data-reset-status" role="status" aria-live="polite">{reset.resetStatus}</p>
      </div>
    </>
  );
}
