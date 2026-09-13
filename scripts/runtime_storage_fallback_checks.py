from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
SOURCE = (ROOT / "tab-guard.js").read_text(encoding="utf-8")
STORAGE_COMPONENT_SOURCE = (ROOT / "src" / "components" / "StorageHealthStatus.jsx").read_text(encoding="utf-8")
TIMER_STORE_SOURCE = (ROOT / "src" / "features" / "timer" / "timerStore.js").read_text(encoding="utf-8")
PROGRESS_STORE_SOURCE = (ROOT / "src" / "features" / "progress" / "progressStore.js").read_text(encoding="utf-8")


def function_body(name, next_name):
    start = SOURCE.find(f"function {name}")
    end = SOURCE.find(f"function {next_name}", start + 1)
    if start < 0 or end < 0:
        raise SystemExit(f"ERROR: {name} または {next_name} を確認できません")
    return SOURCE[start:end]


def section(source, start_marker, end_marker):
    start = source.find(start_marker)
    end = source.find(end_marker, start + 1)
    if start < 0 or end < 0:
        raise SystemExit(f"ERROR: {start_marker} または {end_marker} を確認できません")
    return source[start:end]


def require(condition, message):
    if not condition:
        raise SystemExit(f"ERROR: {message}")


def main():
    require("window.addEventListener('one:storage-error'" in SOURCE,
            "保存障害を検知して複数タブ調停を無効化してください")
    require("storageAccessFailed = true;" in SOURCE and "disableTabCoordination();" in SOURCE,
            "保存障害eventではローカル障害状態と複数タブ調停を更新してください")

    unavailable = function_body("storageCoordinationUnavailable", "detectTabStorage")
    require("storageAccessFailed" in unavailable, "複数タブ調停は保存障害状態を確認してください")
    require("disableTabCoordination();" in unavailable, "保存障害後は複数タブ調停を停止してください")

    detect = function_body("detectTabStorage", "readStoredSessionId")
    write_pos = detect.find("localStorage.setItem(TAB_STORAGE_PROBE_KEY, '1')")
    verify_write_pos = detect.find("const persisted = localStorage.getItem(TAB_STORAGE_PROBE_KEY) === '1'")
    reject_write_pos = detect.find("if (!persisted)", verify_write_pos)
    remove_pos = detect.find("localStorage.removeItem(TAB_STORAGE_PROBE_KEY)", reject_write_pos)
    verify_remove_pos = detect.find("localStorage.getItem(TAB_STORAGE_PROBE_KEY) !== null", remove_pos)
    success_pos = detect.find("return true;", verify_remove_pos)
    require(min(write_pos, verify_write_pos, reject_write_pos, remove_pos, verify_remove_pos, success_pos) >= 0,
            "タブ間保存プローブは書込・読戻し・不一致拒否・削除・削除確認まで行ってください")
    require(write_pos < verify_write_pos < reject_write_pos < remove_pos < verify_remove_pos < success_pos,
            "タブ間保存プローブは書込→読戻し→不一致拒否→削除→削除確認→成功の順にしてください")
    require(detect.count("reportStorageFailure();") >= 3,
            "タブ間保存プローブの失敗は全体の保存障害へ通知してください")

    health_probe = section(STORAGE_COMPONENT_SOURCE, "function probeLocalStorage()", "function removeLegacyTaskData()")
    write_pos = health_probe.find("localStorage.setItem(STORAGE_HEALTH_PROBE_KEY, token)")
    verify_write_pos = health_probe.find("const persisted = localStorage.getItem(STORAGE_HEALTH_PROBE_KEY) === token")
    reject_write_pos = health_probe.find("if (!persisted)", verify_write_pos)
    remove_pos = health_probe.find("localStorage.removeItem(STORAGE_HEALTH_PROBE_KEY)", reject_write_pos)
    verify_remove_pos = health_probe.find("localStorage.getItem(STORAGE_HEALTH_PROBE_KEY) === null", remove_pos)
    require(min(write_pos, verify_write_pos, reject_write_pos, remove_pos, verify_remove_pos) >= 0,
            "React端末保存プローブは書込・読戻し・不一致拒否・削除・削除確認まで行ってください")
    require(write_pos < verify_write_pos < reject_write_pos < remove_pos < verify_remove_pos,
            "React端末保存プローブは書込→読戻し→不一致拒否→削除→削除確認の順にしてください")

    legacy_cleanup = section(STORAGE_COMPONENT_SOURCE, "function removeLegacyTaskData()", "function reportStorageHealthFailure()")
    require("LEGACY_TASK_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));" in legacy_cleanup,
            "旧タスク保存値を既知キー単位で削除してください")
    require("LEGACY_TASK_STORAGE_KEYS.every((key) => localStorage.getItem(key) === null)" in legacy_cleanup,
            "旧タスク保存値の削除後は読み戻して確認してください")

    health_status = STORAGE_COMPONENT_SOURCE.split("export function StorageHealthStatus()", 1)[-1]
    require("window.addEventListener('one:storage-error', handleStorageError);" in health_status,
            "React端末保存表示は実行中の保存障害を購読してください")
    require("probeLocalStorage();" in health_status, "React初期化時に端末保存を確認してください")
    require("removeLegacyTaskData();" in health_status, "端末保存が利用可能なら旧タスク保存値を掃除してください")

    timer_persist = section(TIMER_STORE_SOURCE, "function persistTimerState(value)", "function initialTimerState()")
    require("localStorage.setItem" in timer_persist and "reportStorageFailure();" in timer_persist,
            "Reactタイマーストアの保存例外は全体の保存障害へ通知してください")

    progress_read = section(PROGRESS_STORE_SOURCE, "function refreshFromStorage()", "function incrementInMemory")
    require(progress_read.count("if (storageAccessFailed) return false;") >= 3,
            "React進捗ストアは保存値の各読み取り後に保存障害を確認してください")
    require("readDoneCount()" in progress_read and "readHistory()" in progress_read,
            "React進捗ストアは累計と履歴を安全に再読込してください")

    refresh = function_body("refreshGuardProgressFromStorage", "setCrossTabFeedback")
    require("progressRuntime.refreshFromStorage?.() === true" in refresh,
            "claim固有の進捗再読込はReact progress runtimeへ委譲してください")
    require("storageCoordinationUnavailable()" in refresh,
            "claim固有の進捗再読込でも保存障害を確認してください")

    claim = function_body("claimPendingCompletion", "verifyCompletionConsumedState")
    session_read = claim.find("const storedSessionId = readStoredSessionId();")
    post_read_check = claim.find("if (storageCoordinationUnavailable()) return true;", session_read)
    pending_check = claim.find("const storedRemaining = storedState?.remainingSeconds;")
    require(min(session_read, post_read_check, pending_check) >= 0,
            "完了記録時の保存障害フォールバックを確認できません")
    require(session_read < post_read_check < pending_check,
            "保存障害を確認してから別タブ完了判定を行ってください")

    another_tab = function_body("blockIfAnotherTabOwnsTimer", "blockIfLocalSessionIsStale")
    another_read = another_tab.find("const storedSessionId = readStoredSessionId();")
    another_check = another_tab.find("if (storageCoordinationUnavailable()) return false;", another_read)
    require(another_read >= 0 and another_check > another_read,
            "別タブ判定は保存読込後の障害を確認してください")

    stale = function_body("blockIfLocalSessionIsStale", "beforeStart")
    stale_read = stale.find("const storedSessionId = readStoredSessionId();")
    stale_check = stale.find("if (storageCoordinationUnavailable()) return false;", stale_read)
    require(stale_read >= 0 and stale_check > stale_read,
            "再開時の古いタブ判定は保存読込後の障害を確認してください")

    require("registerTimerRuntime" in SOURCE and "timerRuntime = runtime;" in SOURCE,
            "tab guardへReactタイマーruntimeを明示登録してください")
    require("registerProgressRuntime" in SOURCE and "progressRuntime = runtime;" in SOURCE,
            "tab guardへReact進捗runtimeを明示登録してください")

    print("Runtime storage fallback checks passed with React timer/progress stores and tab coordination fallbacks.")


if __name__ == "__main__":
    main()
