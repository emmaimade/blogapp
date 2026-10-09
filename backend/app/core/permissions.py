"""
Multi-Tenant Permission System
===============================
"""

from fastapi import Depends, Request
from sqlmodel import Session, select
from typing import Optional

from app.models import Blog, BlogMember, BlogRole, OnboardingStatus, PlatformRole, User
from app.core.db import get_session
from app.core.error_codes import ErrorCode
from app.core.exceptions import AuthorizationError, NotFoundError
from app.core.security import extract_bearer_token, get_current_user, get_current_user_optional

class Permissions:
    @staticmethod
    def is_super_admin(user: User) -> bool:
        return user.is_super_admin or user.platform_role == PlatformRole.SUPER_ADMIN
    
    @staticmethod
    def can_access_blog(user: User, blog_id: int, session: Session) -> bool:
        if Permissions.is_super_admin(user):
            return True
        membership = session.exec(
            select(BlogMember).where(
                BlogMember.user_id == user.id,
                BlogMember.blog_id == blog_id
            )
        ).first()
        return membership is not None
    
    @staticmethod
    def get_user_role_in_blog(user: User, blog_id: int, session: Session) -> Optional[BlogRole]:
        if Permissions.is_super_admin(user):
            return BlogRole.OWNER
        membership = session.exec(
            select(BlogMember).where(
                BlogMember.user_id == user.id,
                BlogMember.blog_id == blog_id
            )
        ).first()
        return membership.role if membership else None
    
    @staticmethod
    def can_edit_post(user: User, post, session: Session) -> bool:
        role = Permissions.get_user_role_in_blog(user, post.blog_id, session)
        if not role:
            return False
        if role in [BlogRole.OWNER, BlogRole.EDITOR]:
            return True
        if role == BlogRole.AUTHOR:
            return post.author_id == user.id
        return False
    
    @staticmethod
    def can_manage_blog(user: User, blog_id: int, session: Session) -> bool:
        role = Permissions.get_user_role_in_blog(user, blog_id, session)
        return role == BlogRole.OWNER
    
    @staticmethod
    def can_manage_team(user: User, blog_id: int, session: Session) -> bool:
        role = Permissions.get_user_role_in_blog(user, blog_id, session)
        return role == BlogRole.OWNER
    
    @staticmethod
    def can_manage_tags(user: User, blog_id: int, session: Session) -> bool:
        role = Permissions.get_user_role_in_blog(user, blog_id, session)
        return role in [BlogRole.OWNER, BlogRole.EDITOR]

    @staticmethod
    def can_create_post(user: User, blog_id: int, session: Session) -> bool:
        role = Permissions.get_user_role_in_blog(user, blog_id, session)
        return role in [BlogRole.OWNER, BlogRole.EDITOR, BlogRole.AUTHOR]

    @staticmethod
    def can_moderate_comments(user: User, blog_id: int, session: Session) -> bool:
        role = Permissions.get_user_role_in_blog(user, blog_id, session)
        return role in [BlogRole.OWNER, BlogRole.EDITOR]

async def get_public_blog(
    blog_id: int,
    request: Request,
    session: Session = Depends(get_session)
) -> Blog:
    """
    Reads anyone may make (the public site uses these too). A suspended
    workspace is hidden from the public but stays readable to its own
    members and superadmins, who still use these reads in the admin. The
    signed-in user is only looked up in that (rare) suspended case.
    """
    blog = session.get(Blog, blog_id)
    if not blog:
        raise NotFoundError(ErrorCode.BLOG_NOT_FOUND)
    if blog.is_active:
        return blog
    viewer = await get_current_user_optional(request, extract_bearer_token(request), session)
    if viewer and (
        Permissions.is_super_admin(viewer)
        or session.exec(
            select(BlogMember).where(BlogMember.user_id == viewer.id, BlogMember.blog_id == blog_id)
        ).first()
    ):
        return blog
    raise NotFoundError(ErrorCode.BLOG_NOT_FOUND)

_READ_METHODS = frozenset({"GET", "HEAD", "OPTIONS"})


def _allowed_while_suspended(request: Request, blog_id: int) -> bool:
    """
    Writes a suspended workspace still accepts: billing, so an owner can
    always cancel and never keeps paying for a workspace they can't use;
    and leaving it.
    """
    path = request.url.path.rstrip("/")
    return f"/blogs/{blog_id}/billing" in path or path.endswith(f"/blogs/{blog_id}/members/me")


async def get_current_blog(
    blog_id: int,
    request: Request,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
) -> Blog:
    if Permissions.is_super_admin(current_user):
        blog = session.get(Blog, blog_id)
        if not blog:
            raise NotFoundError(ErrorCode.BLOG_NOT_FOUND)
        return blog
    membership = session.exec(
        select(BlogMember).where(BlogMember.user_id == current_user.id, BlogMember.blog_id == blog_id)
    ).first()
    if not membership:
        raise AuthorizationError(ErrorCode.NOT_A_MEMBER)
    blog = session.get(Blog, blog_id)
    if not blog:
        raise NotFoundError(ErrorCode.BLOG_NOT_FOUND)
    # A workspace suspended by a superadmin stays readable to its members,
    # but is read-only.
    if (
        not blog.is_active
        and request.method not in _READ_METHODS
        and not _allowed_while_suspended(request, blog_id)
    ):
        raise AuthorizationError(ErrorCode.WORKSPACE_DEACTIVATED)
    return blog

async def require_blog_owner(
    blog: Blog = Depends(get_current_blog),
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    if Permissions.is_super_admin(current_user):
        return
    membership = session.exec(
        select(BlogMember).where(BlogMember.user_id == current_user.id, BlogMember.blog_id == blog.id, BlogMember.role == BlogRole.OWNER)
    ).first()
    if not membership:
        raise AuthorizationError(
            ErrorCode.INSUFFICIENT_PERMISSIONS,
            "Only a workspace owner can do this.",
        )

async def require_blog_editor(
    blog: Blog = Depends(get_current_blog),
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    if Permissions.is_super_admin(current_user):
        return
    membership = session.exec(
        select(BlogMember).where(BlogMember.user_id == current_user.id, BlogMember.blog_id == blog.id, BlogMember.role.in_([BlogRole.OWNER, BlogRole.EDITOR]))
    ).first()
    if not membership:
        raise AuthorizationError(
            ErrorCode.INSUFFICIENT_PERMISSIONS,
            "Only a workspace owner or editor can do this.",
        )

async def require_blog_author(
    blog: Blog = Depends(get_current_blog),
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    if Permissions.is_super_admin(current_user):
        return
    membership = session.exec(
        select(BlogMember).where(
            BlogMember.user_id == current_user.id,
            BlogMember.blog_id == blog.id,
            BlogMember.role.in_([BlogRole.OWNER, BlogRole.EDITOR, BlogRole.AUTHOR]),
        )
    ).first()
    if not membership:
        raise AuthorizationError(
            ErrorCode.INSUFFICIENT_PERMISSIONS,
            "You need author access to this workspace to do this.",
        )

async def require_super_admin(current_user: User = Depends(get_current_user)):
    if not Permissions.is_super_admin(current_user):
        raise AuthorizationError(ErrorCode.SUPER_ADMIN_REQUIRED)


async def require_completed_onboarding(
    blog: Blog = Depends(get_current_blog),
    current_user: User = Depends(get_current_user),
):
    if Permissions.is_super_admin(current_user):
        return
    if blog.onboarding_status != OnboardingStatus.COMPLETED:
        raise AuthorizationError(ErrorCode.ONBOARDING_INCOMPLETE)

def get_user_blogs(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
) -> list[Blog]:
    if Permissions.is_super_admin(current_user):
        return session.exec(select(Blog)).all()
    memberships = session.exec(select(BlogMember).where(BlogMember.user_id == current_user.id)).all()
    blog_ids = [m.blog_id for m in memberships]
    if not blog_ids:
        return []
    blogs = session.exec(select(Blog).where(Blog.id.in_(blog_ids))).all()
    return blogs
