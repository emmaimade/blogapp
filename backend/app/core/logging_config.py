"""
Logging setup
=============

The project already logs through the stdlib (`logging.getLogger("inko.tasks")`,
`app.core.email`), it just never configured handlers — so those calls went to
the last-resort handler and lost their formatting. This wires up that existing
usage rather than introducing a second mechanism, and stamps every record with
the current request ID so a `request_id` shown to a user leads straight to the
matching log lines.

    2026-08-09 11:04:22 ERROR    [a3f1c9…] inko.errors: Unhandled exception …
"""

import logging
import sys

from app.core.config import settings
from app.core.request_context import get_request_id

LOGGER_NAMESPACE = "inko"

_LOG_FORMAT = "%(asctime)s %(levelname)-8s [%(request_id)s] %(name)s: %(message)s"
_DATE_FORMAT = "%Y-%m-%d %H:%M:%S"


class RequestIdFilter(logging.Filter):
    """Makes `%(request_id)s` available on every record."""

    def filter(self, record: logging.LogRecord) -> bool:
        record.request_id = get_request_id() or "-"
        return True


def configure_logging() -> None:
    """
    Idempotently install a formatter + request-ID filter on the root logger.

    Uvicorn configures its own `uvicorn.*` loggers; those are left alone so
    access logs keep their familiar shape. This only governs application logs.
    """
    root = logging.getLogger()
    level = getattr(logging, str(settings.LOG_LEVEL).upper(), logging.INFO)
    root.setLevel(level)

    handler = next(
        (h for h in root.handlers if getattr(h, "_inko_configured", False)),
        None,
    )
    if handler is None:
        handler = logging.StreamHandler(sys.stdout)
        handler._inko_configured = True  # type: ignore[attr-defined]
        root.addHandler(handler)

    handler.setLevel(level)
    handler.setFormatter(logging.Formatter(_LOG_FORMAT, datefmt=_DATE_FORMAT))
    if not any(isinstance(f, RequestIdFilter) for f in handler.filters):
        handler.addFilter(RequestIdFilter())

    # Any pre-existing root handlers (e.g. installed by uvicorn --log-config)
    # would otherwise blow up formatting a record that lacks `request_id`.
    for existing in root.handlers:
        if not any(isinstance(f, RequestIdFilter) for f in existing.filters):
            existing.addFilter(RequestIdFilter())


def get_logger(name: str) -> logging.Logger:
    """Logger inside the app namespace, so levels can be tuned as a group."""
    return logging.getLogger(f"{LOGGER_NAMESPACE}.{name}")
