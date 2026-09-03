"""
Minimal User-Agent -> human-readable device label parsing, e.g. turning
"Mozilla/5.0 (Windows NT 10.0; Win64; x64) ... Chrome/128.0 Safari/537.36"
into "Chrome on Windows" for the personal security trail (About page shows
"was this me?" at a glance, not a bare UA string). Deliberately not a full
UA-parsing library — covers the mainstream browsers/platforms well enough
for that purpose; anything unrecognized just falls back to None.
"""
import re
from typing import Optional

# Order matters: several Chromium-based browsers (Edge, Opera, Samsung
# Internet) also carry a "Chrome/" token, so the more specific browser must
# be checked before the generic one it's built on.
_BROWSER_PATTERNS = [
    ("Edge", re.compile(r"Edg(?:A|iOS)?/")),
    ("Opera", re.compile(r"OPR/|Opera/")),
    ("Samsung Internet", re.compile(r"SamsungBrowser/")),
    ("Chrome", re.compile(r"Chrome/")),
    ("Firefox", re.compile(r"Firefox/")),
    # Real desktop/mobile Safari has no "Chrome/" token and reports both
    # Version/ and Safari/ — checked last since Chrome UAs also match "Safari/".
    ("Safari", re.compile(r"Version/.+Safari/")),
]

_PLATFORM_PATTERNS = [
    ("iPhone", re.compile(r"iPhone")),
    ("iPad", re.compile(r"iPad")),
    ("Android", re.compile(r"Android")),
    ("Windows", re.compile(r"Windows NT")),
    ("macOS", re.compile(r"Mac OS X")),
    ("Linux", re.compile(r"Linux")),
]


def describe_user_agent(user_agent: Optional[str]) -> Optional[str]:
    """
    Returns a short "<Browser> on <Platform>" label, just "<Browser>" or
    "<Platform>" alone if only one side is recognized, or None if the
    user agent is missing or unrecognized (e.g. a script, an API client).
    """
    if not user_agent:
        return None

    browser = next((name for name, pattern in _BROWSER_PATTERNS if pattern.search(user_agent)), None)
    platform = next((name for name, pattern in _PLATFORM_PATTERNS if pattern.search(user_agent)), None)

    if browser and platform:
        return f"{browser} on {platform}"
    return browser or platform
