from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
RESET_PATH = ROOT / "privacy-reset.js"


def section(source, start_marker, end_marker):
    start = source.find(start_marker)
    if start < 0:
        raise SystemExit(f"ERROR: {start_marker} が見つかりません")
    end = source.find(end_marker, start)
    if end < 0:
        raise SystemExit(f"ERROR: {end_marker} が見つかりません")
    return source[start:end]


def require(condition, message):
    if not condition:
        raise SystemExit(f"ERROR: {message}")


def main():
    source = RESET_PATH.read_text(encoding="utf-8")

    reporter = section(
        source,
        "function reportDataResetStorageFailure()",
        "function clearStoredOneData",
    )
    require("reportStorageFailure();" in reporter, "データ削除の保存例外はアプリ全体へ通知してください")
    require("return false;" in reporter, "保存例外時は削除/通知処理を失敗として返してください")

    clear = section(source, "function clearStoredOneData", "function createResetSignalValue()")
    require("preserveResetSignal = false" in clear, "通常削除と別タブ通知受信時で通知キーの扱いを切り替えられるようにしてください")
    require("key !== RESET_SIGNAL_KEY" in clear, "別タブ通知受信時は通知キーを送信元より先に削除しないでください")
    require("localStorage.removeItem(key)" in clear, "ONEの既知キーだけを削除する処理を維持してください")
    require("localStorage.getItem(key) === null" in clear, "削除後の確認を維持してください")
    require(
        "catch {\n    return reportDataResetStorageFailure();\n  }" in clear,
        "データ削除APIの例外時は保存障害を全体へ通知してください",
    )

    signal_builder = section(source, "function createResetSignalValue()", "function broadcastDataReset()")
    require("crypto.getRandomValues" in signal_builder, "利用可能ならWeb Cryptoで別タブ通知値を生成してください")
    require("resetSignalFallbackCounter" in signal_builder, "Web Crypto不可でも非秘密のローカル一意値へフォールバックしてください")
    require("Math.random" not in signal_builder, "別タブ通知値の生成でMath.random()へ依存しないでください")

    broadcast = section(source, "function broadcastDataReset()", "function stopLocalTimerForReset()")
    set_pos = broadcast.find("localStorage.setItem(RESET_SIGNAL_KEY, signal)")
    verify_set_pos = broadcast.find("localStorage.getItem(RESET_SIGNAL_KEY) !== signal")
    remove_pos = broadcast.find("localStorage.removeItem(RESET_SIGNAL_KEY)")
    verify_remove_pos = broadcast.find("localStorage.getItem(RESET_SIGNAL_KEY) === null")
    require(min(set_pos, verify_set_pos, remove_pos, verify_remove_pos) >= 0, "別タブ通知は保存・読み戻し・削除・削除確認まで行ってください")
    require(set_pos < verify_set_pos < remove_pos < verify_remove_pos, "別タブ通知は書き込み→読み戻し→削除→削除確認の順で処理してください")
    require(
        "catch {\n    return reportDataResetStorageFailure();\n  }" in broadcast,
        "別タブ通知APIの例外時も保存障害を全体へ通知してください",
    )

    storage_handler = source.split("window.addEventListener('storage', (event) => {", 1)[-1]
    require("event.key !== RESET_SIGNAL_KEY || event.newValue === null" in storage_handler, "別タブ削除通知だけを処理してください")
    require(
        "clearStoredOneData({ preserveResetSignal: true })" in storage_handler,
        "受信タブは送信元の保存確認が終わるまで通知キーを残してください",
    )

    require("localStorage.clear(" not in source, "他サイトデータを巻き込むlocalStorage.clear()は禁止です")
    require(source.count("reportDataResetStorageFailure();") == 2, "全体通知はlocalStorage例外の2経路だけに限定してください")

    print("Privacy reset verifies its cross-tab signal without racing receiving tabs or weakening scoped deletion.")


if __name__ == "__main__":
    main()
