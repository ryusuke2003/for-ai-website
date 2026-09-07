from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
THEME_PATH = ROOT / "theme.js"


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
    theme = THEME_PATH.read_text(encoding="utf-8")

    require("localStorage.setItem(" not in theme, "theme.js の書き込みは共通 safeWrite() を使ってください")
    require("localStorage.getItem(" not in theme, "theme.js の読み込みは共通経路または storage event の値を使ってください")

    writer = section(theme, "function writeThemePreference(theme)", "function applyThemePreference")
    write_pos = writer.find("safeWrite(THEME_STORAGE_KEY, theme)")
    read_pos = writer.find("safeRead(THEME_STORAGE_KEY)")
    match_pos = writer.find("stored === theme")
    report_pos = writer.find("reportStorageFailure()")

    require(write_pos >= 0, "テーマ保存は safeWrite() を通してください")
    require(read_pos >= 0, "テーマ保存後は safeRead() で読み戻してください")
    require(match_pos >= 0, "テーマ保存後は書き込んだ値との一致を確認してください")
    require(report_pos >= 0, "読み戻し不一致は端末保存障害として通知してください")
    require(write_pos < read_pos < match_pos < report_pos, "テーマ保存は 書込→読戻し→一致確認→障害通知 の順を維持してください")
    require("if (storageAccessFailed) return false;" in writer, "safeRead() が失敗した場合は保存成功扱いにしないでください")

    storage_handler = section(
        theme,
        "window.addEventListener('storage', (event) => {",
        "applyThemePreference(initialTheme",
    )
    require("event.newValue" in storage_handler, "別タブのテーマ変更は storage event の newValue を使ってください")
    require("readStoredTheme()" not in storage_handler, "storage event 内で不要な localStorage 再読込をしないでください")
    require("VALID_THEMES.has(event.newValue)" in storage_handler, "別タブ由来のテーマ値も許可値を検証してください")

    require(
        "このブラウザには設定を保存できませんでした。" in theme,
        "テーマ保存失敗は利用者向けステータスでも説明してください",
    )

    print("Theme persistence uses shared storage health reporting and verified read-back.")


if __name__ == "__main__":
    main()
