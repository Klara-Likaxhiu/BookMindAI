"""Reading paths API — persisted in Supabase."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.deps import get_verified_user
from app.reading_paths_store import (
    ReadingPathsStoreError,
    get_path_by_genre_slug,
    list_user_paths,
    normalize_genre_slug,
    sync_user_paths,
    upsert_path,
)

router = APIRouter(prefix="/api/reading-paths", tags=["Reading Paths"])


class ReadingPathsSyncRequest(BaseModel):
    message: str | None = None
    paths: list[dict[str, Any]] = Field(default_factory=list)


def _raise_store_error(exc: ReadingPathsStoreError) -> None:
    raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.get("")
def get_reading_paths(user: dict = Depends(get_verified_user)) -> dict:
    try:
        paths = list_user_paths(user["id"])
    except ReadingPathsStoreError as exc:
        _raise_store_error(exc)

    return {
        "message": "Your saved reading paths.",
        "paths": paths,
    }


@router.put("")
def save_reading_paths(
    data: ReadingPathsSyncRequest,
    user: dict = Depends(get_verified_user),
) -> dict:
    try:
        saved = sync_user_paths(user["id"], data.paths)
    except ReadingPathsStoreError as exc:
        _raise_store_error(exc)

    return {
        "message": data.message or "Reading paths saved.",
        "paths": saved,
    }


@router.get("/by-genre/{genre_slug}")
def get_reading_path_by_genre(
    genre_slug: str,
    user: dict = Depends(get_verified_user),
) -> dict:
    slug = normalize_genre_slug(genre_slug)
    try:
        path = get_path_by_genre_slug(user["id"], slug)
    except ReadingPathsStoreError as exc:
        _raise_store_error(exc)

    if not path:
        raise HTTPException(status_code=404, detail="No reading path for this genre yet.")

    return {"path": path}


@router.post("/genre")
def create_genre_reading_path(
    data: dict,
    user: dict = Depends(get_verified_user),
) -> dict:
    """Create or return existing genre path — prefer /api/reader/genre-path for generation."""
    genre = str(data.get("genre") or "").strip()
    if not genre:
        raise HTTPException(status_code=400, detail="Genre is required.")

    slug = normalize_genre_slug(genre)
    try:
        existing = get_path_by_genre_slug(user["id"], slug)
        if existing:
            return {"created": False, "path_id": existing["id"], "path": existing}

        path_payload = data.get("path") or {}
        saved = upsert_path(
            user["id"],
            path_payload,
            genre_slug=slug,
            genre_label=genre,
        )
    except ReadingPathsStoreError as exc:
        _raise_store_error(exc)

    return {"created": True, "path_id": saved["id"], "path": saved}
