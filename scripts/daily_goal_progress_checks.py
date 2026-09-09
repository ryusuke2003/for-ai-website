from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
INDEX_SOURCE = (ROOT / "index.html").read_text(encoding="utf-8")
PROGRESS_SOURCE = (ROOT / "daily-goal-progress.js").read_text(encoding="utf-8")
STYLE_SOURCE = (ROOT / "timer-progress.css").read_text(encoding="utf-8")


def fail(message):
    raise SystemExit(f"ERROR: {message}")


def require(condition, message):
    if not condition:
        fail(message)


def section(source, start_marker, end_marker):
    start = source.find(start_marker)
    if start < 0:
        fail(f"{start_marker} が見つかりません")
    end = source.find(end_marker, start + len(start_marker))
    if end < 0:
        fail(f"{end_marker} が見つかりません")
    return source[start:end]


def main():
    stats_pos = INDEX_SOURCE.find('<script src="stats.js" defer></script>')
    progress_pos = INDEX_SOURCE.find('<script src="daily-goal-progress.js" defer></script>')
    tab_guard_pos = INDEX_SOURCE.find('<script src="tab-guard.js" defer></script>')
    require(min(stats_pos, progress_pos, tab_guard_pos) >= 0, "日次目標進捗モジュールの読み込み位置を確認できません")
    require(stats_pos < progress_pos < tab_guard_pos, "日次目標進捗モジュールはstats.jsの後、tab-guard.jsの前に読み込んでください")

    require("document.createElement('progress')" in PROGRESS_SOURCE, "目標進捗はネイティブprogress要素で表現してください")
    require("dailyGoalStatus.insertAdjacentElement('afterend', dailyGoalProgress);" in PROGRESS_SOURCE, "目標状態の直後に進捗バーを配置してください")
    require("dailyGoalProgress.hidden = true;" in PROGRESS_SOURCE, "目標未設定時は進捗バーを隠してください")
    require("dailyGoalProgress.setAttribute('aria-label', '今日の集中目標の進捗');" in PROGRESS_SOURCE, "進捗バーへ目的を示すラベルを付けてください")
    require("aria-live" not in PROGRESS_SOURCE, "目標進捗バーをaria-liveにして記録更新ごとに重複通知しないでください")

    reset = section(PROGRESS_SOURCE, "function resetDailyGoalProgress()", "function renderDailyGoalProgress()")
    require("dailyGoalProgress.max = 1;" in reset and "dailyGoalProgress.value = 0;" in reset, "未設定時はprogressの値も安全な初期値へ戻してください")
    require("removeAttribute('aria-valuetext')" in reset, "未設定へ戻るとき古い読み上げ値を残さないでください")

    render = section(PROGRESS_SOURCE, "function renderDailyGoalProgress()", "const renderDailyGoalWithoutProgress")
    require("Number.isInteger(dailyGoal)" in render, "目標値を整数として確認してから進捗へ反映してください")
    require("dailyGoal < MIN_DAILY_GOAL" in render and "dailyGoal > MAX_DAILY_GOAL" in render, "進捗バーでも1〜12回の目標範囲を守ってください")
    require("const today = todayFocusCount();" in render, "今日の記録回数を既存の正規化関数から取得してください")
    require("Math.min(today, dailyGoal)" in render, "目標超過時にprogressのvalueがmaxを超えないようにしてください")
    require("today >= dailyGoal" in render, "達成済みかを実際の今日の回数で判定してください")
    require("dailyGoalProgress.max = dailyGoal;" in render, "progressのmaxへ目標回数を設定してください")
    require("dailyGoalProgress.value = visibleValue;" in render, "progressのvalueへ現在進捗を設定してください")
    require("dailyGoalProgress.hidden = false;" in render, "有効な目標がある場合だけ進捗バーを表示してください")
    require("目標${dailyGoal}回を達成、現在${today}回" in render, "目標超過時も実際の回数を支援技術へ伝えてください")
    require("目標${dailyGoal}回中${today}回" in render, "未達成時は現在回数と目標回数を支援技術へ伝えてください")
    require("safeWrite(" not in render and "localStorage" not in render, "進捗表示のために新しい保存処理を追加しないでください")

    wrapper = section(
        PROGRESS_SOURCE,
        "const renderDailyGoalWithoutProgress",
        "\n\nrenderDailyGoalProgress();",
    )
    base_pos = wrapper.find("renderDailyGoalWithoutProgress();")
    progress_render_pos = wrapper.find("renderDailyGoalProgress();")
    require(min(base_pos, progress_render_pos) >= 0 and base_pos < progress_render_pos, "既存の日次目標表示後に進捗バーを同期してください")
    require("renderDailyGoal = function renderDailyGoalWithProgress()" in wrapper, "既存の日次目標描画経路へ進捗更新を統合してください")

    require(".daily-goal-progress {" in STYLE_SOURCE, "日次目標進捗バー専用のレイアウトを用意してください")
    require("accent-color: currentColor;" in section(STYLE_SOURCE, ".daily-goal-progress {", "}"), "テーマに追従するprogress表示を維持してください")
    require(".daily-goal-progress[hidden]" in STYLE_SOURCE and "display: none;" in STYLE_SOURCE, "author CSSでもhidden属性を確実に尊重してください")

    print("Daily goal progress stays visual-only, capped at the goal, hidden when unset, and synchronized through the existing goal renderer.")


if __name__ == "__main__":
    main()
