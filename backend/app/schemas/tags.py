from typing import Annotated, Optional

from pydantic import BaseModel, StringConstraints

# Surrounding whitespace is never meaningful in a tag, and a blank name isn't a tag.
TagName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]


class TagCreate(BaseModel):
    name: TagName


class TagRead(BaseModel):
    id: int
    name: str
    blog_id: int

    class Config:
        from_attributes = True


class PopularTagRead(TagRead):
    count: int


class TagUsageRead(TagRead):
    """A tag with how many posts use it, drafts included (studio only)."""
    post_count: int


class TagUpdate(BaseModel):
    name: Optional[TagName] = None

    class Config:
        from_attributes = True
