import os
import cloudinary
import cloudinary.uploader
from dotenv import load_dotenv
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from slugify import slugify
from sqlmodel import Session, select
from sqlalchemy import or_
from sqlalchemy.orm import selectinload
from typing import List, Optional
from app.dbConfig import get_session
from app.models import Post, Tag, User, Comment, UserRole
from app.schemas.schemas import PostRead, PostCreate, PostUpdate
from app.utils.auth import admin_only, get_current_user_optional

load_dotenv()

cloudinary.config(
  cloud_name = os.getenv("CLOUDINARY_NAME"),
  api_key = os.getenv("CLOUDINARY_API_KEY"),
  api_secret = os.getenv("CLOUDINARY_API_SECRET")
)

router = APIRouter(prefix="/posts", tags=["posts"])

# --- UPLOAD IMAGE ROUTE ---
@router.post("/upload-image")
def upload_post_image(
    file: UploadFile = File(...), 
    current_admin: User = Depends(admin_only)
):
    # Verify the file is an image
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Invalid file type")
    
    # Upload to Cloudinary
    result = cloudinary.uploader.upload(file.file, folder="blog_images")
    
    # SimpleMDE expects a JSON response with the 'url' key
    return {"url": result.get("secure_url")}

# --- CREATE POST ROUTE ---
@router.post("/", response_model=PostRead)
def create_post(post_data: PostCreate, session: Session = Depends(get_session), current_admin: User =Depends(admin_only)):
    new_post = Post(**post_data.model_dump(exclude={"tag_ids", "slug"}))
    new_post.author_id = current_admin.id

    # Generate unique slug
    # If the user provided a custom slug, slugify it. Otherwise, use title.
    source_for_slug = post_data.slug if post_data.slug else post_data.title
    new_post.slug = Post.generate_unique_slug(source_for_slug, session)

    if post_data.tag_ids and len(post_data.tag_ids) > 0:
        statement = select(Tag).where(Tag.id.in_(post_data.tag_ids))
        new_post.tags = session.exec(statement).all()
    else:
        new_post.tags = []

    session.add(new_post)
    session.commit()
    session.refresh(new_post)
    return new_post

# --- READ POSTS ROUTE ---
@router.get("/", response_model=List[PostRead])
def read_posts(
    session: Session = Depends(get_session), 
    current_user: Optional[User] = Depends(get_current_user_optional),
    filter: Optional[str] = None
):
    query = select(Post).options(
        selectinload(Post.tags),
        selectinload(Post.author)
    )

    # Filter: Guests see only published; Admins see all
    if not current_user or current_user.role != UserRole.ADMIN:
        query = query.where(Post.published == True)

    # Server-side filter for projects: /posts/?filter=projects
    if filter and filter.lower() == 'projects':
        query = query.where(Post.is_project == True)
        
    posts = session.exec(query).all()
    return posts

# --- SEARCH POSTS ROUTE ---
@router.get("/search", response_model=List[PostRead])
def search_posts(
    q: Optional[str] = None, 
    tag: Optional[str] = None, 
    session: Session = Depends(get_session)
):
    # Start with a base query
    statement = select(Post).where(Post.published == True)

    # 1. Filter by Keyword (Title or Content)
    if q:
        statement = statement.where(
            or_(
                Post.title.contains(q),
                Post.content.contains(q)
            )
        )

    # 2. Filter by Tag Name
    if tag:
        statement = statement.join(Post.tags).where(Tag.name == tag)

    statement = statement.options(selectinload(Post.author))
    results = session.exec(statement).all()
    return results

# --- UPDATE POST ROUTE ---
@router.patch("/{post_id}", response_model=PostRead)
def update_post(
    post_id: int, 
    post_data: PostUpdate, 
    session: Session = Depends(get_session), 
    current_admin: User = Depends(admin_only)
):
    # Fetch the existing record
    db_post = session.get(Post, post_id)
    if not db_post:
        raise HTTPException(status_code=404, detail="Post not found")

    # Extract only the fields provided by the client
    update_dict = post_data.model_dump(exclude_unset=True, exclude={"tag_ids"})

    # Handle Slug Logic: Only re-generate if the slug or title is being changed
    if "slug" in update_dict and update_dict["slug"] != db_post.slug:
        # User provided a specific new slug
        update_dict["slug"] = Post.generate_unique_slug(update_dict["slug"], session)
    elif "title" in update_dict and "slug" not in update_dict:
        # Title changed but no slug provided? Usually, we keep the OLD slug 
        # for SEO stability, but if you want it to update, uncomment below:
        # update_dict["slug"] = Post.generate_unique_slug(update_dict["title"], session)
        pass

    # Apply updates to the DB object
    for key, value in update_dict.items():
        setattr(db_post, key, value)

    # Handle Relationships (Tags) separately
    # We check if tag_ids was actually in the request (even if it's an empty list)
    if post_data.tag_ids is not None:
        if len(post_data.tag_ids) > 0:
            statement = select(Tag).where(Tag.id.in_(post_data.tag_ids))
            db_tags = session.exec(statement).all()
            db_post.tags = db_tags
        else:
            db_post.tags = []

    # Save and Return
    session.add(db_post)
    session.commit()
    session.refresh(db_post)
    return db_post

@router.delete("/{post_id}")
def delete_post(post_id: int, session: Session = Depends(get_session), current_admin: User = Depends(admin_only)):
    post = session.get(Post, post_id)
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    session.delete(post)
    session.commit()
    return {"ok": True, "message": "Post deleted successfully"}

# --- READ SINGLE POST ROUTE ---
@router.get("/{post_id}", response_model=PostRead)
def read_post(post_id: int, session: Session = Depends(get_session)):
    statement = (
        select(Post)
        .where(Post.id == post_id)
        .options(
            selectinload(Post.author),
            selectinload(Post.tags),
            selectinload(Post.project_metadata),
            # 1. Load users for top-level comments
            selectinload(Post.comments).selectinload(Comment.user),
            # 2. Load replies and the users who wrote those replies
            selectinload(Post.comments).selectinload(Comment.replies).selectinload(Comment.user)
        )
    )

    result = session.exec(statement)
    post = result.first()

    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    return post

# --- READ POST BY SLUG ROUTE ---
@router.get("/slug/{slug}", response_model=PostRead)
def read_post_by_slug(
    slug: str, 
    session: Session = Depends(get_session),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    statement = (
        select(Post)
        .where(Post.slug == slug)
        .options(
            selectinload(Post.author),
            selectinload(Post.tags),
            selectinload(Post.comments).selectinload(Comment.user)
        )
    )
    post = session.exec(statement).first()

    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    # Initialize view count
    if post.views is None:
        post.views = 0

    # Increment view count
    post.views += 1
    session.add(post)
    session.commit()
    session.refresh(post)

    # Protection: Block non-admins from viewing drafts via direct link
    if not post.published:
        if not current_user or current_user.role != UserRole.ADMIN:
            raise HTTPException(status_code=403, detail="Not authorized to view drafts")

    return post
