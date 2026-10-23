"""Plain-text helpers shared by page metadata and emails."""
import re


def plain_excerpt(markdown: str, length: int) -> str:
    """Markdown → plain one-line text, cut at a word boundary (mirrors the blog's getPlainExcerpt)."""
    text = re.sub(r"```[\s\S]*?```", "", markdown or "")
    text = re.sub(r"!\[[^\]]*\]\([^)]*\)", "", text)
    text = re.sub(r"\[([^\]]+)\]\([^)]*\)", r"\1", text)
    text = re.sub(r"^\s{0,3}(#{1,6}|>|[-*+]|\d+\.)\s+", "", text, flags=re.MULTILINE)
    text = re.sub(r"(\*\*|__|\*|_|`|~~)", "", text)
    text = re.sub(r"\s+", " ", text).strip()
    if len(text) <= length:
        return text
    return text[:length].rsplit(" ", 1)[0].rstrip(",.;:") + "…"
