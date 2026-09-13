import { useEffect, useRef } from 'react';
import { useBackupPanelState } from './useBackupPanelState.js';
import { usePrivacyResetControl } from './usePrivacyResetControl.js';

function bridge() {
  return globalThis.ONE_REACT_BACKUP_PANEL;
}

export function BackupPanel() {
  const state = useBackupPanelState();
  const reset = usePrivacyResetControl();
  const fileInputRef = useRef(null);
  const exportButtonRef = useRef(null);
  const undoButtonRef = useRef(null);
  const resetButtonRef = useRef(null);
  const resetConfirmButtonRef = useRef(null);
  const resetCancelButtonRef = useRef(null);

  useEffect(() => {
    function handleFocus(event) {
      const refs = {
        export: exportButtonRef,
        undo: undoButtonRef,
      };
      refs[event.detail?.control]?.current?.focus();
    }

    window.addEventListener('one:backup-panel-focus', handleFocus);
    return () => {
      window.removeEventListener('one:backup-panel-focus', handleFocus);
    };
  }, []);

  return (
    <>
      <div className="controls">
        <button
          className="secondary"
          id="backup-export-button"
          type="button"
          aria-describedby="backup-hint"
          ref={exportButtonRef}
          onClick={() => bridge()?.exportBackup?.()}
        >
          JSONを書き出す
        </button>
        <button
          className="secondary"
          id="backup-import-button"
          type="button"
          aria-describedby="backup-hint"
          disabled={state.importDisabled}
          onClick={() => fileInputRef.current?.click()}
        >
          JSONから復元
        </button>
        <button
          className="secondary"
          id="backup-undo-button"
          type="button"
          aria-describedby="backup-hint"
          hidden={state.undoHidden}
          disabled={state.undoDisabled}
          ref={undoButtonRef}
          onClick={() => bridge()?.undoRestore?.()}
        >
          直前の復元を取り消す
        </button>
      </div>
      <input
        id="backup-file-input"
        type="file"
        accept="application/json,.json"
        hidden
        disabled={state.importDisabled}
        ref={fileInputRef}
        onChange={(event) => {
          const [file] = event.target.files ?? [];
          event.target.value = '';
          if (file) bridge()?.importFile?.(file);
        }}
      />
      <p className="hint" id="backup-hint">
        累計・日次履歴・選択中のタイマー時間だけを端末上のJSONファイルへ保存します。実行中タイマー、タブ間セッションID、今日の目標、表示・通知などのUI設定は含めません。復元直前の記録は端末内に1世代だけ退避し、復元後の記録が変わっていない間だけ取り消せます。
      </p>
      <p className="hint" id="backup-status" role="status" aria-live="polite">
        {state.backupStatus}
      </p>

      <div className="history" aria-labelledby="data-reset-title">
        <div className="history-heading">
          <h3 id="data-reset-title">この端末のONEデータ</h3>
          <span>プライバシー</span>
        </div>
        <p className="hint" id="data-reset-hint">
          タイマー、集中記録、今日の目標、復元用データ、表示テーマ、完了音、完了通知、画面維持など、ONEがこのブラウザに保存したデータを削除できます。すでにダウンロードしたJSONバックアップは端末上の別ファイルなので削除されません。
        </p>
        <div className="controls">
          <button
            className="secondary"
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
          <p className="hint">この操作は取り消せません。必要な記録がある場合は先にJSONを書き出してください。</p>
          <div className="controls">
            <button
              className="primary"
              id="data-reset-confirm-button"
              type="button"
              aria-describedby="data-reset-hint data-reset-status"
              disabled={reset.resetConfirmDisabled}
              ref={resetConfirmButtonRef}
              onClick={reset.confirmReset}
            >
              本当にすべて削除
            </button>
            <button
              className="secondary"
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
        <p className="hint" id="data-reset-status" role="status" aria-live="polite">
          {reset.resetStatus}
        </p>
      </div>
    </>
  );
}
