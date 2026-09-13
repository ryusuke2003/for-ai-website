from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
INSIGHTS = (ROOT / "src" / "features" / "progress" / "progressInsights.js").read_text(encoding="utf-8")
DETAILS = (ROOT / "src" / "features" / "progress" / "ProgressDetails.jsx").read_text(encoding="utf-8")


def require(condition, message):
    if not condition:
        raise SystemExit(f"ERROR: {message}")


def main():
    require("function currentDayAriaLabel(key, count)" in INSIGHTS, "今日用の読み上げ関数を維持してください")
    require("`今日 ${key}: ${count}回`" in INSIGHTS, "今日の読み上げに日付と回数を含めてください")
    require("const current = key === todayKey;" in INSIGHTS, "日付キーから今日を判定してください")
    require("weekday: current ? '今日'" in INSIGHTS, "7日履歴で今日を明示してください")
    require("aria-current={day.current ? 'date' : undefined}" in DETAILS, "7日履歴の今日をaria-currentで示してください")
    require("cell.current ? 'outline outline-2 outline-offset-1 outline-current' : ''" in DETAILS, "30日マップの今日を見た目でも区別してください")
    require("aria-current={cell.current ? 'date' : undefined}" in DETAILS, "30日マップの今日をaria-currentで示してください")
    print("Current date semantics checks passed.")


if __name__ == "__main__":
    main()
