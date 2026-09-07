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
        "function clearStoredOneData()",
    )
    require("reportStorageFailure();" in reporter, "データ削除の保存例外はアプリ全体へ通知してください")
    require("return false;" in reporter, "保存例外時は削除/通知処理を失敗として返してください")

    clear = section(source, "function clearStoredOneData()", "function broadcastDataReset()")
    require("localStorage.removeItem(key)" in clear, "ONEの既知キーだけを削除する処理を維持してください")
    require("localStorage.getItem(key) === null" in clear, "削除後の確認を維持してください")
    require(
        "catch {\n    return reportDataResetStorageFailure();\n  }" in clear,
        "データ削除APIの例外時は保存障害を全体へ通知してください",
    )

    broadcast = section(source, "function broadcastDataReset()", "function stopLocalTimerForReset()")
    require("localStorage.setItem(RESET_SIGNAL_KEY" in broadcast, "別タブへの削除通知を維持してください")
    require("localStorage.removeItem(RESET_SIGNAL_KEY);" in broadcast, "削除通知キーは一時利用のままにしてください")
    require(
        "catch {\n    return reportDataResetStorageFailure();\n  }" in broadcast,
        "別タブ通知APIの例外時も保存障害を全体へ通知してください",
    )

    require("localStorage.clear(" not in source, "他サイトデータを巻き込むlocalStorage.clear()は禁止です")
    require(source.count("reportDataResetStorageFailure();") == 2, "全体通知はlocalStorage例外の2経路だけに限定してください")

    print("Privacy reset reports storage API exceptions without treating ordinary verification mismatches as storage failure.")


if __name__ == "__main__":
    main()
