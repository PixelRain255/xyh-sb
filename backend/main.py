"""Deprecated entrypoint.

Please use: `uvicorn backend.chat.app.main:app --host 127.0.0.1 --port 8010`
"""

from warnings import warn

from backend.chat.app.main import app

warn(
    "`backend.main:app` is deprecated. Use `backend.chat.app.main:app` instead.",
    DeprecationWarning,
    stacklevel=2,
)

