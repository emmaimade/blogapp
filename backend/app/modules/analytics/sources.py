"""
Where a reader came from, from the referrer the blog sends with the first
view of a visit. Only the resulting source name is stored — never the URL,
which can carry search terms, tracking ids or other personal data.
"""
import re
from typing import Iterable, Optional
from urllib.parse import urlsplit

DIRECT = "Direct"
OTHER = "Other"

# Matched against the referrer's host and its parent domains, so
# "l.facebook.com" and "m.facebook.com" both land on facebook.com.
_KNOWN_HOSTS: dict[str, str] = {
    "whatsapp.com": "WhatsApp",
    "wa.me": "WhatsApp",
    "l.wl.co": "WhatsApp",
    "facebook.com": "Facebook",
    "fb.com": "Facebook",
    "fb.me": "Facebook",
    "t.co": "X",
    "x.com": "X",
    "twitter.com": "X",
    "linkedin.com": "LinkedIn",
    "lnkd.in": "LinkedIn",
    "instagram.com": "Instagram",
    "t.me": "Telegram",
    "telegram.org": "Telegram",
    "bing.com": "Bing",
    "duckduckgo.com": "DuckDuckGo",
    "yahoo.com": "Yahoo",
}

# Search engines with a country domain each (google.com.ng, google.co.uk...):
# matched on the name anywhere in the host.
_SEARCH_LABELS: dict[str, str] = {"google": "Google", "yahoo": "Yahoo", "bing": "Bing"}

# Android apps send "android-app://<package>/" as the referrer.
_ANDROID_APPS: dict[str, str] = {
    "com.whatsapp": "WhatsApp",
    "com.google.android.googlequicksearchbox": "Google",
    "com.google.android.gm": "Gmail",
    "com.twitter.android": "X",
    "com.facebook.katana": "Facebook",
    "com.linkedin.android": "LinkedIn",
    "org.telegram.messenger": "Telegram",
}

_HOST = re.compile(r"^[a-z0-9.-]{1,100}$")


def classify_referrer(referrer: Optional[str], own_hosts: Iterable[str] = ()) -> str:
    """A short source name for a referrer: "Google", "WhatsApp", "Direct", or the site's domain."""
    referrer = (referrer or "").strip()
    if not referrer:
        return DIRECT

    try:
        parts = urlsplit(referrer)
    except ValueError:
        return OTHER

    if parts.scheme == "android-app":
        return _ANDROID_APPS.get(parts.netloc.lower(), "Android app")
    if parts.scheme not in ("http", "https"):
        return OTHER

    host = (parts.hostname or "").lower().removeprefix("www.")
    if not host or not _HOST.match(host):
        return OTHER
    # Coming from the blog itself (say, a reload) isn't a new source.
    if host in {h.lower().removeprefix("www.") for h in own_hosts if h}:
        return DIRECT

    labels = host.split(".")
    for i in range(len(labels) - 1):
        known = _KNOWN_HOSTS.get(".".join(labels[i:]))
        if known:
            return known
    for label in labels:
        if label in _SEARCH_LABELS:
            return _SEARCH_LABELS[label]
    return host
