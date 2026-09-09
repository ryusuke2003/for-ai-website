from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
SOURCE = (ROOT / "tab-guard.js").read_text(encoding="utf-8")
STORAGE_STATUS_SOURCE = (ROOT / "storage-status.js").read_text(encoding="utf-8")


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
    require(
        "window.addEventListener('one:storage-error', disableTabCoordination);" in SOURCE,
        "保存障害を検知したら複数タブ調停を無効化してください",
    )

    unavailable = function_body("storageCoordinationUnavailable", "detectTabStorage")
    require("storageAccessFailed" in unavailable, "複数タブ調停は共通の保存障害状態を確認してください")
    require("disableTabCoordination();" in unavailable, "保存障害後は複数タブ調停を停止してください")

    detect = function_body("detectTabStorage", "readStoredSessionId")
    write_pos = detect.find("localStorage.setItem(TAB_STORAGE_PROBE_KEY, '1')")
    verify_write_pos = detect.find("const persisted = localStorage.getItem(TAB_STORAGE_PROBE_KEY) === '1'")
    reject_write_pos = detect.find("if (!persisted)", verify_write_pos)
    remove_pos = detect.find("localStorage.removeItem(TAB_STORAGE_PROBE_KEY)", reject_write_pos)
    verify_remove_pos = detect.find("localStorage.getItem(TAB_STORAGE_PROBE_KEY) !== null", remove_pos)
    success_pos = detect.find("return true;", verify_remove_pos)
    require(
        min(write_pos, verify_write_pos, reject_write_pos, remove_pos, verify_remove_pos, success_pos) >= 0,
        "タブ間保存プローブは書込・読戻し・不一致拒否・削除・削除確認まで行ってください",
    )
    require(
        write_pos < verify_write_pos < reject_write_pos < remove_pos < verify_remove_pos < success_pos,
        "タブ間保存プローブは書込→読戻し→不一致拒否→削除→削除確認→成功の順にしてください",
    )
    require(
        detect.count("reportStorageFailure();") >= 3,
        "タブ間保存プローブの書込不一致・削除不一致・API例外は全体の保存障害へ通知してください",
    )

    health_probe = section(STORAGE_STATUS_SOURCE, "function probeLocalStorage()", "function updateTaskCharacterCount()")
    write_pos = health_probe.find("localStorage.setItem(STORAGE_HEALTH_PROBE_KEY, token)")
    verify_write_pos = health_probe.find("const persisted = localStorage.getItem(STORAGE_HEALTH_PROBE_KEY) === token")
    reject_write_pos = health_probe.find("if (!persisted)", verify_write_pos)
    remove_pos = health_probe.find("localStorage.removeItem(STORAGE_HEALTH_PROBE_KEY)", reject_write_pos)
    verify_remove_pos = health_probe.find("localStorage.getItem(STORAGE_HEALTH_PROBE_KEY) !== null", remove_pos)
    require(
        min(write_pos, verify_write_pos, reject_write_pos, remove_pos, verify_remove_pos) >= 0,
        "端末保存プローブは書込・読戻し・不一致拒否・削除・削除確認まで行ってください",
    )
    require(
        write_pos < verify_write_pos < reject_write_pos < remove_pos < verify_remove_pos,
        "端末保存プローブは書込→読戻し→不一致拒否→削除→削除確認の順にしてください",
    )
    require(
        health_probe.count("reportStorageFailure();") >= 3,
        "端末保存プローブの書込不一致・削除不一致・API例外は全体の保存障害へ通知してください",
    )

    refresh = function_body("refreshGuardProgressFromStorage", "stopCrossTabAction")
    count_read = refresh.find("const storedDoneCount = readDoneCount();")
    history_read = refresh.find("const storedHistory = readHistory();")
    failure_check = refresh.find("if (storageCoordinationUnavailable()) return false;", count_read)
    dom_write = refresh.find("doneCount.textContent = String(storedDoneCount);")
    require(min(count_read, history_read, failure_check, dom_write) >= 0, "claim固有の進捗再読込で安全な処理順を確認できません")
    require(count_read < history_read < failure_check < dom_write, "保存値は全部読み切ってから障害確認後にDOMへ反映してください")

    claim = function_body("claimPendingCompletion", "blockIfAnotherTabOwnsTimer")
    session_read = claim.find("const storedSessionId = readStoredSessionId();")
    post_read_check = claim.find("if (storageCoordinationUnavailable()) return true;", session_read)
    pending_check = claim.find("const storedRemaining = storedState?.remainingSeconds;")
    require(min(session_read, post_read_check, pending_check) >= 0, "完了記録時の保存障害フォールバックを確認できません")
    require(session_read < post_read_check < pending_check, "保存障害を確認してから別タブ完了判定を行ってください")

    another_tab = function_body("blockIfAnotherTabOwnsTimer", "blockIfLocalSessionIsStale")
    another_read = another_tab.find("const storedSessionId = readStoredSessionId();")
    another_check = another_tab.find("if (storageCoordinationUnavailable()) return false;", another_read)
    require(another_read >= 0 and another_check > another_read, "別タブ判定は保存読込後の障害を確認してください")

    stale = function_body("blockIfLocalSessionIsStale", "initializeTabGuard")
    stale_read = stale.find("const storedSessionId = readStoredSessionId();")
    stale_check = stale.find("if (storageCoordinationUnavailable()) return false;", stale_read)
    require(stale_read >= 0 and stale_check > stale_read, "再開時の古いタブ判定は保存読込後の障害を確認してください")

    print("Runtime storage fallback checks passed with verified storage probe cleanup and tab coordination fallbacks.")


if __name__ == "__main__":
    main()
