"""
Multi-Tenant Permission System
===============================
"""

from fastapi import Depends, HTTPException, status
from sqlmodel import Session, select
from typing import Optional

from app.models import Blog, BlogMember, BlogRole, OnboardingStatus, PlatformRole, User
from app.core.db import get_session
from app.core.security import get_current_user

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
    session: Session = Depends(get_session)
) -> Blog:
    blog = session.get(Blog, blog_id)
    if not blog or not blog.is_active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Blog not found")
    return blog

async def get_current_blog(
    blog_id: int,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
) -> Blog:
    if Permissions.is_super_admin(current_user):
        blog = session.get(Blog, blog_id)
        if not blog:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Blog not found")
        return blog
    membership = session.exec(
        select(BlogMember).where(BlogMember.user_id == current_user.id, BlogMember.blog_id == blog_id)
    ).first()
    if not membership:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a member of this blog")
    blog = session.get(Blog, blog_id)
    if not blog:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Blog not found")
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
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Must be blog owner to perform this action")

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
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Must be blog owner or editor to perform this action")

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
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Must be blog owner, editor, or author to perform this action")

async def require_super_admin(current_user: User = Depends(get_current_user)):
    if not Permissions.is_super_admin(current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Super admin access required")


async def require_completed_onboarding(
    blog: Blog = Depends(get_current_blog),
    current_user: User = Depends(get_current_user),
):
    if Permissions.is_super_admin(current_user):
        return
    if blog.onboarding_status != OnboardingStatus.COMPLETED:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Workspace onboarding is incomplete",
        )

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
