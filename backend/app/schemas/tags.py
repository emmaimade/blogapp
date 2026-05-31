from typing import Optional

from pydantic import BaseModel


class TagCreate(BaseModel):
    name: str


class TagRead(BaseModel):
    id: int
    name: str
    blog_id: int

    class Config:
        from_attributes = True


class PopularTagRead(TagRead):
    count: int


class TagUpdate(BaseModel):
    name: Optional[str] = None

    class Config:
        from_attributes = True
