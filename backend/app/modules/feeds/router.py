from fastapi import APIRouter, Depends, Query, Response
from sqlmodel import Session

from app.core.db import get_session
from . import service as feed_service

router = APIRouter(prefix="/feeds", tags=["feeds"])

# Crawlers fetch these often; an hour is fresh enough for new posts to show
# up the same day without every fetch reaching the database.
CACHE = {"Cache-Control": "public, max-age=3600"}


@router.get("/sitemap.xml")
def get_sitemap(host: str = Query(..., max_length=253), session: Session = Depends(get_session)):
    """The blog at `host`'s sitemap. Served at /sitemap.xml on the blog by its middleware."""
    return Response(feed_service.sitemap(host, session), media_type="application/xml", headers=CACHE)


@router.get("/rss.xml")
def get_rss(host: str = Query(..., max_length=253), session: Session = Depends(get_session)):
    """The latest posts as RSS 2.0. Served at /rss.xml on the blog."""
    return Response(feed_service.rss(host, session), media_type="application/rss+xml", headers=CACHE)


@router.get("/robots.txt")
def get_robots(host: str = Query(..., max_length=253), session: Session = Depends(get_session)):
    """Served at /robots.txt on the blog; points crawlers to the sitemap."""
    return Response(feed_service.robots(host, session), media_type="text/plain", headers=CACHE)
