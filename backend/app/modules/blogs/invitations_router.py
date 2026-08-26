from typing import List

from fastapi import APIRouter, BackgroundTasks, Depends, Request, status
from sqlmodel import Session

from app.core.db import get_session
from app.core.permissions import require_blog_owner
from app.core.security import get_current_user
from app.models import User
from app.schemas import (
    BlogInvitationCreate,
    BlogInvitationInfo,
    BlogInvitationRead,
    BlogMemberRead,
    InvitationRegisterCreate,
)
from . import service as blog_service

# Owner-scoped: create/list/revoke invitations for a workspace the caller owns.
router = APIRouter(prefix="/blogs", tags=["invitations"])

# Public: no auth required to view an invite or accept/register with it.
invitations_router = APIRouter(prefix="/invitations", tags=["invitations"])


@router.post("/{blog_id}/invitations", response_model=BlogInvitationRead, status_code=status.HTTP_201_CREATED)
def create_invitation(
    blog_id: int,
    payload: BlogInvitationCreate,
    background_tasks: BackgroundTasks,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_blog_owner),
):
    return blog_service.create_invitation(blog_id, payload, session, current_user, background_tasks)


@router.get("/{blog_id}/invitations", response_model=List[BlogInvitationRead])
def list_invitations(
    blog_id: int,
    session: Session = Depends(get_session),
    _: None = Depends(require_blog_owner),
):
    return blog_service.list_invitations(blog_id, session)


@router.delete("/{blog_id}/invitations/{invitation_id}", status_code=status.HTTP_204_NO_CONTENT)
def revoke_invitation(
    blog_id: int,
    invitation_id: int,
    session: Session = Depends(get_session),
    _: None = Depends(require_blog_owner),
):
    blog_service.revoke_invitation(blog_id, invitation_id, session)


@invitations_router.get("/{token}", response_model=BlogInvitationInfo)
def get_invitation_info(token: str, session: Session = Depends(get_session)):
    return blog_service.get_invitation_info(token, session)


@invitations_router.post("/{token}/accept", response_model=BlogMemberRead)
def accept_invitation(
    token: str,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    return blog_service.accept_invitation(token, session, current_user)


@invitations_router.post("/{token}/register-and-accept")
def register_and_accept_invitation(
    token: str,
    payload: InvitationRegisterCreate,
    request: Request,
    session: Session = Depends(get_session),
):
    return blog_service.register_and_accept_invitation(token, payload, session, request=request)
