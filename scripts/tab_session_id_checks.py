from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
SOURCE = (ROOT / "tab-guard.js").read_text(encoding="utf-8")


def section(start_marker, end_marker):
    start = SOURCE.find(start_marker)
    end = SOURCE.find(end_marker, start)
    if start < 0 or end <= start:
        raise SystemExit(f"ERROR: 検査範囲を取得できません: {start_marker}")
    return SOURCE[start:end]


def require(condition, message):
    if not condition:
        raise SystemExit(f"ERROR: {message}")


def main():
    create_session = section("function createSessionId()", "function ensureStoredSessionId()")

    require("new Uint8Array(16)" in create_session, "新しいタブ識別子には16バイトの乱数を使ってください")
    require(
        "globalThis.crypto.getRandomValues(bytes)" in create_session,
        "タブ識別子はWeb CryptoのgetRandomValues()で生成してください",
    )
    require("padStart(2, '0')" in create_session, "乱数バイトは固定長のhexへ変換してください")
    require("Math.random" not in create_session, "タブ識別子の生成にMath.random()を使わないでください")
    require(
        "typeof globalThis.crypto.getRandomValues !== 'function'" in create_session,
        "Web Cryptoが使えるか生成前に確認してください",
    )
    require(
        create_session.count("disableTabCoordination();") >= 2,
        "安全な乱数を利用できない場合は複数タブ調停を停止してください",
    )
    require(create_session.count("return null;") >= 2, "乱数生成失敗時に弱い代替IDを返さないでください")

    ensure_session = section("function ensureStoredSessionId()", "function isTimerStateActive")
    require("if (!candidate) return null;" in ensure_session, "セッションID生成失敗後は保存処理へ進まないでください")

    start_listener = section("startButton.addEventListener('click'", "resetButton.addEventListener('click'")
    require("localSessionId = createSessionId();" in start_listener, "新規タイマー開始時は安全なセッションID生成器を使ってください")
    require("if (!localSessionId) return;" in start_listener, "ID生成失敗時は弱い識別子を書き込まないでください")
    require(
        start_listener.find("if (!localSessionId) return;") < start_listener.find("writeStoredSessionId(localSessionId);"),
        "ID生成成功を確認してから保存してください",
    )

    require(
        "const SESSION_ID_PATTERN = /^[a-z0-9-]{8,80}$/;" in SOURCE,
        "既存タブのセッションIDを読み取れる互換パターンは維持してください",
    )

    print("Tab session IDs use cryptographic randomness without weakening single-tab fallback behavior.")


if __name__ == "__main__":
    main()
