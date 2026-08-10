import random
from typing import List
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, BackgroundTasks
from fastapi.security import OAuth2PasswordRequestForm
from sqlmodel import Session, select
from slugify import slugify

from app.core.audit import add_audit_log
from app.core.db import get_session
from app.core.error_codes import ErrorCode
from app.core.exceptions import (
    AuthenticationError,
    AuthorizationError,
    ConflictError,
    NotFoundError,
)
from app.core.security import (
    ensure_strong_password,
    get_current_user,
    get_password_hash,
    require_password_changed,
)
from app.services.auth_tokens import create_verification_token, TokenCooldownError
from app.core.email import dispatch_email
from app.core.email_templates import (
    get_verification_template, 
    get_verification_template_text,
    get_account_deleted_template, 
    get_account_deleted_template_text
)
from app.models import (
    AuditLog,
    Blog,
    BlogMember,
    BlogRole,
    BlogSubscription,
    OnboardingStatus,
    OnboardingStep,
    User,
)
from app.schemas import UserCreate, UserRead, UserUpdate
from app.modules.auth.service import authenticate_user, build_login_response, build_user_payload

router = APIRouter(prefix="/users", tags=["Users"])


def _generate_unique_workspace_slug(seed: str, session: Session) -> str:
    base_slug = slugify(seed) or "workspace"
    unique_slug = base_slug
    counter = 1

    while session.exec(select(Blog).where((Blog.slug == unique_slug) | (Blog.subdomain == unique_slug))).first():
        unique_slug = f"{base_slug}-{counter}"
        counter += 1

    return unique_slug

def _generate_random_handle(email: str, session: Session) -> str:
    """
    Takes an email like 'jane.doe@example.com', cleans the prefix to 'janedoe',
    and appends a random 4-digit suffix to create a safe database username.
    """
    email_prefix = email.split("@")[0]
    base = "".join(c for c in email_prefix if c.isalnum() or c == "_").lower() or "user"
    
    unique_handle = f"{base}{random.randint(1000, 9999)}"
    
    while session.exec(select(User).where(User.username == unique_handle)).first():
        unique_handle = f"{base}{random.randint(1000, 9999)}"
        
    return unique_handle


@router.post("/register")
def register(user_data: UserCreate, background_tasks: BackgroundTasks, session: Session = Depends(get_session)):
    existing_email = session.exec(select(User).where(User.email == user_data.email)).first()
    if existing_email:
        raise ConflictError(ErrorCode.EMAIL_ALREADY_EXISTS)

    # This is the only entry point that reaches /users/register without a
    # client that already enforces password strength — the public blog's own
    # signup form (blog/src/pages/Auth.tsx) submits here with no client-side
    # check at all. Uses the same shared policy as password reset/change/invite
    # signup, so all password-setting paths agree.
    ensure_strong_password(user_data.password)

    random_handle = _generate_random_handle(user_data.email, session)

    hashed = get_password_hash(user_data.password)
    new_user = User(
        username=random_handle,
        first_name=user_data.first_name,
        last_name=user_data.last_name,
        email=user_data.email,
        hashed_password=hashed,
    )

    session.add(new_user)
    session.flush()

    workspace_name = (user_data.workspace_name or user_data.username).strip() or user_data.username
    workspace_slug_seed = (user_data.workspace_slug or workspace_name).strip() or workspace_name
    workspace_slug = _generate_unique_workspace_slug(workspace_slug_seed, session)

    new_blog = Blog(
        name=workspace_name,
        slug=workspace_slug,
        subdomain=workspace_slug,
        owner_id=new_user.id,
        onboarding_status=OnboardingStatus.IN_PROGRESS,
        onboarding_step=OnboardingStep.ABOUT,
    )
    session.add(new_blog)
    session.flush()

    session.add(
        BlogMember(
            user_id=new_user.id,
            blog_id=new_blog.id,
            role=BlogRole.OWNER,
        )
    )
    session.add(BlogSubscription(blog_id=new_blog.id))

    add_audit_log(
        session,
        action="user.register",
        resource_type="user",
        resource_id=new_user.id,
        actor=new_user,
        details={"username": new_user.username},
    )
    session.commit()
    session.refresh(new_user)

    try:
        raw_token = create_verification_token(session, new_user.id)
        email_content = get_verification_template(f"{new_user.first_name} {new_user.last_name}", raw_token)
        email_text = get_verification_template_text(f"{new_user.first_name} {new_user.last_name}", raw_token)
        dispatch_email(background_tasks, new_user.email, "Verify your email address", email_content, email_text)
    except TokenCooldownError:
        # Extremely unlikely for a brand-new user (no prior token could exist yet),
        # but if it somehow fires, don't fail a successful registration over an
        # email-cooldown edge case — the account and workspace are already committed.
        pass

    # build_login_response takes the User itself (it reads user.username to mint
    # the token), not an id — passing new_user.id made this endpoint raise
    # AttributeError and return a bare 500. The two other call sites in
    # auth/router.py and blogs/router.py already pass the object.
    return build_login_response(new_user, session)


@router.post("/login")
def login(form_data: OAuth2PasswordRequestForm = Depends(), session: Session = Depends(get_session)):
    user = authenticate_user(form_data.username, form_data.password, session)
    if not user:
        # Identical response for unknown account and wrong password — see the
        # note on /auth/login for why this stays 400 rather than 401.
        raise AuthenticationError(ErrorCode.INVALID_CREDENTIALS)

    add_audit_log(
        session,
        action="user.login",
        resource_type="user",
        resource_id=user.id,
        actor=user,
    )
    session.commit()
    # Same fix as /users/register above — this takes the User, not its id.
    return build_login_response(user, session)


@router.get("/me", response_model=UserRead)
async def get_current_user_info(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    return build_user_payload(current_user.id, session)


@router.get("/me/audit-logs")
def get_my_audit_logs(
    skip: int = 0,
    limit: int = 50,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """
    Retrieve personal security and activity logs for the authenticated user.
    """
    # Query database strictly for actions where current_user is the actor.
    # Excludes http.* middleware noise rows, same as the workspace and
    # superadmin audit log endpoints.
    statement = (
        select(AuditLog)
        .where(
            AuditLog.actor_user_id == current_user.id,
            ~AuditLog.action.startswith("http."),
        )
        .order_by(AuditLog.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    
    logs = session.exec(statement).all()
    return logs


@router.get("/{user_id}", response_model=UserRead)
def get_user_profile(user_id: int, current_user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    """
    Fetches user information page profiles. Gated tightly to:
    - The target user themselves.
    - Global Platform Superadmins.
    - Workspace/Blog owners sharing a workspace partition with the target user.
    """
    # Define standard payload fetching expression strategy to populate memberships and deep blog relations
    # 1. A user can always view their own info page profile
    if current_user.id == user_id:
        try:
            return build_user_payload(current_user.id, session)
        except ValueError:
            raise NotFoundError(ErrorCode.USER_NOT_FOUND)

    if getattr(current_user, "is_super_admin", False) or getattr(current_user, "platform_role", "") == "super_admin":
        try:
            return build_user_payload(user_id, session)
        except ValueError:
            raise NotFoundError(ErrorCode.USER_NOT_FOUND)
        
    # 3. Blog Owners can look up a user ONLY if they share an explicitly OWNED workspace
    owned_blog_ids = session.exec(
        select(BlogMember.blog_id)
        .where(
            BlogMember.user_id == current_user.id,
            BlogMember.role == BlogRole.OWNER
        )
    ).all()

    if owned_blog_ids:
        # Verify if target profile user is linked inside our owned workspace slices
        shared_member = session.exec(
            select(BlogMember)
            .where(
                BlogMember.user_id == user_id,
                BlogMember.blog_id.in_(owned_blog_ids)
            )
        ).first()
        
        if shared_member:
            try:
                return build_user_payload(user_id, session)
            except ValueError:
                pass

    # 4. Fallthrough: Reject unauthorized requests
    raise AuthorizationError(
        ErrorCode.FORBIDDEN,
        "You don't have permission to view this profile.",
    )


@router.patch("/me", response_model=UserRead)
def update_user_profile(
    user_data: UserUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_password_changed),
):
    db_user = current_user
    update_dict = user_data.model_dump(exclude_unset=True)
    update_dict.pop("password", None)

    # Capture the previous values BEFORE mutating, so the audit log can show
    # what actually changed (e.g. first_name "Jane" -> "Janet") rather than
    # just which fields were touched.
    changes = {}
    for key, value in update_dict.items():
        old_value = getattr(db_user, key, None)
        if old_value != value:
            changes[key] = {"from": old_value, "to": value}
        setattr(db_user, key, value)

    session.add(db_user)
    add_audit_log(
        session,
        action="user.update_profile",
        resource_type="user",
        resource_id=db_user.id,
        actor=current_user,
        details={"changes": changes} if changes else {"fields": []},
    )
    session.commit()
    session.refresh(db_user)

    return build_user_payload(db_user.id, session)


@router.delete("/me")
def delete_user_account(
    background_tasks: BackgroundTasks,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_password_changed),
):
    add_audit_log(
        session,
        action="user.delete_account",
        resource_type="user",
        resource_id=current_user.id,
        actor=current_user,
    )

    user_email = current_user.email
    full_name = f"{current_user.first_name} {current_user.last_name}"

    current_user.deleted_at = datetime.now(timezone.utc)
    session.add(current_user)
    session.commit()

    email_html = get_account_deleted_template(full_name)
    email_text = get_account_deleted_template_text(full_name)
    dispatch_email(background_tasks, user_email, "Your account has been deleted", email_html, email_text)

    return {"message": "Account deleted successfully"}