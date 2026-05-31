"""
Data Migration Script: Single-Tenant → Multi-Tenant
====================================================

This script migrates your existing single-tenant blog data to the new
multi-tenant SaaS architecture.

What it does:
1. Creates a default blog for existing content
2. Sets first user as super admin
3. Links all existing posts/tags to the default blog
4. Creates blog memberships for all users
5. Updates site settings to be blog-scoped

Usage:
    python scripts/migrate_to_multitenant.py

IMPORTANT: Backup your database before running!
"""

import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlmodel import Session, select, create_engine
from app.models import (
    User, Blog, BlogMember, Post, Tag, SiteSettings,
    PlatformRole, BlogRole
)
from datetime import datetime
import os

# Database connection
from app.core.config import DATABASE_URL
engine = create_engine(DATABASE_URL, echo=True)


def migrate_to_multitenant():
    """Main migration function"""
    
    print("\n" + "="*60)
    print("🚀 MULTI-TENANT MIGRATION SCRIPT")
    print("="*60 + "\n")
    
    with Session(engine) as session:
        
        # Step 1: Check if migration already ran
        print("📋 Step 1: Checking migration status...")
        existing_blogs = session.exec(select(Blog)).all()
        
        if existing_blogs:
            print("⚠️  WARNING: Blogs already exist in database!")
            print(f"   Found {len(existing_blogs)} blog(s)")
            response = input("\n   Continue anyway? This might create duplicates. (yes/no): ")
            if response.lower() != "yes":
                print("❌ Migration cancelled.")
                return
        
        # Step 2: Get all existing users
        print("\n📋 Step 2: Loading existing users...")
        users = session.exec(select(User)).all()
        
        if not users:
            print("❌ No users found! Create at least one user first.")
            return
        
        print(f"✅ Found {len(users)} user(s)")
        
        # Step 3: Set first user as super admin
        print("\n📋 Step 3: Setting super admin...")
        first_user = users[0]
        first_user.is_super_admin = True
        first_user.platform_role = PlatformRole.SUPER_ADMIN
        session.add(first_user)
        
        print(f"✅ Super Admin: {first_user.username} ({first_user.email})")
        
        # Step 4: Create default blog
        print("\n📋 Step 4: Creating default blog...")
        
        default_blog = Blog(
            name="My Blog",  # User can change this later
            slug="default",
            subdomain="default.yourblogplatform.com",
            description="Default blog migrated from single-tenant setup",
            owner_id=first_user.id,
            is_active=True
        )
        session.add(default_blog)
        session.commit()
        session.refresh(default_blog)
        
        print(f"✅ Created blog: {default_blog.name} (ID: {default_blog.id})")
        
        # Step 5: Link all users to default blog as members
        print("\n📋 Step 5: Creating blog memberships...")
        
        for i, user in enumerate(users):
            # First user is owner, others are authors
            role = BlogRole.OWNER if i == 0 else BlogRole.AUTHOR
            
            membership = BlogMember(
                user_id=user.id,
                blog_id=default_blog.id,
                role=role,
                invited_at=datetime.utcnow()
            )
            session.add(membership)
            
            print(f"   - {user.username}: {role.value}")
        
        session.commit()
        print("✅ All users linked to default blog")
        
        # Step 6: Migrate posts to default blog
        print("\n📋 Step 6: Migrating posts...")
        posts = session.exec(select(Post)).all()
        
        if posts:
            for post in posts:
                post.blog_id = default_blog.id
                session.add(post)
            
            session.commit()
            print(f"✅ Migrated {len(posts)} post(s) to default blog")
        else:
            print("ℹ️  No posts to migrate")
        
        # Step 7: Migrate tags to default blog
        print("\n📋 Step 7: Migrating tags...")
        tags = session.exec(select(Tag)).all()
        
        if tags:
            for tag in tags:
                tag.blog_id = default_blog.id
                session.add(tag)
            
            session.commit()
            print(f"✅ Migrated {len(tags)} tag(s) to default blog")
        else:
            print("ℹ️  No tags to migrate")
        
        # Step 8: Migrate site settings to default blog
        print("\n📋 Step 8: Migrating site settings...")
        settings = session.exec(select(SiteSettings)).all()
        
        if settings:
            for setting in settings:
                setting.blog_id = default_blog.id
                session.add(setting)
            
            session.commit()
            print(f"✅ Migrated {len(settings)} setting(s) to default blog")
        else:
            print("ℹ️  No settings to migrate")
        
        # Step 9: Summary
        print("\n" + "="*60)
        print("🎉 MIGRATION COMPLETE!")
        print("="*60)
        print(f"\n✅ Super Admin: {first_user.username} ({first_user.email})")
        print(f"✅ Default Blog: {default_blog.name}")
        print(f"✅ Blog Members: {len(users)}")
        print(f"✅ Posts: {len(posts) if posts else 0}")
        print(f"✅ Tags: {len(tags) if tags else 0}")
        print(f"✅ Settings: {len(settings) if settings else 0}")
        
        print("\n" + "="*60)
        print("📝 NEXT STEPS:")
        print("="*60)
        print("\n1. Login as super admin:")
        print(f"   Email: {first_user.email}")
        print(f"   You can now access: /superadmin")
        
        print("\n2. Update blog details:")
        print("   Go to Admin → Settings → General")
        print("   Change 'My Blog' to your actual blog name")
        
        print("\n3. Test multi-tenant features:")
        print("   - Try creating a new blog")
        print("   - Invite team members")
        print("   - Verify blog isolation")
        
        print("\n4. Deploy with subdomain routing")
        print("   Configure Nginx/Caddy for subdomain support")
        
        print("\n" + "="*60 + "\n")


if __name__ == "__main__":
    try:
        # Confirm before running
        print("\n⚠️  WARNING: This script will modify your database!")
        print("   Make sure you have a backup before proceeding.\n")
        
        response = input("Have you backed up your database? (yes/no): ")
        
        if response.lower() != "yes":
            print("\n❌ Please backup your database first:")
            print("   cp blog.db blog_backup.db\n")
            sys.exit(1)
        
        # Run migration
        migrate_to_multitenant()
        
    except Exception as e:
        print(f"\n❌ ERROR: {str(e)}")
        print("\nMigration failed! Your database should be unchanged.")
        print("If you see errors, restore from backup:")
        print("   cp blog_backup.db blog.db\n")
        sys.exit(1)
