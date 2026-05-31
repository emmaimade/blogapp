# 🚀 Multi-Tenant Implementation Guide
## For github.com/emmaimade/blogapp

**Repository:** https://github.com/emmaimade/blogapp  
**Last Updated:** April 25, 2026  
**Goal:** Transform single-tenant blog → Multi-tenant SaaS platform

---

## 📋 Quick Overview

**Current State:**
- Single blog CMS
- FastAPI + PostgreSQL + React
- Users share one blog space
- Simple admin/user roles

**Target State:**
- Multi-tenant SaaS platform
- **You** = Super Admin (manage all blogs)
- **Customers** = Blog Owners (own their blogs)
- Each blog isolated (posts, tags, settings)
- Team collaboration (Owner/Editor/Author roles)

**Time Estimate:** 12-15 hours total

---

## 🎯 Implementation Roadmap

```
Phase 1: Database Migration (3 hours)
├─ Replace models.py with multi-tenant version
├─ Create Alembic migration
├─ Run data migration script
└─ Verify database changes

Phase 2: Backend API (4 hours)
├─ Add permissions.py
├─ Update existing routes (posts, tags, settings)
├─ Create new routes (blogs, superadmin)
└─ Register routes in main.py

Phase 3: Frontend (5 hours)
├─ Add BlogContext provider
├─ Update API client with blog_id
├─ Modify components to use blog context
└─ Add blog selector UI

Phase 4: Testing (2 hours)
├─ Test blog isolation
├─ Test team permissions
├─ Test super admin features
└─ End-to-end testing

Phase 5: Deployment (1 hour)
├─ Backup production database
├─ Deploy backend
└─ Deploy frontend
```

---

## 📦 Step-by-Step Implementation

### Phase 1: Database Migration

#### Step 1.1: Backup Everything

```bash
# Navigate to your project
cd /path/to/blogapp

# Create backup branch
git checkout -b feature/multi-tenant-migration
git push -u origin feature/multi-tenant-migration

# Backup database
cd backend

# If using PostgreSQL:
pg_dump your_database > backup_$(date +%Y%m%d).sql

# If using SQLite:
cp blog.db blog_backup_$(date +%Y%m%d).db
```

#### Step 1.2: Replace Models and Schemas

```bash
# You'll receive these files (already created):
# - models_multitenant.py
# - schemas_multitenant.py
# - permissions.py
# - migrate_to_multitenant.py

# In backend/app/
cd backend/app

# Backup current files
cp models.py models_backup.py
cp schemas.py schemas_backup.py

# Replace with multi-tenant versions
# Copy from provided files:
cp /path/to/models_multitenant.py models.py
cp /path/to/schemas_multitenant.py schemas.py
cp /path/to/permissions.py permissions.py
```

**Key Changes in models.py:**

```python
# NEW ENUMS
class PlatformRole(str, Enum):
    SUPER_ADMIN = "super_admin"  # You
    USER = "user"                # Customers

class BlogRole(str, Enum):
    OWNER = "owner"       # Blog creator
    EDITOR = "editor"     # Can manage all posts
    AUTHOR = "author"     # Can manage own posts

# NEW TABLES
class Blog(SQLModel, table=True):
    """Each customer gets their own blog"""
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    slug: str = Field(unique=True, index=True)
    subdomain: str = Field(unique=True)
    owner_id: int = Field(foreign_key="user.id")
    # ... more fields

class BlogMember(SQLModel, table=True):
    """Links users to blogs with specific roles"""
    user_id: int = Field(foreign_key="user.id")
    blog_id: int = Field(foreign_key="blog.id")
    role: BlogRole = Field(default=BlogRole.AUTHOR)

# UPDATED MODELS
class User(SQLModel, table=True):
    # NEW FIELDS:
    is_super_admin: bool = Field(default=False)
    platform_role: PlatformRole = Field(default=PlatformRole.USER)
    
    # NEW RELATIONSHIPS:
    owned_blogs: List["Blog"] = Relationship(back_populates="owner")
    blog_memberships: List[BlogMember] = Relationship(...)

class Post(SQLModel, table=True):
    # NEW FIELD:
    blog_id: int = Field(foreign_key="blog.id")  # Posts belong to blogs!
    
    # NEW RELATIONSHIP:
    blog: Blog = Relationship(back_populates="posts")

class Tag(SQLModel, table=True):
    # NEW FIELD:
    blog_id: int = Field(foreign_key="blog.id")  # Tags scoped to blogs
    
class SiteSettings(SQLModel, table=True):
    # NEW FIELD:
    blog_id: int = Field(foreign_key="blog.id")  # Settings per blog
```

#### Step 1.3: Create Alembic Migration

```bash
cd backend

# Generate migration
alembic revision --autogenerate -m "add_multi_tenant_support"

# This creates: alembic/versions/xxxx_add_multi_tenant_support.py
```

**Review the migration file** before applying:

```python
# alembic/versions/xxxx_add_multi_tenant_support.py

def upgrade():
    # 1. Create blogs table
    op.create_table('blog', ...)
    
    # 2. Create blog_members table
    op.create_table('blog_members', ...)
    
    # 3. Add blog_id to existing tables
    op.add_column('post', sa.Column('blog_id', sa.Integer(), nullable=True))
    op.add_column('tag', sa.Column('blog_id', sa.Integer(), nullable=True))
    op.add_column('site_settings', sa.Column('blog_id', sa.Integer(), nullable=True))
    
    # 4. Add super admin fields to users
    op.add_column('user', sa.Column('is_super_admin', sa.Boolean(), default=False))
    op.add_column('user', sa.Column('platform_role', sa.String(), default='user'))

def downgrade():
    # Reverse all changes (for rollback)
    ...
```

#### Step 1.4: Apply Migration

```bash
# Apply database changes
alembic upgrade head

# You should see:
# INFO  [alembic.runtime.migration] Running upgrade ... -> add_multi_tenant_support
```

#### Step 1.5: Run Data Migration

```bash
# Create scripts folder
mkdir -p scripts
cp /path/to/migrate_to_multitenant.py scripts/

# Run migration
python scripts/migrate_to_multitenant.py
```

**What the script does:**

1. ✅ Finds first user, sets as super admin
2. ✅ Creates "My Blog" (default blog)
3. ✅ Links all users to default blog
4. ✅ Assigns all existing posts to default blog
5. ✅ Assigns all existing tags to default blog
6. ✅ Assigns all settings to default blog

**Expected Output:**

```
🚀 MULTI-TENANT MIGRATION SCRIPT
====================================

Have you backed up your database? (yes/no): yes

✅ Super Admin: yourusername (you@email.com)
✅ Created blog: My Blog (ID: 1)
✅ Migrated 15 post(s) to default blog
✅ Migrated 8 tag(s) to default blog

🎉 MIGRATION COMPLETE!
```

---

### Phase 2: Backend API Updates

#### Step 2.1: Update Existing Routes

**File: backend/app/routes/posts.py**

```python
# BEFORE (single-tenant):
@router.get("/posts")
async def get_posts(session: Session = Depends(get_session)):
    posts = session.exec(select(Post)).all()
    return posts

# AFTER (multi-tenant):
from app.permissions import get_current_blog

@router.get("/blogs/{blog_id}/posts")
async def get_posts(
    blog: Blog = Depends(get_current_blog),  # ← Blog access check
    session: Session = Depends(get_session)
):
    # Only return posts for THIS blog
    posts = session.exec(
        select(Post).where(Post.blog_id == blog.id)
    ).all()
    return posts

@router.post("/blogs/{blog_id}/posts")
async def create_post(
    post_data: PostCreate,
    blog: Blog = Depends(get_current_blog),
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    new_post = Post(
        **post_data.dict(),
        blog_id=blog.id,  # ← Assign to current blog
        author_id=current_user.id
    )
    session.add(new_post)
    session.commit()
    return new_post
```

**Apply same pattern to:**
- `backend/app/routes/tags.py` (add blog_id context)
- `backend/app/routes/settings.py` (blog-scoped settings)
- `backend/app/routes/comments.py` (comments via posts)

#### Step 2.2: Create Blog Management Routes

**File: backend/app/routes/blogs.py** (NEW)

```python
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from typing import List

from app.models import Blog, User, BlogMember, BlogRole
from app.schemas import BlogCreate, BlogRead, BlogMemberCreate
from app.database import get_session
from app.auth import get_current_user
from app.permissions import get_current_blog, require_blog_owner

router = APIRouter(prefix="/blogs", tags=["blogs"])


@router.post("", response_model=BlogRead)
async def create_blog(
    blog_data: BlogCreate,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """Create new blog (signup flow)"""
    slug = Blog.generate_unique_slug(blog_data.name, session)
    
    new_blog = Blog(
        name=blog_data.name,
        slug=slug,
        subdomain=f"{slug}.yourblogplatform.com",
        owner_id=current_user.id
    )
    session.add(new_blog)
    session.commit()
    session.refresh(new_blog)
    
    # Add owner as member
    membership = BlogMember(
        user_id=current_user.id,
        blog_id=new_blog.id,
        role=BlogRole.OWNER
    )
    session.add(membership)
    session.commit()
    
    return new_blog


@router.get("/me")
async def get_my_blogs(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """Get all blogs I have access to"""
    memberships = session.exec(
        select(BlogMember).where(BlogMember.user_id == current_user.id)
    ).all()
    
    blog_ids = [m.blog_id for m in memberships]
    blogs = session.exec(
        select(Blog).where(Blog.id.in_(blog_ids))
    ).all()
    
    return blogs


@router.post("/{blog_id}/members")
async def invite_member(
    member_data: BlogMemberCreate,
    blog: Blog = Depends(get_current_blog),
    _: None = Depends(require_blog_owner),
    session: Session = Depends(get_session)
):
    """Invite team member (owner only)"""
    # Find user by email
    user = session.exec(
        select(User).where(User.email == member_data.email)
    ).first()
    
    if not user:
        raise HTTPException(404, "User not found")
    
    # Create membership
    membership = BlogMember(
        user_id=user.id,
        blog_id=blog.id,
        role=member_data.role
    )
    session.add(membership)
    session.commit()
    
    return {"message": "User invited successfully"}
```

#### Step 2.3: Create Super Admin Routes

**File: backend/app/routes/superadmin.py** (NEW)

```python
from fastapi import APIRouter, Depends
from sqlmodel import Session, select, func

from app.models import Blog, User, Post
from app.schemas import PlatformStats
from app.database import get_session
from app.permissions import require_super_admin

router = APIRouter(
    prefix="/superadmin",
    tags=["superadmin"],
    dependencies=[Depends(require_super_admin)]  # All routes require super admin
)


@router.get("/stats", response_model=PlatformStats)
async def get_platform_stats(session: Session = Depends(get_session)):
    """Platform-wide statistics"""
    
    total_blogs = session.exec(select(func.count(Blog.id))).one()
    total_users = session.exec(select(func.count(User.id))).one()
    total_posts = session.exec(select(func.count(Post.id))).one()
    total_views = session.exec(select(func.sum(Post.views))).one() or 0
    
    return PlatformStats(
        total_blogs=total_blogs,
        total_users=total_users,
        total_posts=total_posts,
        total_views=total_views
    )


@router.get("/blogs")
async def list_all_blogs(session: Session = Depends(get_session)):
    """List all blogs on platform"""
    blogs = session.exec(select(Blog)).all()
    return blogs


@router.patch("/blogs/{blog_id}/deactivate")
async def deactivate_blog(
    blog_id: int,
    session: Session = Depends(get_session)
):
    """Deactivate blog (abuse/spam)"""
    blog = session.get(Blog, blog_id)
    if not blog:
        raise HTTPException(404, "Blog not found")
    
    blog.is_active = False
    session.add(blog)
    session.commit()
    
    return {"message": f"Blog '{blog.name}' deactivated"}
```

#### Step 2.4: Register Routes

**File: backend/app/main.py**

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Import new routers
from app.routes import (
    auth,
    posts,
    admin,
    settings,
    blogs,      # ← NEW
    superadmin  # ← NEW
)

app = FastAPI(
    title="Blog CMS API",
    version="2.0.0"  # ← Version bump
)

# ... CORS setup ...

# Register routes
app.include_router(auth.router)
app.include_router(posts.router)
app.include_router(admin.router)
app.include_router(settings.router)
app.include_router(blogs.router)      # ← NEW
app.include_router(superadmin.router)  # ← NEW
```

---

### Phase 3: Frontend Updates

#### Step 3.1: Add Blog Context

**File: frontend/admin-studio/src/context/BlogContext.tsx** (NEW)

```typescript
import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import api from '../api/client';

interface Blog {
  id: number;
  name: string;
  slug: string;
  subdomain: string;
}

interface BlogContextType {
  currentBlog: Blog | null;
  blogs: Blog[];
  setCurrentBlog: (blog: Blog) => void;
  isLoading: boolean;
}

const BlogContext = createContext<BlogContextType | undefined>(undefined);

export const BlogProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [currentBlog, setCurrentBlog] = useState<Blog | null>(null);
  const [blogs, setBlogs] = useState<Blog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchBlogs();
    }
  }, [user]);

  const fetchBlogs = async () => {
    try {
      const response = await api.get('/blogs/me');
      setBlogs(response.data);
      
      // Auto-select first blog
      if (response.data.length > 0) {
        setCurrentBlog(response.data[0]);
        localStorage.setItem('currentBlogId', response.data[0].id);
      }
    } catch (error) {
      console.error('Failed to fetch blogs:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <BlogContext.Provider value={{ currentBlog, blogs, setCurrentBlog, isLoading }}>
      {children}
    </BlogContext.Provider>
  );
};

export const useBlog = () => {
  const context = useContext(BlogContext);
  if (!context) {
    throw new Error('useBlog must be used within BlogProvider');
  }
  return context;
};
```

#### Step 3.2: Update API Client

**File: frontend/admin-studio/src/api/client.ts**

```typescript
import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
});

// BEFORE: Old API calls
export const getPosts = async () => {
  const { data } = await api.get('/posts');
  return data;
};

// AFTER: Blog-scoped API calls
export const getPosts = async (blogId: number) => {
  const { data } = await api.get(`/blogs/${blogId}/posts`);
  return data;
};

export const createPost = async (blogId: number, postData: any) => {
  const { data } = await api.post(`/blogs/${blogId}/posts`, postData);
  return data;
};

export const getTags = async (blogId: number) => {
  const { data } = await api.get(`/blogs/${blogId}/tags`);
  return data;
};

// NEW: Blog management
export const getMyBlogs = async () => {
  const { data } = await api.get('/blogs/me');
  return data;
};

export const createBlog = async (blogData: any) => {
  const { data } = await api.post('/blogs', blogData);
  return data;
};

// NEW: Super admin
export const getPlatformStats = async () => {
  const { data } = await api.get('/superadmin/stats');
  return data;
};

export default api;
```

#### Step 3.3: Update Components

**File: frontend/admin-studio/src/pages/admin/Dashboard.tsx**

```typescript
import { useBlog } from '../../context/BlogContext';

export const Dashboard = () => {
  const { currentBlog } = useBlog();  // ← Get current blog
  
  // Fetch stats for current blog only
  const { data, isLoading } = useQuery({
    queryKey: ['adminStats', currentBlog?.id],
    queryFn: () => fetchStats(currentBlog!.id),
    enabled: !!currentBlog  // Only fetch when blog is selected
  });
  
  if (!currentBlog) {
    return <div>Please select a blog</div>;
  }
  
  // Rest of component...
};
```

**Apply same pattern to:**
- `PostList.tsx` - Pass `currentBlog.id` to API calls
- `TagManager.tsx` - Blog-scoped tags
- `Settings pages` - Blog-scoped settings

#### Step 3.4: Wrap App with Providers

**File: frontend/admin-studio/src/main.tsx**

```typescript
import { AuthProvider } from './context/AuthContext';
import { BlogProvider } from './context/BlogContext';  // ← NEW

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <BlogProvider>  {/* ← NEW: Wrap with BlogProvider */}
            <App />
          </BlogProvider>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
);
```

---

## ✅ Testing Checklist

### Backend Tests:

```bash
cd backend

# 1. Start server
uv run uvicorn app.main:app --reload

# 2. Test endpoints (replace TOKEN with your JWT)
# Get my blogs
curl -H "Authorization: Bearer TOKEN" \
  http://localhost:8000/blogs/me

# Get blog posts
curl -H "Authorization: Bearer TOKEN" \
  http://localhost:8000/blogs/1/posts

# Super admin stats
curl -H "Authorization: Bearer SUPER_ADMIN_TOKEN" \
  http://localhost:8000/superadmin/stats
```

### Frontend Tests:

1. **Login** ✅ Should work as before
2. **Dashboard** ✅ Shows blog-scoped stats
3. **Posts** ✅ Shows only current blog's posts
4. **Create Post** ✅ Posts go to current blog
5. **Tags** ✅ Tags scoped to current blog
6. **Settings** ✅ Settings scoped to current blog
7. **Blog Isolation** ✅ Can't see other blogs' data

### Super Admin Tests:

1. **Platform Stats** ✅ View all blogs count
2. **All Blogs List** ✅ See all blogs
3. **Deactivate Blog** ✅ Disable abusive blogs

---

## 🚀 Deployment

### Production Checklist:

```bash
# 1. Backup production database
pg_dump production_db > backup_$(date +%Y%m%d).sql

# 2. Set environment variables
export DATABASE_URL="postgresql://..."
export SUPER_ADMIN_EMAIL="you@example.com"

# 3. Deploy backend
cd backend
git pull origin main
alembic upgrade head
python scripts/migrate_to_multitenant.py

# 4. Restart backend service
# (Railway/Render will auto-restart)

# 5. Deploy frontend
cd frontend/admin-studio
npm run build
# Deploy to Vercel/Netlify
```

---

## 🆘 Troubleshooting

### Issue: Migration fails

**Solution:**
```bash
# Rollback
alembic downgrade -1

# Check migration file
# Fix issues
# Re-run
alembic upgrade head
```

### Issue: "Blog not found" in API

**Solution:** Ensure:
1. User is logged in
2. User has access to blog (check blog_members table)
3. Blog ID is correct in API call

### Issue: Frontend shows empty blog list

**Solution:**
1. Check BlogProvider is wrapping App
2. Verify `/blogs/me` endpoint returns data
3. Check browser console for errors

---

## 📊 Summary

**Files Modified:**
- ✅ `backend/app/models.py` - Multi-tenant models
- ✅ `backend/app/schemas.py` - Multi-tenant schemas  
- ✅ `backend/app/routes/*.py` - Blog-scoped routes
- ✅ `backend/app/main.py` - Register new routes
- ✅ `frontend/admin-studio/src/api/client.ts` - Blog-scoped API
- ✅ `frontend/admin-studio/src/context/BlogContext.tsx` - NEW
- ✅ `frontend/admin-studio/src/main.tsx` - Add BlogProvider

**Files Created:**
- ✅ `backend/app/permissions.py` - Permission system
- ✅ `backend/app/routes/blogs.py` - Blog management
- ✅ `backend/app/routes/superadmin.py` - Super admin
- ✅ `backend/scripts/migrate_to_multitenant.py` - Data migration

**Result:**
- 🎉 Multi-tenant SaaS platform
- 🎉 You = Super Admin (see all blogs)
- 🎉 Customers = Blog Owners
- 🎉 Team collaboration support
- 🎉 Complete blog isolation
- 🎉 Ready for monetization

**Time Investment:** 12-15 hours
**ROI:** Unlimited scalability, SaaS business model

---

**Questions?** Review the detailed migration guide and example files!
