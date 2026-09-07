from html.parser import HTMLParser
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
INDEX_PATH = ROOT / "index.html"

EXPECTED_CSP = {
    "default-src": ["'none'"],
    "script-src": ["'self'"],
    "script-src-attr": ["'none'"],
    "style-src": ["'self'"],
    "style-src-attr": ["'none'"],
    "img-src": ["'none'"],
    "connect-src": ["'none'"],
    "font-src": ["'none'"],
    "media-src": ["'none'"],
    "object-src": ["'none'"],
    "frame-src": ["'none'"],
    "worker-src": ["'none'"],
    "base-uri": ["'none'"],
    "form-action": ["'none'"],
}
DENIED_RESOURCE_TAGS = {"form", "img", "picture", "iframe", "audio", "video", "object", "embed"}


class PolicyParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.csp = []
        self.referrer = []
        self.denied_tags = []

    def handle_starttag(self, tag, attrs):
        values = dict(attrs)
        if tag == "meta" and values.get("http-equiv", "").lower() == "content-security-policy":
            self.csp.append(values.get("content", ""))
        if tag == "meta" and values.get("name", "").lower() == "referrer":
            self.referrer.append(values.get("content", ""))
        if tag in DENIED_RESOURCE_TAGS:
            self.denied_tags.append(tag)


def parse_csp(policy):
    directives = {}
    for part in policy.split(";"):
        tokens = part.strip().split()
        if not tokens:
            continue
        name, *values = tokens
        if name in directives:
            raise ValueError(f"CSP directive is duplicated: {name}")
        directives[name] = values
    return directives


def main():
    parser = PolicyParser()
    parser.feed(INDEX_PATH.read_text(encoding="utf-8"))
    parser.close()

    errors = []
    if len(parser.csp) != 1:
        errors.append("Content-Security-Policy meta must exist exactly once")
    else:
        try:
            directives = parse_csp(parser.csp[0])
        except ValueError as exc:
            errors.append(str(exc))
        else:
            if directives != EXPECTED_CSP:
                errors.append(f"CSP must match the reviewed deny-by-default policy: {directives}")

    if parser.referrer != ["no-referrer"]:
        errors.append("Referrer policy must be exactly no-referrer")

    if parser.denied_tags:
        tags = ", ".join(sorted(set(parser.denied_tags)))
        errors.append(f"CSP-denied resource/form tags are present: {tags}")

    if errors:
        for error in errors:
            print(f"ERROR: {error}")
        raise SystemExit(1)

    print("Browser security policy checks passed.")


if __name__ == "__main__":
    main()
