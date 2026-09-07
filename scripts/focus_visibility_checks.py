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

    hidden_hints = styles.find("body.focus-mode .task-card .hint,")
    warning_selector = "body.focus-mode .task-card #task-storage-status:not(:empty) {"
    visible_warning = styles.find(warning_selector)
    if hidden_hints < 0:
        raise SystemExit("ERROR: 集中表示では通常のタスク補助表示を隠してください")
    if visible_warning < 0:
        raise SystemExit("ERROR: 集中表示中も保存失敗警告を表示してください")
    if visible_warning < hidden_hints:
        raise SystemExit("ERROR: 保存失敗警告の表示ルールは通常ヒントを隠すルールより後に置いてください")

    warning_block = styles.split(warning_selector, 1)[1].split("}", 1)[0]
    if "display: block;" not in warning_block:
        raise SystemExit("ERROR: 保存失敗警告は集中表示中に明示的に表示してください")
    if "font-weight: 800;" not in warning_block:
        raise SystemExit("ERROR: 集中表示中の保存失敗警告は見落としにくい強調を維持してください")

    print("Focus visibility checks passed.")


if __name__ == "__main__":
    main()
