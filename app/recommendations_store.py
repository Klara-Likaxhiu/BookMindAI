"""Persistent recommendation batches in Supabase (user_recommendations)."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import uuid4

from app.supabase_rest import request

TABLE = "user_recommendations"
BATCH_TTL_DAYS = 7
COLUMNS = (
    "id,user_id,title,author,isbn,genre,description,cover_url,reason,"
    "match_score,source,generated_at,expires_at,batch_id,position"
)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _utcnow_iso() -> str:
    return _utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")


def _parse_ts(value: Any) -> datetime | None:
    if not value:
        return None
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    text = str(value).strip()
    if not text:
        return None
    try:
        if text.endswith("Z"):
            text = text[:-1] + "+00:00"
        return datetime.fromisoformat(text)
    except ValueError:
        return None


def _normalize_title(title: Any) -> str:
    return str(title or "").strip().lower()


def _row_to_book(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": row.get("id"),
        "title": row.get("title") or "",
        "author": row.get("author") or "",
        "isbn": row.get("isbn"),
        "genre": row.get("genre") or "",
        "description": row.get("description") or "",
        "cover_url": row.get("cover_url"),
        "reason": row.get("reason") or "",
        "match": row.get("match_score") or 90,
        "match_score": row.get("match_score") or 90,
        "source": row.get("source") or "companion",
        "position": row.get("position"),
        "batch_id": row.get("batch_id"),
        "generated_at": row.get("generated_at"),
        "expires_at": row.get("expires_at"),
    }


def get_latest_recommendation_batch(user_id: str) -> dict[str, Any] | None:
    """Return the most recent recommendation batch for a user (single query)."""
    rows = request(
        "GET",
        TABLE,
        params={
            "user_id": f"eq.{user_id}",
            "select": COLUMNS,
            "order": "generated_at.desc",
            "limit": "12",
        },
    )
    if not isinstance(rows, list) or not rows:
        return None

    batch_id = rows[0].get("batch_id")
    if not batch_id:
        return None

    batch_rows = sorted(
        [row for row in rows if row.get("batch_id") == batch_id],
        key=lambda row: row.get("position") or 0,
    )
    if not batch_rows:
        return None

    generated_at = batch_rows[0].get("generated_at")
    expires_at = batch_rows[0].get("expires_at")
    generated_dt = _parse_ts(generated_at)
    expires_dt = _parse_ts(expires_at)
    now = _utcnow()
    stale = False
    if expires_dt:
        stale = expires_dt <= now
    elif generated_dt:
        stale = generated_dt + timedelta(days=BATCH_TTL_DAYS) <= now

    return {
        "batch_id": batch_id,
        "generated_at": generated_at,
        "expires_at": expires_at,
        "stale": stale,
        "recommendations": [_row_to_book(row) for row in batch_rows],
        "count": len(batch_rows),
    }


def get_recent_recommendation_titles(user_id: str, *, limit_batches: int = 3) -> set[str]:
    """Titles from recent batches — used to avoid repeating the last few sets."""
    rows = request(
        "GET",
        TABLE,
        params={
            "user_id": f"eq.{user_id}",
            "select": "title,batch_id,generated_at",
            "order": "generated_at.desc",
            "limit": str(max(3, limit_batches * 3)),
        },
    )
    if not isinstance(rows, list):
        return set()
    return {_normalize_title(row.get("title")) for row in rows if row.get("title")}


def books_to_profile_items(books: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Shape books for the Home UI / readerProfile.recommendations cache."""
    items: list[dict[str, Any]] = []
    for book in books:
        title = book.get("title")
        if not title:
            continue
        ai = {
            "title": title,
            "author": book.get("author") or "",
            "genre": book.get("genre") or "",
            "difficulty": book.get("difficulty") or "AI Pick",
            "reason": book.get("reason") or book.get("description") or "",
            "cover_url": book.get("cover_url") or None,
            "match": book.get("match_score") or book.get("match") or 90,
            "isbn": book.get("isbn"),
        }
        book_data = None
        if ai.get("cover_url"):
            book_data = {
                "title": ai["title"],
                "author": ai["author"],
                "genre": ai["genre"],
                "cover_url": ai["cover_url"],
                "isbn": ai.get("isbn"),
            }
        items.append({"ai_recommendation": ai, "book_data": book_data})
    return items



def save_recommendation_batch(
    user_id: str,
    books: list[dict[str, Any]],
    *,
    source: str = "companion",
    batch_id: str | None = None,
) -> dict[str, Any]:
    """Persist a full recommendation batch. Returns the saved batch payload."""
    if not books:
        raise ValueError("Cannot save an empty recommendation batch.")

    bid = batch_id or str(uuid4())
    generated_at = _utcnow_iso()
    expires_at = (_utcnow() + timedelta(days=BATCH_TTL_DAYS)).strftime("%Y-%m-%dT%H:%M:%SZ")

    seen_titles: set[str] = set()
    seen_isbns: set[str] = set()
    payload: list[dict[str, Any]] = []

    for index, book in enumerate(books):
        title = str(book.get("title") or "").strip()
        if not title:
            continue
        title_key = _normalize_title(title)
        if title_key in seen_titles:
            continue

        isbn = str(book.get("isbn") or "").strip() or None
        isbn_key = isbn.lower() if isbn else ""
        if isbn_key and isbn_key in seen_isbns:
            continue

        seen_titles.add(title_key)
        if isbn_key:
            seen_isbns.add(isbn_key)

        match_score = book.get("match_score", book.get("match"))
        try:
            match_score = int(match_score) if match_score is not None else 90
        except (TypeError, ValueError):
            match_score = 90

        payload.append(
            {
                "user_id": user_id,
                "title": title,
                "author": (book.get("author") or "").strip() or None,
                "isbn": isbn,
                "genre": (book.get("genre") or "").strip() or None,
                "description": (book.get("description") or book.get("reason") or "").strip()
                or None,
                "cover_url": book.get("cover_url") or None,
                "reason": (book.get("reason") or "").strip() or None,
                "match_score": match_score,
                "source": source,
                "generated_at": generated_at,
                "expires_at": expires_at,
                "batch_id": bid,
                "position": index,
            }
        )

    if not payload:
        raise ValueError("No valid recommendation books to save.")

    rows = request(
        "POST",
        TABLE,
        json=payload,
        prefer="return=representation",
    )
    saved = rows if isinstance(rows, list) else payload
    saved_sorted = sorted(saved, key=lambda row: row.get("position") or 0)

    return {
        "batch_id": bid,
        "generated_at": generated_at,
        "expires_at": expires_at,
        "stale": False,
        "recommendations": [_row_to_book(row) for row in saved_sorted],
        "count": len(saved_sorted),
    }
