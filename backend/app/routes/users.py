from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlmodel import Session, select
from sqlalchemy import or_
from app.dbConfig import get_session
from app.models import User
from app.schemas.schemas import UserCreate, UserRead, UserUpdate
from app.utils.auth import get_password_hash, verify_password, create_access_token, get_current_user

router = APIRouter(prefix="/users", tags=["Users"])

@router.post("/register", response_model=UserRead)
def register(user_data: UserCreate, session: Session = Depends(get_session)):
    """
    Registers a new user.
    """
    # Check if user exists
    existing_user = session.exec(select(User).where(User.username == user_data.username)).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="User already exists")
    
    # Hash password
    hashed = get_password_hash(user_data.password)
    new_user = User(**user_data.model_dump(exclude={"password"}), hashed_password=hashed)
    
    # save...
    session.add(new_user)
    session.commit()
    return new_user

@router.post("/login")
def login(form_data: OAuth2PasswordRequestForm = Depends(), session: Session = Depends(get_session)):
    # Allow login with either username or email
    identifier = form_data.username
    user = session.exec(select(User).where(or_(User.username == identifier, User.email == identifier))).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Incorrect username or password")
    
    # Create the token
    access_token = create_access_token(data={"sub": user.username})
    return {"message": "Login successful", "access_token": access_token, "token_type": "bearer", "user": {
            "id": user.id,
            "username": user.username,
            "email": user.email
        }}

@router.get("/me", response_model=UserRead)
async def get_current_user_info(
    current_user: User = Depends(get_current_user)
):
    """Get current logged-in user information"""
    return current_user

@router.patch("/me", response_model=UserRead)
def update_user_profile(
    user_data: UserUpdate, 
    session: Session = Depends(get_session), 
    current_user: User = Depends(get_current_user)
):
    """
    Industry standard profile update. 
    Users can only update their own data based on their token.
    """
    db_user = current_user
    
    # Convert schema to dict, excluding fields the user didn't provide
    update_dict = user_data.model_dump(exclude_unset=True)

    # Industry Standard: If a password is provided, hash it immediately
    if "password" in update_dict:
        new_password = update_dict.pop("password")
        db_user.hashed_password = get_password_hash(new_password)

    # Apply other updates (username, email, etc.)
    for key, value in update_dict.items():
        setattr(db_user, key, value)

    session.add(db_user)
    session.commit()
    session.refresh(db_user)
    return db_user

@router.delete("/me")
def delete_user_account(
    session: Session = Depends(get_session), 
    current_user: User = Depends(get_current_user)
):
    session.delete(current_user)
    session.commit()
    return {"message": "Account deleted successfully"}