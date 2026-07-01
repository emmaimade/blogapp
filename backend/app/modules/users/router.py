import random
from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordRequestForm
from sqlmodel import Session, select
from slugify import slugify

from app.core.audit import add_audit_log
from app.core.db import get_session
from app.core.security import get_current_user, get_password_hash
from app.models import (
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
    # Keep only letters, numbers, and underscores; convert to lowercase
    base = "".join(c for c in email_prefix if c.isalnum() or c == "_").lower() or "user"
    
    unique_handle = f"{base}{random.randint(1000, 9999)}"
    
    # Loop to double-check that the random handle isn't accidentally taken
    while session.exec(select(User).where(User.username == unique_handle)).first():
        unique_handle = f"{base}{random.randint(1000, 9999)}"
        
    return unique_handle


@router.post("/register", response_model=UserRead)
def register(user_data: UserCreate, session: Session = Depends(get_session)):
    # existing_user = session.exec(select(User).where(User.username == user_data.username)).first()

    existing_email = session.exec(select(User).where(User.email == user_data.email)).first()
    if existing_email:
        raise HTTPException(status_code=400, detail="Email already exists")
    
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
    return build_user_payload(new_user, session)


@router.post("/login")
def login(form_data: OAuth2PasswordRequestForm = Depends(), session: Session = Depends(get_session)):
    user = authenticate_user(form_data.username, form_data.password, session)
    if not user:
        raise HTTPException(status_code=400, detail="Incorrect username or password")

    add_audit_log(
        session,
        action="user.login",
        resource_type="user",
        resource_id=user.id,
        actor=user,
    )
    session.commit()
    return build_login_response(user, session)


@router.get("/me", response_model=UserRead)
async def get_current_user_info(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    return build_user_payload(current_user, session)


@router.patch("/me", response_model=UserRead)
def update_user_profile(
    user_data: UserUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    db_user = current_user
    update_dict = user_data.model_dump(exclude_unset=True)

    if "password" in update_dict:
        new_password = update_dict.pop("password")
        db_user.hashed_password = get_password_hash(new_password)

    for key, value in update_dict.items():
        setattr(db_user, key, value)

    session.add(db_user)
    add_audit_log(
        session,
        action="user.update_profile",
        resource_type="user",
        resource_id=db_user.id,
        actor=current_user,
        details={"fields": sorted(update_dict.keys())},
    )
    session.commit()
    session.refresh(db_user)
    return build_user_payload(db_user, session)


@router.delete("/me")
def delete_user_account(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    add_audit_log(
        session,
        action="user.delete_account",
        resource_type="user",
        resource_id=current_user.id,
        actor=current_user,
    )
    session.delete(current_user)
    session.commit()
    return {"message": "Account deleted successfully"}
