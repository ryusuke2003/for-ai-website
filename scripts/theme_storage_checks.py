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

    refresh = section(theme, "function refreshThemePreferenceFromStorage()", "function refreshThemeWhenVisible()")
    first_guard = refresh.find("if (storageAccessFailed) return false;")
    read_position = refresh.find("safeRead(THEME_STORAGE_KEY, null)")
    second_guard = refresh.find("if (storageAccessFailed) return false;", first_guard + 1)
    invalid_guard = refresh.find("storedTheme !== null && !VALID_THEMES.has(storedTheme)")
    fallback_position = refresh.find("const nextTheme = storedTheme ?? 'system';")
    apply_position = refresh.find("applyThemePreference(nextTheme, { persist: false, announce: false })")
    require(
        min(first_guard, read_position, second_guard, invalid_guard, fallback_position, apply_position) >= 0,
        "復帰時のテーマ再同期に必要な処理が見つかりません",
    )
    require(
        first_guard < read_position < second_guard < invalid_guard < fallback_position < apply_position,
        "復帰時は保存障害確認→読込→障害再確認→不正値拒否→削除時だけ自動テーマ→反映の順にしてください",
    )
    require("safeWrite(" not in refresh, "復帰時のテーマ再同期から保存値を書き戻さないでください")
    require("persist: false" in refresh, "復帰時のテーマ反映は永続化を再実行しないでください")
    require("announce: false" in refresh, "復帰するだけでテーマ状態を読み上げ直さないでください")

    visible_refresh = section(theme, "function refreshThemeWhenVisible()", "themeButtons.forEach")
    require("document.visibilityState === 'visible'" in visible_refresh, "背景へ移るだけではテーマ保存値を再読込しないでください")
    require("refreshThemePreferenceFromStorage()" in visible_refresh, "前面復帰時にテーマ保存値を再確認してください")

    storage_handler = section(
        theme,
        "window.addEventListener('storage', (event) => {",
        "document.addEventListener('visibilitychange'",
    )
    require("event.newValue" in storage_handler, "別タブのテーマ変更は storage event の newValue を使ってください")
    require("refreshThemePreferenceFromStorage()" not in storage_handler, "storage event 内で不要な localStorage 再読込をしないでください")
    require("event.newValue !== null && !VALID_THEMES.has(event.newValue)" in storage_handler, "別タブ由来の不正なテーマ値は現在表示へ反映しないでください")
    require("const nextTheme = event.newValue ?? 'system';" in storage_handler, "テーマ保存値の削除は自動テーマへのリセットとして扱ってください")
    require("applyThemePreference(nextTheme, { persist: false })" in storage_handler, "有効な別タブ変更は保存し直さず反映してください")

    require(
        "document.addEventListener('visibilitychange', refreshThemeWhenVisible);" in theme,
        "タブが前面へ戻ったときテーマ設定を再同期してください",
    )
    require(
        "window.addEventListener('pageshow', refreshThemePreferenceFromStorage);" in theme,
        "BFCacheなどから復元された場合もテーマ設定を再同期してください",
    )
    require(
        "このブラウザには設定を保存できませんでした。" in theme,
        "テーマ保存失敗は利用者向けステータスでも説明してください",
    )

    print("Theme preference ignores invalid stored values on both cross-tab events and tab resume.")


if __name__ == "__main__":
    main()
