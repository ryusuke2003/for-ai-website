from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
STYLES_PATH = ROOT / "styles.css"


def main():
    styles = STYLES_PATH.read_text(encoding="utf-8")
    selector = "button:focus-visible, input:focus-visible {"
    if selector not in styles:
        raise SystemExit("ERROR: キーボード操作用の :focus-visible スタイルがありません")

    block = styles.split(selector, 1)[1].split("}", 1)[0]
    required = (
        "outline: 3px solid #1d1d1f;",
        "outline-offset: 3px;",
        "box-shadow: 0 0 0 6px #f2efe7;",
    )
    for declaration in required:
        if declaration not in block:
            raise SystemExit(f"ERROR: フォーカスリングに {declaration} が必要です")

    if "currentColor" in block:
        raise SystemExit("ERROR: フォーカスリングを currentColor だけに依存させないでください")

    if "button:focus, input:focus {" in styles:
        raise SystemExit("ERROR: キーボードフォーカス表示は :focus-visible を維持してください")

    print("Focus visibility checks passed.")


if __name__ == "__main__":
    main()
