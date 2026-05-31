# 🚀 Multi-Tenant SaaS Migration Guide

## 📋 Overview

This guide upgrades your single-user blog CMS to a **multi-tenant SaaS platform** where:
- **You** = Super Admin (platform owner, can see all blogs)
- **Customers** = Blog Owners (admins of their individual blogs)
- **Their Team** = Editors/Authors (limited access to specific blogs)

---

## 🗄️ Database Schema Changes

### **Key Additions:**

1. **`blogs` table** - Each customer gets their own blog instance
2. **`blog_members` table** - Links users to blogs with roles
3. **Blog isolation** - Posts, tags, settings all scoped to specific blogs
4. **Super admin flag** - `is_super_admin` on users table
5. **Subscriptions** - Track plans/billing per blog (future)

### **Modified Tables:**

| Table | Change | Why |
|-------|--------|-----|
| `users` | Add `is_super_admin`, `platform_role` | Distinguish super admins from regular users |
| `posts` | Add `blog_id` FK | Posts belong to specific blogs |
| `tags` | Add `blog_id` FK | Tags isolated per blog |
| `site_settings` | Add `blog_id` FK | Settings isolated per blog |
| `comments` | No change | Comments already linked via posts |

---

## 📦 Files Created

### **1. models_multitenant.py** ✅
- Complete SQLModel definitions
- Multi-tenant architecture
- Blog isolation
- Role enums (PlatformRole, BlogRole)

### **2. schemas_multitenant.py** ✅
- Pydantic schemas for API
- Blog CRUD schemas
- Team management schemas
- Super admin analytics schemas

### **3. Migration Script** (creating now...)

---

## 🔄 Migration Steps

### **Step 1: Backup Current Database**

```bash
# Backup your database first!
cp backend/blog.db backend/blog_backup_$(date +%Y%m%d).db
```

### **Step 2: Run Alembic Migration**

```bash
cd backend

# Create migration
alembic revision --autogenerate -m "add_multitenant_support"

# Review migration file in alembic/versions/
# Then apply it:
alembic upgrade head
```

### **Step 3: Data Migration Script**

Run the migration script to:
- Create a default blog for existing data
- Assign existing posts/tags to that blog
- Set first user as super admin
- Link all users to the default blog

```bash
# Run data migration
python scripts/migrate_to_multitenant.py
```

---

## 🏗️ Architecture Changes

### **Before (Single-Tenant):**

```
┌─────────────────────────────┐
│ Your Blog CMS               │
│                             │
│ Users → Posts → Tags        │
│                             │
│ (All shared, single blog)   │
└─────────────────────────────┘
```

### **After (Multi-Tenant):**

```
┌──────────────────────────────────────────────┐
│ YOU (Super Admin)                            │
│ Platform: yourblogplatform.com               │
└──────────────────────────────────────────────┘
           │
           ├─────────────────────────┐
           ▼                         ▼
    ┌─────────────┐          ┌─────────────┐
    │  Blog A     │          │  Blog B     │
    │  john.*.com │          │  mary.*.com │
    └─────────────┘          └─────────────┘
           │                         │
           ▼                         ▼
    Posts, Tags, Settings    Posts, Tags, Settings
    (Isolated)               (Isolated)
```

---

## 🔑 Role Structure

### **Platform Level:**

```python
class PlatformRole(str, Enum):
    SUPER_ADMIN = "super_admin"  # You
    USER = "user"                # Customers
```

### **Blog Level:**

```python
class BlogRole(str, Enum):
    OWNER = "owner"       # Blog creator (full control)
    EDITOR = "editor"     # Manage all posts in blog
    AUTHOR = "author"     # Create/edit own posts only
```

---

## 📊 Permission Matrix

| Action | Super Admin | Blog Owner | Editor | Author |
|--------|-------------|------------|--------|--------|
| **Platform** |
| View all blogs | ✅ | ❌ | ❌ | ❌ |
| Delete any blog | ✅ | ❌ | ❌ | ❌ |
| Platform analytics | ✅ | ❌ | ❌ | ❌ |
| **Blog** |
| Create blog | ✅ | ✅ | ❌ | ❌ |
| Edit blog settings | ✅ | ✅ | ❌ | ❌ |
| Invite team members | ✅ | ✅ | ❌ | ❌ |
| Delete blog | ✅ | ✅ | ❌ | ❌ |
| **Content** |
| View all posts | ✅ | ✅ | ✅ | Own only |
| Create post | ✅ | ✅ | ✅ | ✅ |
| Edit any post | ✅ | ✅ | ✅ | Own only |
| Delete any post | ✅ | ✅ | ✅ | Own only |
| Manage tags | ✅ | ✅ | ✅ | ❌ |
| Moderate comments | ✅ | ✅ | ✅ | Own posts |

---

## 🌐 URL Structure

### **Option 1: Subdomain (Recommended)**

```
Platform admin (you):
https://yourblogplatform.com/superadmin

Customer blogs:
https://john.yourblogplatform.com
https://mary.yourblogplatform.com
https://techblog.yourblogplatform.com

Customer admin panels:
https://john.yourblogplatform.com/admin
https://mary.yourblogplatform.com/admin
```

### **Option 2: Path-based**

```
Platform admin (you):
https://yourblogplatform.com/superadmin

Customer blogs:
https://yourblogplatform.com/john
https://yourblogplatform.com/mary

Customer admin panels:
https://yourblogplatform.com/john/admin
https://yourblogplatform.com/mary/admin
```

---

## 🎨 New API Routes

### **Blog Management:**

```python
# Create blog (after signup)
POST /api/blogs
{
  "name": "John's Tech Blog",
  "slug": "johntech",
  "description": "My awesome blog"
}

# Get user's blogs
GET /api/users/me/blogs

# Get specific blog
GET /api/blogs/{blog_id}

# Update blog
PATCH /api/blogs/{blog_id}

# Delete blog
DELETE /api/blogs/{blog_id}
```

### **Team Management:**

```python
# Invite user to blog
POST /api/blogs/{blog_id}/members
{
  "email": "editor@example.com",
  "role": "editor"
}

# List blog members
GET /api/blogs/{blog_id}/members

# Update member role
PATCH /api/blogs/{blog_id}/members/{member_id}
{
  "role": "author"
}

# Remove member
DELETE /api/blogs/{blog_id}/members/{member_id}
```

### **Blog-Scoped Content:**

```python
# All content now requires blog_id context

# Create post in blog
POST /api/blogs/{blog_id}/posts

# Get blog's posts
GET /api/blogs/{blog_id}/posts

# Get blog's tags
GET /api/blogs/{blog_id}/tags

# Update blog settings
PUT /api/blogs/{blog_id}/settings/branding
```

### **Super Admin Routes:**

```python
# Platform analytics
GET /api/superadmin/stats

# List all blogs
GET /api/superadmin/blogs

# View any blog's details
GET /api/superadmin/blogs/{blog_id}

# Deactivate blog (abuse/spam)
PATCH /api/superadmin/blogs/{blog_id}/deactivate

# Delete blog (permanently)
DELETE /api/superadmin/blogs/{blog_id}
```

---

## 🔐 Middleware/Dependencies

### **Blog Access Control:**

```python
# utils/dependencies.py

async def get_current_blog(
    blog_id: int,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
) -> Blog:
    """Ensure user has access to this blog"""
    
    # Super admin can access any blog
    if current_user.is_super_admin:
        blog = session.get(Blog, blog_id)
        if not blog:
            raise HTTPException(404, "Blog not found")
        return blog
    
    # Check if user is a member of this blog
    membership = session.exec(
        select(BlogMember).where(
            BlogMember.user_id == current_user.id,
            BlogMember.blog_id == blog_id
        )
    ).first()
    
    if not membership:
        raise HTTPException(403, "Not a member of this blog")
    
    blog = session.get(Blog, blog_id)
    return blog

async def require_blog_owner(
    blog: Blog = Depends(get_current_blog),
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """Ensure user is owner of the blog"""
    
    # Super admin can do anything
    if current_user.is_super_admin:
        return
    
    # Check if owner
    membership = session.exec(
        select(BlogMember).where(
            BlogMember.user_id == current_user.id,
            BlogMember.blog_id == blog.id,
            BlogMember.role == BlogRole.OWNER
        )
    ).first()
    
    if not membership:
        raise HTTPException(403, "Must be blog owner")
```

---

## 📝 Updated Route Examples

### **Before (Single-Tenant):**

```python
@router.get("/posts")
async def get_posts(session: Session = Depends(get_session)):
    posts = session.exec(select(Post)).all()
    return posts
```

### **After (Multi-Tenant):**

```python
@router.get("/blogs/{blog_id}/posts")
async def get_posts(
    blog: Blog = Depends(get_current_blog),
    session: Session = Depends(get_session)
):
    # Only get posts for THIS blog
    posts = session.exec(
        select(Post).where(Post.blog_id == blog.id)
    ).all()
    return posts
```

---

## 🎯 User Signup Flow

### **New User Journey:**

```
1. Visit yourblogplatform.com
2. Click "Sign Up"
3. Enter email/password
4. Choose blog name + subdomain
5. Blog created automatically
6. User becomes blog owner
7. Redirect to their admin panel
8. See sample posts (optional)
```

### **Implementation:**

```python
@router.post("/signup", response_model=SetupWizardComplete)
async def signup(
    user_data: SetupWizardStep1,
    blog_data: SetupWizardStep2,
    session: Session = Depends(get_session)
):
    # 1. Create user account
    user = User(
        username=user_data.username,
        email=user_data.email,
        hashed_password=hash_password(user_data.password),
        platform_role=PlatformRole.USER,
        is_super_admin=False
    )
    session.add(user)
    session.commit()
    
    # 2. Create blog
    slug = Blog.generate_unique_slug(blog_data.blog_name, session)
    blog = Blog(
        name=blog_data.blog_name,
        slug=slug,
        subdomain=f"{slug}.yourblogplatform.com",
        owner_id=user.id
    )
    session.add(blog)
    session.commit()
    
    # 3. Add user as blog owner
    membership = BlogMember(
        user_id=user.id,
        blog_id=blog.id,
        role=BlogRole.OWNER
    )
    session.add(membership)
    session.commit()
    
    # 4. Create sample posts (optional)
    seed_sample_posts(blog.id, user.id, session)
    
    # 5. Generate JWT token
    access_token = create_access_token(user.id)
    
    return {
        "user": user,
        "blog": blog,
        "access_token": access_token,
        "token_type": "bearer"
    }
```

---

## 💰 Monetization Support

### **Subscription Plans:**

```python
class SubscriptionPlan(str, Enum):
    FREE = "free"      # 1 blog, basic features
    PRO = "pro"        # Custom domain, no branding
    TEAM = "team"      # Multiple team members
```

### **Plan Limits:**

```python
PLAN_LIMITS = {
    "free": {
        "max_posts": 100,
        "max_team_members": 1,
        "custom_domain": False,
        "remove_branding": False,
    },
    "pro": {
        "max_posts": -1,  # Unlimited
        "max_team_members": 3,
        "custom_domain": True,
        "remove_branding": True,
    },
    "team": {
        "max_posts": -1,
        "max_team_members": 10,
        "custom_domain": True,
        "remove_branding": True,
    }
}
```

---

## ✅ Testing Checklist

### **After Migration:**

- [ ] Existing posts still visible
- [ ] Existing users can login
- [ ] First user is super admin
- [ ] Can create new blog
- [ ] Blog isolation works (can't see other blogs' posts)
- [ ] Team invitations work
- [ ] Role permissions enforce correctly
- [ ] Super admin can see all blogs
- [ ] Settings isolated per blog

---

## 🚀 Deployment Steps

### **1. Update Dependencies**

```bash
pip install alembic slugify
```

### **2. Run Migration**

```bash
# Backup database
cp blog.db blog_backup.db

# Run migration
alembic upgrade head

# Run data migration
python scripts/migrate_to_multitenant.py
```

### **3. Update Frontend**

- Add blog context to all API calls
- Update admin routes to include blog_id
- Add blog selector if user has multiple blogs
- Update settings pages to be blog-scoped

### **4. Environment Variables**

```bash
# .env
PLATFORM_NAME="YourBlogPlatform"
SUPER_ADMIN_EMAIL="you@example.com"
BASE_URL="https://yourblogplatform.com"
ENABLE_SIGNUPS=true
```

---

## 🎉 Result

After migration, you'll have:

✅ Multi-tenant SaaS platform
✅ You as super admin (god mode)
✅ Customers as blog owners
✅ Team collaboration support
✅ Blog isolation (secure)
✅ Scalable architecture
✅ Ready for monetization

---

## 📚 Next Steps

1. **Implement subdomain routing** (Nginx/Caddy config)
2. **Add Stripe integration** for subscriptions
3. **Build super admin dashboard** (platform analytics)
4. **Add email system** (invitations, notifications)
5. **Custom domain support** (DNS configuration)
6. **Usage limits** per plan
7. **Billing management** UI

---

## 🆘 Troubleshooting

### **Migration fails?**
```bash
# Restore backup
cp blog_backup.db blog.db

# Check alembic version
alembic current

# Manually fix migration file if needed
```

### **Can't login after migration?**
- Check if user exists: `SELECT * FROM users;`
- Verify password hash: Check `hashed_password` column
- Reset password via script if needed

### **Posts missing?**
- Check `blog_id` is set: `SELECT * FROM posts WHERE blog_id IS NULL;`
- Run data migration again: `python scripts/migrate_to_multitenant.py`

---

**Ready to migrate? Let's create the migration scripts next!**
