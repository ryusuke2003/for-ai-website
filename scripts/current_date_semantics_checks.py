from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
STATS_SOURCE = (ROOT / "stats.js").read_text(encoding="utf-8")


def fail(message):
    raise SystemExit(f"ERROR: {message}")


def require(condition, message):
    if not condition:
        fail(message)


def function_body(name, next_name):
    start = STATS_SOURCE.find(f"function {name}")
    end = STATS_SOURCE.find(f"function {next_name}", start)
    if start < 0 or end < 0:
        fail(f"{name}() の範囲を確認できません")
    return STATS_SOURCE[start:end]


def main():
    label_body = function_body("currentDayAriaLabel", "markCurrentHistoryDay")
    require(
        "`今日 ${key}: ${count}回`" in label_body,
        "今日の読み上げには『今日』・日付・回数を含めてください",
    )

    history_body = function_body("markCurrentHistoryDay", "renderActivityMap")
    require(
        "historyGrid.querySelectorAll('.history-day[role=\"listitem\"]')" in history_body,
        "7日履歴のlistitemを対象に今日を意味付けしてください",
    )
    require(
        "item.setAttribute('aria-current', 'date');" in history_body,
        "7日履歴の今日には aria-current=date を付けてください",
    )
    require(
        "item.setAttribute('aria-label', currentDayAriaLabel(todayKey, count));" in history_body,
        "7日履歴の今日には『今日』を含む読み上げを設定してください",
    )
    require(
        "item.removeAttribute('aria-current');" in history_body,
        "今日以外へ aria-current が残らないようにしてください",
    )

    activity_body = function_body("renderActivityMap", "renderProgressInsights")
    require(
        "const isToday = key === todayKey;" in activity_body,
        "30日マップでは日付キーから今日を判定してください",
    )
    require(
        "item.setAttribute('aria-label', isToday ? currentDayAriaLabel(key, count) : `${key}: ${count}回`);" in activity_body,
        "30日マップの今日だけ『今日』を含む読み上げにしてください",
    )
    require(
        "item.classList.add('is-today');" in activity_body
        and "item.setAttribute('aria-current', 'date');" in activity_body,
        "30日マップでは見た目の今日と aria-current=date を同時に設定してください",
    )
    require(
        "tabindex" not in activity_body.lower(),
        "30日分のセルを個別のTab移動対象にしないでください",
    )

    wrapper_start = STATS_SOURCE.find("renderHistory = function renderHistoryWithInsights()")
    wrapper_end = STATS_SOURCE.find("markCurrentHistoryDay();", wrapper_start)
    require(wrapper_start >= 0 and wrapper_end >= 0, "7日履歴の再描画ラッパーを確認できません")
    wrapper = STATS_SOURCE[wrapper_start:wrapper_end]
    require(
        wrapper.find("renderHistoryWithoutInsights();") < wrapper.find("markCurrentHistoryDay();"),
        "7日履歴DOMを描画した後に今日の意味付けを行ってください",
    )
    require(
        STATS_SOURCE.rstrip().endswith("renderActivityMap();"),
        "初期表示でも統計と今日の意味付けを実行してください",
    )

    print("Current date semantics checks passed.")


if __name__ == "__main__":
    main()
