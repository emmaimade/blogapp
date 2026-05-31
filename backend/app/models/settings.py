from datetime import datetime
from typing import Optional

from sqlmodel import Field, Relationship, SQLModel


class SiteSettings(SQLModel, table=True):
    __tablename__ = "site_settings"

    id: Optional[int] = Field(default=None, primary_key=True)
    blog_id: int = Field(foreign_key="blog.id")
    setting_key: str = Field(index=True)
    setting_value: str
    
    blog: "Blog" = Relationship(back_populates="settings")
    
    updated_at: datetime = Field(
        default_factory=datetime.utcnow,
        sa_column_kwargs={"onupdate": datetime.utcnow},
    )

    class Config:
        table_args = (
            {'sqlite_autoincrement': True},
        )


class PlatformSettings(SQLModel, table=True):
    __tablename__ = "platform_settings"

    id: Optional[int] = Field(default=None, primary_key=True)
    setting_key: str = Field(index=True, unique=True)
    setting_value: str
    updated_at: datetime = Field(
        default_factory=datetime.utcnow,
        sa_column_kwargs={"onupdate": datetime.utcnow},
    )

    class Config:
        table_args = (
            {"sqlite_autoincrement": True},
        )
