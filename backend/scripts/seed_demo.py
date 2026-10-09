"""
Fill a throwaway SQLite database with fictional workspaces, people, posts and
subscriptions, for capturing marketing screenshots of admin-studio.

It refuses to run against anything but SQLite — the real `.env` points at the
shared Supabase instance. Point DATABASE_URL at a scratch file instead:

    DATABASE_URL=sqlite:///C:/path/to/demo.db python scripts/seed_demo.py

Logins it creates (password for both: DemoPass123!):
    platform admin  morgan@example.com
    workspace owner lena@example.com   (Lumen Studio, with a scheduled post)
"""
import os
import random
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

if not os.environ.get("DATABASE_URL", "").startswith("sqlite"):
    sys.exit("Refusing to seed: set DATABASE_URL to a sqlite:/// file. The default .env points at Supabase.")

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlmodel import Session, select  # noqa: E402

from app.core.db import create_db_and_tables, engine  # noqa: E402
from app.core.security import get_password_hash  # noqa: E402
from app.models import (  # noqa: E402
    BillingInterval,
    Blog,
    BlogMember,
    BlogRole,
    BlogSubscription,
    OnboardingStatus,
    OnboardingStep,
    PaymentTransaction,
    PlatformRole,
    Post,
    Tag,
    SubscriptionPlan,
    SubscriptionStatus,
    TeamSize,
    User,
    WorkspaceOwnerRole,
    WorkspaceType,
)
from app.models.post import PostStatus  # noqa: E402
from app.modules.blogs.service import _initialize_blog_settings  # noqa: E402

PASSWORD = "DemoPass123!"
NOW = datetime.now(timezone.utc)
rng = random.Random(7)

# Monthly and yearly prices in naira, matching frontend/site/src/shared/plans.ts.
PRICES = {
    SubscriptionPlan.PRO: {BillingInterval.MONTHLY: 5_000, BillingInterval.YEARLY: 50_000},
    SubscriptionPlan.TEAM: {BillingInterval.MONTHLY: 15_000, BillingInterval.YEARLY: 150_000},
}

# (name, owner first/last, owner role, workspace type, subscription kind, plan, interval)
WORKSPACES = [
    ("Lumen Studio", ("Lena", "Ortiz"), WorkspaceOwnerRole.CONTENT_TEAM, WorkspaceType.COMPANY_BLOG, "paying", SubscriptionPlan.TEAM, BillingInterval.MONTHLY),
    ("Paperplane Agency", ("Tomas", "Reyes"), WorkspaceOwnerRole.AGENCY, WorkspaceType.CLIENT_BLOGS, "paying", SubscriptionPlan.TEAM, BillingInterval.YEARLY),
    ("Orbit Docs", ("Priya", "Nair"), WorkspaceOwnerRole.SAAS_COMPANY, WorkspaceType.DEVELOPER_DOCS, "paying", SubscriptionPlan.PRO, BillingInterval.YEARLY),
    ("Northwind Journal", ("Daniel", "Brooks"), WorkspaceOwnerRole.CONTENT_TEAM, WorkspaceType.COMPANY_BLOG, "paying", SubscriptionPlan.PRO, BillingInterval.MONTHLY),
    ("Signal Labs", ("Amara", "Eze"), WorkspaceOwnerRole.SAAS_COMPANY, WorkspaceType.COMPANY_BLOG, "paying", SubscriptionPlan.TEAM, BillingInterval.MONTHLY),
    ("Copperleaf Studio", ("Hana", "Sato"), WorkspaceOwnerRole.AGENCY, WorkspaceType.CLIENT_BLOGS, "paying", SubscriptionPlan.PRO, BillingInterval.MONTHLY),
    ("Ember Analytics", ("Felix", "Wagner"), WorkspaceOwnerRole.SAAS_COMPANY, WorkspaceType.DEVELOPER_DOCS, "paying", SubscriptionPlan.PRO, BillingInterval.MONTHLY),
    ("Quill & Compass", ("Nora", "Lindqvist"), WorkspaceOwnerRole.BLOGGER, WorkspaceType.PERSONAL_BLOG, "paying", SubscriptionPlan.PRO, BillingInterval.YEARLY),
    ("Fieldnotes", ("Kofi", "Mensah"), WorkspaceOwnerRole.BLOGGER, WorkspaceType.PERSONAL_BLOG, "trialing", SubscriptionPlan.PRO, None),
    ("Brightpath Learning", ("Sofia", "Marino"), WorkspaceOwnerRole.CONTENT_TEAM, WorkspaceType.COMPANY_BLOG, "trialing", SubscriptionPlan.TEAM, None),
    ("Bramble Review", ("Owen", "Fletcher"), WorkspaceOwnerRole.BLOGGER, WorkspaceType.PERSONAL_BLOG, "past_due", SubscriptionPlan.PRO, BillingInterval.MONTHLY),
    ("Tidewater Weekly", ("Leila", "Haddad"), WorkspaceOwnerRole.CONTENT_TEAM, WorkspaceType.COMPANY_BLOG, "canceled", SubscriptionPlan.PRO, BillingInterval.MONTHLY),
    ("Kiln & Co", ("Ruth", "Adeyemi"), WorkspaceOwnerRole.BLOGGER, WorkspaceType.PERSONAL_BLOG, "free", SubscriptionPlan.FREE, None),
    ("Harbor Health Notes", ("Marcus", "Chen"), WorkspaceOwnerRole.CONTENT_TEAM, WorkspaceType.COMPANY_BLOG, "free", SubscriptionPlan.FREE, None),
    ("Meadow Kitchen", ("Isla", "Grant"), WorkspaceOwnerRole.BLOGGER, WorkspaceType.PERSONAL_BLOG, "free", SubscriptionPlan.FREE, None),
    ("Atlas Travel Notes", ("Mateo", "Silva"), WorkspaceOwnerRole.BLOGGER, WorkspaceType.PERSONAL_BLOG, "free", SubscriptionPlan.FREE, None),
]

TEAMMATES = [
    ("Jonah", "Price"), ("Elif", "Kaya"), ("Ravi", "Menon"), ("Clara", "Holt"), ("Yusuf", "Bello"),
    ("Mia", "Novak"), ("Theo", "Laurent"), ("Zara", "Qureshi"), ("Ben", "Okoro"), ("Aiko", "Mori"),
    ("Grace", "Whitfield"), ("Samir", "Haddad"), ("Ines", "Duarte"), ("Luca", "Romano"), ("Ada", "Nwankwo"),
    ("Hugo", "Bauer"), ("Maya", "Patel"), ("Oscar", "Lund"), ("Chloe", "Martin"), ("Ivan", "Petrov"),
    ("Tara", "Quinn"), ("Noah", "Bergman"), ("Esi", "Owusu"), ("Leo", "Fischer"), ("Rosa", "Vidal"),
    ("Kai", "Tanaka"), ("Lily", "Evans"), ("Arjun", "Rao"), ("Freya", "Olsen"), ("Diego", "Torres"),
]

POST_TITLES = [
    "What we learned shipping our first public roadmap",
    "A practical guide to writing release notes people read",
    "Five habits of teams that publish every week",
    "How to structure a style guide your writers will use",
    "Behind the scenes: redesigning our onboarding flow",
    "The editorial calendar template we use every quarter",
    "Why we moved our docs next to our product",
    "Interviewing customers without leading the witness",
    "Notes from a year of remote-first writing",
    "Measuring what matters: our content metrics",
    "Turning support tickets into helpful articles",
    "A short history of our design system",
    "Small experiments that doubled our newsletter sign-ups",
    "How we review drafts without slowing down",
    "Writing for skimmers: headings, lists and summaries",
    "Our checklist before anything goes live",
    "Lessons from migrating ten years of posts",
    "Building a glossary for a growing team",
    "The case for shorter changelogs",
    "Field guide to accessible images and alt text",
]

DEMO_POST_BODY = """## Where we started

Two years ago a release took us three weeks from merged code to a published announcement. Most of that time wasn't engineering — it was waiting: for screenshots, for sign-off, for someone to remember the blog post.

## What we changed

- **One draft per release**, opened the day the work starts, not the day it ships.
- **Scheduled publishing**, so the post goes live with the release instead of whenever someone is online.
- **Editors review in the draft**, with comments next to the paragraph they're about.

## What happened next

Our median release cycle dropped from 21 days to 10, and our announcement posts now land within an hour of the deploy.
"""

DEMO_THUMBNAIL = "https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=1200&q=80"


def _email(first: str, last: str, taken: set[str]) -> str:
    base = first.lower()
    email = f"{base}@example.com"
    if email in taken:
        email = f"{base}.{last.lower()}@example.com"
    taken.add(email)
    return email


def _user(session: Session, first: str, last: str, taken: set[str], created_at: datetime, **extra) -> User:
    email = _email(first, last, taken)
    user = User(
        first_name=first,
        last_name=last,
        username=email.split("@")[0].replace(".", "_"),
        email=email,
        hashed_password=get_password_hash(PASSWORD),
        email_verified=True,
        created_at=created_at,
        last_login=NOW - timedelta(hours=rng.randint(1, 72)),
        **extra,
    )
    session.add(user)
    session.flush()
    return user


def _subscription(blog: Blog, kind: str, plan: SubscriptionPlan, interval) -> tuple[BlogSubscription, list[PaymentTransaction]]:
    sub = BlogSubscription(blog_id=blog.id, plan=plan)
    payments: list[PaymentTransaction] = []
    if kind == "free":
        return sub, payments

    if kind == "trialing":
        sub.status = SubscriptionStatus.TRIALING.value
        sub.trial_used = True
        sub.trial_ends_at = NOW + timedelta(days=rng.randint(3, 11))
        return sub, payments

    period = timedelta(days=365 if interval == BillingInterval.YEARLY else 30)
    started = NOW - timedelta(days=rng.randint(5, 25))
    sub.billing_interval = interval.value
    sub.trial_used = True
    sub.paystack_subscription_code = f"SUB_demo{blog.id:04d}"
    sub.paystack_customer_code = f"CUS_demo{blog.id:04d}"
    sub.current_period_started_at = started
    sub.current_period_ends_at = started + period

    if kind == "past_due":
        sub.status = SubscriptionStatus.PAST_DUE.value
        sub.current_period_started_at = NOW - period - timedelta(days=1)
        sub.current_period_ends_at = NOW - timedelta(days=1)
    elif kind == "canceled":
        sub.status = SubscriptionStatus.CANCELED.value
        sub.cancelled_at = NOW - timedelta(days=3)
    else:
        sub.status = SubscriptionStatus.ACTIVE.value

    # A few past renewals so billing history isn't empty.
    renewals = 1 if interval == BillingInterval.YEARLY else 4
    for n in range(renewals):
        paid_at = sub.current_period_started_at - period * n
        reference = f"demo_{blog.id:04d}_{n}"
        sub.last_payment_reference = sub.last_payment_reference or reference
        payments.append(
            PaymentTransaction(
                blog_id=blog.id,
                reference=reference,
                amount_kobo=PRICES[plan][interval] * 100,
                plan=plan.value,
                billing_interval=interval.value,
                status="success",
                paid_at=paid_at,
                created_at=paid_at,
            )
        )
    return sub, payments


def _posts(session: Session, blog: Blog, authors: list[User], count: int) -> None:
    titles = rng.sample(POST_TITLES, count)
    for title in titles:
        published_at = NOW - timedelta(days=rng.randint(2, 200), hours=rng.randint(0, 23))
        session.add(
            Post(
                title=title,
                slug=Post.generate_unique_slug(title, blog.id, session),
                content=f"## {title}\n\nA short demo post for {blog.name}.",
                author_id=rng.choice(authors).id,
                blog_id=blog.id,
                status=PostStatus.PUBLISHED,
                published=True,
                published_at=published_at,
                created_at=published_at - timedelta(days=1),
                views=int(rng.lognormvariate(5.6, 0.9)),
            )
        )


def _demo_post(session: Session, blog: Blog, author: User) -> Post:
    tags = [Tag(name=name, blog_id=blog.id) for name in ("Engineering", "Product", "Workflow")]
    session.add_all(tags)
    # Next Tuesday at 9:00. SQLite drops the offset, so the editor shows this
    # wall-clock time as-is.
    days_ahead = (1 - NOW.weekday()) % 7 or 7
    publish_at = (NOW + timedelta(days=days_ahead)).replace(hour=9, minute=0, second=0, microsecond=0)
    title = "How we cut our release cycle in half"
    post = Post(
        title=title,
        slug=Post.generate_unique_slug(title, blog.id, session),
        content=DEMO_POST_BODY,
        author_id=author.id,
        blog_id=blog.id,
        thumbnail_url=DEMO_THUMBNAIL,
        status=PostStatus.SCHEDULED,
        published=False,
        published_at=publish_at,
        tags=tags,
    )
    session.add(post)
    return post


def seed() -> None:
    create_db_and_tables()
    with Session(engine) as session:
        if session.exec(select(User).where(User.email == "morgan@example.com")).first():
            sys.exit("This database is already seeded. Delete the file to start over.")

        taken: set[str] = set()
        _user(
            session, "Morgan", "Hale", taken, NOW - timedelta(days=400),
            platform_role=PlatformRole.SUPER_ADMIN, is_super_admin=True,
        )

        teammates = iter(TEAMMATES)
        demo_post = None
        for index, (name, (first, last), owner_role, ws_type, kind, plan, interval) in enumerate(WORKSPACES):
            created_at = NOW - timedelta(days=rng.randint(30, 360))
            owner = _user(session, first, last, taken, created_at)
            slug = Blog.generate_unique_slug(name, session)
            blog = Blog(
                name=name,
                slug=slug,
                subdomain=slug,
                description=f"The {name} blog.",
                owner_id=owner.id,
                onboarding_status=OnboardingStatus.COMPLETED,
                onboarding_step=OnboardingStep.PLAN,
                onboarding_completed_at=created_at,
                owner_role=owner_role,
                workspace_type=ws_type,
                team_size=TeamSize.SMALL if index < 8 else TeamSize.SOLO,
                created_at=created_at,
            )
            session.add(blog)
            session.flush()
            _initialize_blog_settings(session, blog)

            session.add(BlogMember(user_id=owner.id, blog_id=blog.id, role=BlogRole.OWNER, invited_at=created_at))
            authors = [owner]
            team = 3 if index < 3 else (2 if index < 8 else rng.randint(0, 1))
            for role in [BlogRole.EDITOR, BlogRole.AUTHOR, BlogRole.AUTHOR][:team]:
                mate_first, mate_last = next(teammates)
                mate = _user(session, mate_first, mate_last, taken, created_at + timedelta(days=rng.randint(1, 20)))
                session.add(BlogMember(user_id=mate.id, blog_id=blog.id, role=role, invited_at=mate.created_at))
                authors.append(mate)

            sub, payments = _subscription(blog, kind, plan, interval)
            session.add(sub)
            session.add_all(payments)

            _posts(session, blog, authors, rng.randint(14, 20) if index < 8 else rng.randint(4, 12))
            if index == 0:
                demo_post = _demo_post(session, blog, owner)

        session.commit()
        print(f"Seeded {len(WORKSPACES)} workspaces. Scheduled demo post: /admin/w/lumen-studio/posts/edit/{demo_post.id}")


if __name__ == "__main__":
    seed()
