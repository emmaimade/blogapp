"""Helpers shared by the CSV downloads (platform audit log, follower list)."""


def csv_safe(value: object) -> str:
    """Neutralise spreadsheet formulas in user-supplied text (CSV injection)."""
    text = "" if value is None else str(value)
    return f"'{text}" if text[:1] in ("=", "+", "-", "@", "\t", "\r") else text
