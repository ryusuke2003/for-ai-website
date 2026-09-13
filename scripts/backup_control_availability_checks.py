from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
SOURCE = (ROOT / "src" / "features" / "backup" / "useBackupControl.js").read_text(encoding="utf-8")
TAB_GUARD_SOURCE = (ROOT / "src" / "features" / "timer" / "tabGuard.js").read_text(encoding="utf-8")
TIMER_GUARD_SOURCE = (ROOT / "src" / "features" / "timer" / "timerStateGuard.js").read_text(encoding="utf-8")
MAIN_SOURCE = (ROOT / "src" / "main.jsx").read_text(encoding="utf-8")


def fail(message):
    raise SystemExit(f"ERROR: {message}")


def section(start_marker, end_marker):
    start = SOURCE.find(start_marker)
    end = SOURCE.find(end_marker, start + 1)
    if start < 0 or end < 0:
        fail(f"検査範囲を取得できません: {start_marker}")
    return SOURCE[start:end]


def require(condition, message):
    if not condition:
        fail(message)


def main():
    require(not (ROOT / "backup.js").exists(), "復元可否判定をclassic backup.jsへ戻さないでください")
    require("function hasActiveTimerContext(state)" in SOURCE, "現在タブのタイマー状態判定をReact stateから行ってください")
    require("import { tabCoordination } from '../timer/tabGuard.js';" in SOURCE,
            "backup hookはtabCoordinationをmoduleから直接importしてください")
    require("import { timerStateGuard } from '../timer/timerStateGuard.js';" in SOURCE,
            "backup hookはtimerStateGuardをmoduleから直接importしてください")
    require("import { progressActions } from '../progress/progressStore.js';" in SOURCE,
            "backup hookはprogressActionsをmoduleから直接importしてください")
    require("export const tabCoordination = Object.freeze" in TAB_GUARD_SOURCE,
            "module tab guardの調停状態を小さな公開APIで提供してください")
    require("export const timerStateGuard = Object.freeze" in TIMER_GUARD_SOURCE,
            "timerStateGuardをmodule APIとして維持してください")
    require("hasActiveStoredTimer()" in TAB_GUARD_SOURCE,
            "別タブのアクティブタイマー判定をmodule tab guard側に維持してください")

    for legacy_global in (
        "ONE_TIMER_STATE_GUARD",
        "ONE_TAB_COORDINATION",
        "ONE_REACT_PROGRESS_OVERVIEW",
    ):
        require(legacy_global not in SOURCE,
                f"backup hookから互換global {legacy_global} を再導入しないでください")
        require(legacy_global not in MAIN_SOURCE,
                f"React entryから互換global {legacy_global} を公開しないでください")

    can_restore = section("function canRestoreBackup()", "function refreshBackupControlAvailability")
    require("hasActiveTimerContext(timerStateRef.current)" in can_restore,
            "現在タブの進行中・一時停止中・完了待ち状態では復元を許可しないでください")
    require("tabCoordination.hasActiveStoredTimer()" in can_restore,
            "別タブのアクティブタイマー状態も復元可否へ含めてください")
    require("tabCoordinationAvailable()" in can_restore,
            "保存障害やタブ間調停不可時は復元を許可しないでください")

    controls = section("function refreshBackupControlAvailability", "function refreshRecoveryAvailability")
    storage_position = controls.find("const storageAvailable")
    can_restore_position = controls.find("canRestoreBackup()")
    failure_position = controls.find("if (storageAccessFailedRef.current)")
    import_disable_position = controls.find("setImportDisabled(!restoreAvailable)")
    require(min(storage_position, can_restore_position, failure_position, import_disable_position) >= 0,
            "復元UIの事前判定に必要な処理が見つかりません")
    require(storage_position < can_restore_position < failure_position < import_disable_position,
            "復元UIは保存可否→タイマー状態→保存障害→UI反映の順で判定してください")
    require("blockedByActiveTimer = !restoreAvailable && !storageAccessFailedRef.current;" in controls,
            "タイマー状態による復元不可と保存障害を区別してください")
    require("setUndoDisabled(true)" in controls, "安全に復元できない場合はUndoも無効化してください")
    require("集中タイマーの進行中・一時停止中・未記録完了中は復元できません。JSON書き出しは利用できます。" in controls,
            "タイマー状態で復元不可の場合は理由とJSON書き出し可を案内してください")
    require("安全な復元に必要な端末保存・タブ間調停を利用できないため、JSON書き出しだけ利用できます。" in controls,
            "保存・調停不可の場合は救出案内を維持してください")
    require("exportDisabled" not in SOURCE, "復元不可でも救出用JSON書き出しは無効化しないでください")

    recovery = section("function refreshRecoveryAvailability", "function exportBackup")
    require("refreshBackupControlAvailability({ announce: true })" in recovery,
            "復元用保存を読む前に復元UIの利用可否を確認してください")
    require("setUndoHidden(!matchesRestoredState)" in recovery,
            "現在状態と復元ポイントが一致する場合だけUndoを表示してください")

    import_body = section("async function importBackup", "function undoLastRestore")
    require("refreshBackupControlAvailability({ announce: true })" in import_body,
            "復元処理の入口でも保存・調停・タイマー状態を再確認してください")
    require(import_body.count("if (!canRestoreBackup())") >= 2,
            "ファイル読込・確認中に状態が変わった場合も復元を中止してください")
    require("restoreGuard !== currentRestoreGuard()" in import_body,
            "確認中の別タブ更新をguardで検出してください")
    require("progressActions.restoreBackupData" in SOURCE,
            "進捗復元はReact progress storeへ直接反映してください")
    require("timerActions.selectMinutes(restored.selectedMinutes)" in SOURCE,
            "タイマー時間の復元はReact timerStoreへ直接反映してください")

    undo_body = section("function undoLastRestore", "useEffect(() => {")
    require("refreshBackupControlAvailability({ announce: true })" in undo_body,
            "Undo処理の入口でも保存・調停・タイマー状態を再確認してください")
    require("!canRestoreBackup() || currentRestoreGuard() !== expectedGuard" in undo_body,
            "Undo確認中のタイマー・記録変更も検出してください")

    require("window.addEventListener('storage', handleStorage);" in SOURCE,
            "別タブの記録・タイマー・復元ポイント変更で復元UIを再評価してください")
    require("window.addEventListener('one:storage-error', handleStorageError);" in SOURCE,
            "保存障害時に復元UIを即時無効化してください")
    require("window.addEventListener('pageshow', handlePageShow);" in SOURCE,
            "BFCache復帰時も復元UIを再評価してください")
    require("document.visibilityState === 'visible'" in SOURCE,
            "前面復帰時に復元UIを再評価してください")
    require("refreshRecoveryAvailability();\n  }, [timerState, progressState, storageFailed]);" in SOURCE,
            "Reactのタイマー・進捗状態変更でも復元可否を追従させてください")

    print("React backup restore controls use direct module APIs while preserving timer and storage safety.")


if __name__ == "__main__":
    main()
