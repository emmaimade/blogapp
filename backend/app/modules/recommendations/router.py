from typing import List

from fastapi import APIRouter, Depends, Query, Request
from sqlmodel import Session

from app.core.db import get_session
from app.core.permissions import get_current_blog, get_public_blog, require_blog_owner
from app.core.security import get_current_user
from app.models import Blog, User
from app.schemas import (
    RecommendationFollowPayload,
    RecommendationFollowResult,
    RecommendationSettings,
    RecommendationsOverview,
    RecommendationsUpdate,
    RecommendedBlog,
)
from . import service as recommendation_service

router = APIRouter(tags=["recommendations"])


# ── Studio: the owner's Recommendations tab ──────────────────────────────────

@router.get("/blogs/{blog_id}/recommendations/manage", response_model=RecommendationsOverview)
def get_recommendations_overview(
    blog_id: int,
    blog: Blog = Depends(get_current_blog),
    session: Session = Depends(get_session),
    _: None = Depends(require_blog_owner),
):
    return recommendation_service.overview(blog, session)


@router.get("/blogs/{blog_id}/recommendations/search", response_model=List[RecommendedBlog])
def search_recommendable_blogs(
    blog_id: int,
    q: str = Query("", max_length=100),
    blog: Blog = Depends(get_current_blog),
    session: Session = Depends(get_session),
    _: None = Depends(require_blog_owner),
):
    return recommendation_service.search_blogs(blog, q, session)


@router.put("/blogs/{blog_id}/recommendations", response_model=RecommendationsOverview)
def update_recommendations(
    blog_id: int,
    payload: RecommendationsUpdate,
    request: Request,
    blog: Blog = Depends(get_current_blog),
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
    _: None = Depends(require_blog_owner),
):
    return recommendation_service.set_recommendations(blog, payload.blog_ids, current_user, request, session)


@router.patch("/blogs/{blog_id}/recommendations/settings", response_model=RecommendationSettings)
def update_recommendation_settings(
    blog_id: int,
    payload: RecommendationSettings,
    request: Request,
    blog: Blog = Depends(get_current_blog),
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
    _: None = Depends(require_blog_owner),
):
    """Whether other blogs may recommend this one."""
    allow = recommendation_service.set_allow_recommendations(blog, payload.allow_recommendations, current_user, request, session)
    return RecommendationSettings(allow_recommendations=allow)


# ── Readers ──────────────────────────────────────────────────────────────────

@router.get("/blogs/{blog_id}/recommendations", response_model=List[RecommendedBlog])
def get_recommendations(
    blog_id: int,
    blog: Blog = Depends(get_public_blog),
    session: Session = Depends(get_session),
):
    """The blog's "Recommended reads"."""
    return recommendation_service.shown_recommendations(blog.id, session)


@router.post("/followers/recommendations/follow", response_model=RecommendationFollowResult)
def follow_recommended_blogs(payload: RecommendationFollowPayload, session: Session = Depends(get_session)):
    """From the marketing site's confirm page, with the token from the follow just confirmed."""
    return recommendation_service.follow_recommended(payload.token, payload.blog_ids, session)
