from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
CUSTOM_TIMER_PATH = ROOT / "custom-timer.js"


def require(condition, message):
    if not condition:
        raise SystemExit(f"ERROR: {message}")


def section(source, start_marker, end_marker):
    start = source.find(start_marker)
    require(start >= 0, f"{start_marker} が見つかりません")
    end = source.find(end_marker, start)
    require(end > start, f"{end_marker} が見つかりません")
    return source[start:end]


def main():
    source = CUSTOM_TIMER_PATH.read_text(encoding="utf-8")

    require(
        "const DEFAULT_DOCUMENT_TITLE = 'ONE — 今日やる一つだけ';" in source,
        "通常時のページタイトルを明示してください",
    )

    title_renderer = section(
        source,
        "function renderTimerDocumentTitle()",
        "const renderTimerWithoutProgress = renderTimer;",
    )
    completion_pos = title_renderer.find("if (completionReady)")
    running_pos = title_renderer.find("if (timerId !== null && endAt !== null)")
    paused_pos = title_renderer.find("document.title = partiallyElapsed")

    require("const formatted = formatTime(remainingSeconds);" in title_renderer, "タイトルも共通の残り時間表記を使ってください")
    require("const fullDuration = selectedMinutes * 60;" in title_renderer, "一時停止判定は選択時間全体を基準にしてください")
    require(
        "remainingSeconds > 0 && remainingSeconds < fullDuration" in title_renderer,
        "途中経過だけを一時停止状態として扱ってください",
    )
    require(completion_pos >= 0, "未記録の完了をタイトルへ反映してください")
    require(running_pos > completion_pos, "完了状態は実行中表示より優先してください")
    require(paused_pos > running_pos, "一時停止表示は実行中判定の後にしてください")
    require("document.title = '完了！ — ONE';" in title_renderer, "完了タイトルを維持してください")
    require("document.title = `${formatted} — ONE`;" in title_renderer, "実行中は残り時間をタイトルへ表示してください")
    require("`${formatted} 一時停止 — ONE`" in title_renderer, "一時停止中も残り時間をタイトルへ残してください")
    require(": DEFAULT_DOCUMENT_TITLE;" in title_renderer, "待機状態では通常タイトルへ戻してください")

    wrapper = section(
        source,
        "renderTimer = function renderTimerWithProgress()",
        "function applyCustomTimerMinutes()",
    )
    base_pos = wrapper.find("renderTimerWithoutProgress();")
    progress_pos = wrapper.find("renderTimerProgress();")
    title_pos = wrapper.find("renderTimerDocumentTitle();")
    require(0 <= base_pos < progress_pos < title_pos, "本来の描画→進捗→タイトルの順で同期してください")

    initial_sync = source.rfind("renderTimerDocumentTitle();")
    require(initial_sync > source.find("customTimerLockObserver.observe"), "初期復元後にもタイトルを再同期してください")

    print("Document title follows running, paused, completed, and idle timer states consistently.")


if __name__ == "__main__":
    main()
