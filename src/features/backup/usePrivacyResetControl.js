import { useCallback, useMemo, useState } from 'react';

export function usePrivacyResetControl() {
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [busy] = useState(false);
  const [status, setStatus] = useState('');

  const openReset = useCallback(() => {
    setConfirmVisible(true);
    setStatus('削除すると元に戻せません。必要なら先にJSONバックアップを書き出してください。');
  }, []);

  const cancelReset = useCallback(() => {
    setConfirmVisible(false);
    setStatus('データ削除をキャンセルしました。');
  }, []);

  return useMemo(() => ({
    resetButtonHidden: confirmVisible,
    resetConfirmHidden: !confirmVisible,
    resetConfirmDisabled: busy,
    resetCancelDisabled: busy,
    resetStatus: status,
    openReset,
    cancelReset,
  }), [busy, cancelReset, confirmVisible, openReset, status]);
}
