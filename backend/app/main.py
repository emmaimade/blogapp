from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.dbConfig import create_db_and_tables
from app.routes import posts, tags, users, comments, admin, settings

app = FastAPI(title="CMS Backend", version="0.1.0")

# Define allowed origins
# For development, you can use ["*"] to allow everything, 
# but listing specific URLs is safer.
origins = [
    "http://localhost:3000",    # Standard React port
    "http://localhost:5173",    # Vite (modern React) port
    "http://localhost:5174",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:5174",
]

# 3. Add the middleware to the app
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,            # Allows specific origins
    allow_credentials=True,           # Allows cookies/auth headers
    allow_methods=["*"],              # Allows all methods (GET, POST, PUT, DELETE, etc.)
    allow_headers=["*"],              # Allows all headers (including your JWT 'Authorization' header)
)

@app.on_event("startup")
def on_startup():
    create_db_and_tables()

# Include routers
app.include_router(posts.router)
app.include_router(tags.router)
app.include_router(users.router)
app.include_router(comments.router)
app.include_router(admin.router)
app.include_router(settings.router)

@app.get("/")
def read_root():
    return {"status": "CMS Backend is running"}
