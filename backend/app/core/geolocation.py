"""
Best-effort IP -> location lookup for the personal security trail, using
ip-api.com's free tier (no key, ~45 req/min). Deliberately soft-fails to
None on any error, timeout, unresolvable IP, or rate limit — a missing
location is a cosmetic gap on a security page, not something worth
surfacing as an error to the user or blocking the page on.
"""
import ipaddress
from typing import Optional

import httpx

_TIMEOUT_SECONDS = 2.0
_API_URL = "http://ip-api.com/json/{ip}"
_FIELDS = "status,city,countryCode"

# Process-lifetime cache: the same login IP (home/office) recurs across many
# audit rows, and re-querying a free-tier API for a value that never changes
# for a given IP wastes the rate limit for no benefit.
_cache: dict[str, Optional[str]] = {}


def _is_public(ip: str) -> bool:
    try:
        addr = ipaddress.ip_address(ip)
    except ValueError:
        return False
    return not (addr.is_private or addr.is_loopback or addr.is_link_local or addr.is_reserved)


def describe_location(ip: Optional[str]) -> Optional[str]:
    """
    Returns a "City, CC" label for a public IP, or None if the IP is
    missing, private/loopback/reserved (dev and LAN traffic never resolve
    to anything meaningful), or the lookup fails.
    """
    if not ip or not _is_public(ip):
        return None

    if ip in _cache:
        return _cache[ip]

    location: Optional[str] = None
    try:
        response = httpx.get(
            _API_URL.format(ip=ip),
            params={"fields": _FIELDS},
            timeout=_TIMEOUT_SECONDS,
        )
        data = response.json()
        if data.get("status") == "success":
            city = data.get("city")
            country_code = data.get("countryCode")
            location = ", ".join(part for part in (city, country_code) if part) or None
    except (httpx.HTTPError, ValueError):
        location = None

    _cache[ip] = location
    return location
