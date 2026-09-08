from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
INDEX = (ROOT / "index.html").read_text(encoding="utf-8")
SOURCE = (ROOT / "custom-timer.js").read_text(encoding="utf-8")


def fail(message):
    raise SystemExit(f"ERROR: {message}")


def section(source, start_marker, end_marker):
    start = source.find(start_marker)
    if start < 0:
        fail(f"{start_marker} が見つかりません")
    end = source.find(end_marker, start + len(start_marker))
    if end < 0:
        fail(f"{end_marker} が見つかりません")
    return source[start:end]


def require(condition, message):
    if not condition:
        fail(message)


def main():
    markup = section(INDEX, 'id="timer-end-time"', '</p>')
    require('hidden' in markup, "終了予定は待機中に非表示で開始してください")
    require('<time id="timer-end-at"></time>' in markup, "終了予定時刻はtime要素で表現してください")
    require('aria-live' not in markup, "250ms描画で終了予定をaria-live通知しないでください")

    require("document.querySelector('#timer-end-time')" in SOURCE, "終了予定コンテナを取得してください")
    require("document.querySelector('#timer-end-at')" in SOURCE, "終了予定のtime要素を取得してください")
    require("hourCycle: 'h23'" in SOURCE, "終了時刻は00〜23時表記にしてください")

    hide = section(SOURCE, "function hideTimerEndTime()", "function renderTimerEndTime()")
    require("timerEndTime.hidden = true;" in hide, "非実行時は終了予定を隠してください")
    require("timerEndAt.textContent = '';" in hide, "非実行時は古い終了時刻を残さないでください")
    require("timerEndAt.removeAttribute('datetime');" in hide, "非実行時は古いdatetime属性を残さないでください")

    render = section(SOURCE, "function renderTimerEndTime()", "function renderTimerDocumentTitle()")
    require("timerId === null || !Number.isFinite(endAt)" in render, "実行中で有効なendAtがある場合だけ終了予定を表示してください")
    require("hideTimerEndTime();" in render, "無効な終了予定は共通経路で隠してください")
    require("const endDate = new Date(endAt);" in render, "終了予定は絶対時刻endAtから計算してください")
    require("Number.isNaN(endDate.getTime())" in render, "不正な終了日時を表示しないでください")
    require("dateKey(endDate) === dateKey()" in render, "同日かどうかをローカル日付で判定してください")
    require("endDate.getMonth() + 1" in render and "endDate.getDate()" in render, "日付をまたぐ場合は月日も表示してください")
    require("timerEndAt.setAttribute('datetime', endDate.toISOString());" in render, "time要素へ機械可読な終了日時を設定してください")
    require("timerEndTime.hidden = false;" in render, "有効な実行中タイマーでは終了予定を表示してください")
    require("safeWrite(" not in render and "localStorage" not in render, "終了予定表示のために保存状態を増やさないでください")

    wrapper = section(SOURCE, "renderTimer = function renderTimerWithProgress()", "function applyCustomTimerMinutes()")
    base_pos = wrapper.find("renderTimerWithoutProgress();")
    progress_pos = wrapper.find("renderTimerProgress();")
    end_time_pos = wrapper.find("renderTimerEndTime();")
    title_pos = wrapper.find("renderTimerDocumentTitle();")
    require(min(base_pos, progress_pos, end_time_pos, title_pos) >= 0, "タイマー描画の各更新処理が見つかりません")
    require(base_pos < progress_pos < end_time_pos < title_pos, "基本表示→進捗→終了予定→タイトルの順で同期してください")

    require(
        SOURCE.rstrip().find("renderTimerEndTime();") > SOURCE.rstrip().find("syncCustomTimerLock();"),
        "初期表示でも終了予定の表示状態を同期してください",
    )

    print("Timer end time is derived from endAt, hidden outside running state, and exposed with semantic datetime.")


if __name__ == "__main__":
    main()
