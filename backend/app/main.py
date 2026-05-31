from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.audit_middleware import AuditLogMiddleware
from app.core.db import create_db_and_tables
from app.modules import (
    auth_router,
    blog_comments_router,
    comments_router,
    posts_router,
    settings_router,
    tags_router,
    users_router,
    blogs_router,
    invitations_router,
    superadmin_router,
)

app = FastAPI(title="CMS Backend", version="0.1.0")

origins = [
    "https://blogapp-admin-studio-livid.vercel.app",
    "https://blogapp-blog.vercel.app",
    "http://localhost:8000",
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:5175",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:5174",
    "http://127.0.0.1:5175",
    "http://127.0.0.1:8000"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(AuditLogMiddleware)


@app.on_event("startup")
def on_startup():
    create_db_and_tables()


app.include_router(auth_router)
app.include_router(posts_router)
app.include_router(tags_router)
app.include_router(users_router)
app.include_router(comments_router)
app.include_router(blog_comments_router)
app.include_router(settings_router)
app.include_router(blogs_router)
app.include_router(invitations_router)
app.include_router(superadmin_router)


@app.get("/")
def read_root():
    return {"status": "CMS Backend is running"}
