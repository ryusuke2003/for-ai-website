from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
TIMER_DIR = ROOT / "src" / "features" / "timer"


def require(condition, message):
    if not condition:
        raise SystemExit(f"ERROR: {message}")


def main():
    # ここでは挙動や実装文字列を検査しない。
    # Vitestでは表現しにくい「移行後のアーキテクチャ境界」だけを守る。
    for path in (
        TIMER_DIR / "timerStateGuard.js",
        TIMER_DIR / "timerStore.js",
        TIMER_DIR / "useTimerState.js",
        TIMER_DIR / "TimerDisplay.jsx",
    ):
        require(path.is_file(), f"Reactタイマーの正本が見つかりません: {path.relative_to(ROOT)}")

    for legacy_path in (
        ROOT / "timer-bootstrap.js",
        ROOT / "custom-timer.js",
        ROOT / "timer-progress.css",
        ROOT / "legacy" / "interop" / "timer.js",
    ):
        require(
            not legacy_path.exists(),
            f"React移行後のlegacy実装を復活させないでください: {legacy_path.relative_to(ROOT)}",
        )

    require((ROOT / "src" / "tailwind.css").is_file(), "共通CSSはsrc/tailwind.cssに維持してください")

    print("Timer architecture boundaries are intact; behavior is covered by Vitest.")


if __name__ == "__main__":
    main()
