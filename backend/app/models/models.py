from typing import List, Optional
from slugify import slugify
from sqlmodel import Session, select, Field, SQLModel, Relationship
from datetime import datetime
from enum import Enum

class UserRole(str, Enum):
    ADMIN = "admin"
    USER = "user"

class PostTagLink(SQLModel, table=True):
    post_id: Optional[int] = Field(default=None, foreign_key="post.id", primary_key=True)
    tag_id: Optional[int] = Field(default=None, foreign_key="tag.id", primary_key=True)

class User(SQLModel, table=True):
    id : Optional[int] = Field(default=None, primary_key=True)
    username : str = Field(index=True, unique=True)
    email : str = Field(index=True, unique=True)
    hashed_password : str
    role: UserRole = Field(default=UserRole.USER)
    created_at: datetime = Field(default_factory=datetime.utcnow)

class Tag(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(unique=True, index=True)

    # Relationship to Post through PostTagLink
    posts: List["Post"] = Relationship(back_populates="tags", link_model=PostTagLink)

class ProjectMetadata(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    repo_url: Optional[str] = None
    live_url: Optional[str] = None

    post_id: int = Field(foreign_key="post.id")
    post: "Post" = Relationship(back_populates="project_metadata")

class Post(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    title: str
    slug: str = Field(unique=True, index=True)
    content: str
    thumbnail_url: Optional[str] = Field(default=None)
    is_project: bool = Field(default=False)
    published: bool = Field(default=True)

    # Relationship to Comment
    comments: List["Comment"] = Relationship(back_populates="post")

    # Relationship to Tag through PostTagLink
    tags: List[Tag] = Relationship(back_populates="posts", link_model=PostTagLink)

    # One-to-one relationship with ProjectMetadata
    project_metadata: Optional[ProjectMetadata] = Relationship(back_populates="post")

    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(
        default_factory=datetime.utcnow, 
        sa_column_kwargs={"onupdate": datetime.utcnow}
    )

    @staticmethod
    def generate_unique_slug(title: str, session: Session) -> str:
        """Generates a unique, URL-friendly slug from a title."""
        base_slug = slugify(title)
        unique_slug = base_slug
        counter = 1
        
        # Check if slug exists, if so, append a counter
        while session.exec(select(Post).where(Post.slug == unique_slug)).first():
            unique_slug = f"{base_slug}-{counter}"
            counter += 1
            
        return unique_slug


class Comment(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    content: str
    is_deleted: bool = Field(default=False)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(
        default_factory=datetime.utcnow, 
        sa_column_kwargs={"onupdate": datetime.utcnow}
    )

    # link to Post
    post_id: int = Field(foreign_key="post.id")
    post: Post = Relationship(back_populates="comments")

    # link to the User (Author)
    user_id: int = Field(foreign_key="user.id")
    user: User = Relationship()

    # Self-referential relationship for nested comments
    parent_id: Optional[int] = Field(default=None, foreign_key="comment.id")
    replies: List["Comment"] = Relationship(
        sa_relationship_kwargs={
            "remote_side": "Comment.id",
            "lazy": "selectin",  # Efficient loading strategy
            "join_depth": 3  # Load up to 3 levels deep automatically
        }
    )