from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
TIMER_DISPLAY_PATH = ROOT / "src" / "features" / "timer" / "TimerDisplay.jsx"


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
    source = TIMER_DISPLAY_PATH.read_text(encoding="utf-8")

    require(
        "const DEFAULT_DOCUMENT_TITLE = 'ONE — 集中タイマー';" in source,
        "通常時のページタイトルをタイマー向けに明示してください",
    )

    title_renderer = section(
        source,
        "function documentTitleFor(state, timeText)",
        "export function TimerDisplay()",
    )
    completion_pos = title_renderer.find("if (state.completionReady)")
    running_pos = title_renderer.find("if (state.running)")
    paused_pos = title_renderer.find("const partiallyElapsed")

    require(completion_pos >= 0, "未記録の完了をタイトルへ反映してください")
    require(running_pos > completion_pos, "完了状態は実行中表示より優先してください")
    require(paused_pos > running_pos, "一時停止判定は実行中判定の後にしてください")
    require("state.remainingSeconds > 0 && state.remainingSeconds < fullDuration" in title_renderer,
            "途中経過だけを一時停止状態として扱ってください")
    require("return '完了！ — ONE';" in title_renderer, "完了タイトルを維持してください")
    require("return `${timeText} — ONE`;" in title_renderer, "実行中は残り時間をタイトルへ表示してください")
    require("`${timeText} 一時停止 — ONE`" in title_renderer, "一時停止中も残り時間をタイトルへ残してください")
    require("DEFAULT_DOCUMENT_TITLE" in title_renderer, "待機状態では通常タイトルへ戻してください")

    require("useEffect(() => {" in source, "React state変更時にタイトルを同期してください")
    require("document.title = documentTitleFor(state, timeText);" in source,
            "ページタイトルは共通計算結果から更新してください")
    require(not (ROOT / "custom-timer.js").exists(),
            "タイトル同期のためだけにclassic custom-timer.jsを残さないでください")

    print("Document title follows running, paused, completed, and idle React timer states consistently.")


if __name__ == "__main__":
    main()
