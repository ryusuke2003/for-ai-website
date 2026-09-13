import re
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
PATTERNS = [
    re.compile(r"BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY"),
    re.compile("AK" + r"IA[0-9A-Z]{16}"),
    re.compile("gh" + r"p_[A-Za-z0-9]{30,}"),
    re.compile("github_" + r"pat_[A-Za-z0-9_]{30,}"),
]


def main():
    matches = []
    for path in ROOT.rglob("*"):
        if not path.is_file() or ".git" in path.parts:
            continue
        try:
            source = path.read_text(encoding="utf-8")
        except (UnicodeDecodeError, OSError):
            continue

        for pattern in PATTERNS:
            if pattern.search(source):
                matches.append(str(path.relative_to(ROOT)))
                break

    if matches:
        for path in matches:
            print(f"Potential secret material detected: {path}")
        raise SystemExit(1)

    print("Common secret material scan passed.")


if __name__ == "__main__":
    main()
