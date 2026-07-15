"""Shared HTTP client for Supabase REST, OpenAI, and storage requests."""

from __future__ import annotations

import httpx

_CLIENT: httpx.Client | None = None


def get_http_client() -> httpx.Client:
    global _CLIENT
    if _CLIENT is None or _CLIENT.is_closed:
        _CLIENT = httpx.Client(
            timeout=httpx.Timeout(20.0, connect=10.0),
            limits=httpx.Limits(max_connections=40, max_keepalive_connections=20),
        )
    return _CLIENT


def close_http_client() -> None:
    global _CLIENT
    if _CLIENT is not None and not _CLIENT.is_closed:
        _CLIENT.close()
    _CLIENT = None
