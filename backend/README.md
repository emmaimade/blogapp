# Backend API - CMS

FastAPI-based REST API for the Blog CMS. Handles authentication, content management, user management, and site configuration.

**Live API**: [https://blogapp-eta-woad.vercel.app](https://blogapp-eta-woad.vercel.app)

## Stack

- **Framework**: FastAPI
- **Database**: PostgreSQL with SQLModel ORM
- **Migrations**: Alembic
- **Authentication**: JWT with bcrypt
- **Image Storage**: Cloudinary
- **Python**: 3.10+

## Quick Start

### Prerequisites

- Python 3.10+
- PostgreSQL 12+
- uv package manager

### Installation

1. **Environment Setup**

```bash
cd backend
python -m venv .venv

# Windows
.venv\Scripts\Activate

# macOS/Linux
source .venv/bin/activate
```

2. **Install Dependencies**

```bash
uv sync
```

3. **Configure Environment**

Create `.env` file in `backend/` directory:

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/blogapp

# JWT
SECRET_KEY=your-super-secret-key-change-this-in-production
ALGORITHM=HS256

# Cloudinary (optional, for image uploads)
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

4. **Database Setup**

```bash
# Apply migrations
alembic upgrade head

# Create admin user (optional)
python scripts/create_admin.py
```

5. **Run Development Server**

```bash
uv run uvicorn app.main:app --reload
```

Server runs locally at `http://localhost:8000`
- API Docs: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

**Production API**:
- Base URL: `https://blogapp-eta-woad.vercel.app`
- API Docs: [https://blogapp-eta-woad.vercel.app/docs](https://blogapp-eta-woad.vercel.app/docs)
- ReDoc: [https://blogapp-eta-woad.vercel.app/redoc](https://blogapp-eta-woad.vercel.app/redoc)

## Project Structure

```
backend/
├── app/
│   ├── main.py              # FastAPI app initialization
│   ├── dbConfig.py          # Database configuration
│   ├── models/
│   │   └── models.py        # SQLModel database models
│   ├── modules/             # Domain routers and feature slices
│   │   ├── admin.py
│   │   ├── comments.py
│   │   ├── posts.py
│   │   ├── settings.py
│   │   ├── tags.py
│   │   └── users.py
│   ├── schemas/
│   │   └── schemas.py       # Pydantic request/response schemas
│   └── core/                # Config, DB, auth/security
│       └── auth.py          # Authentication utilities
├── alembic/                 # Database migrations
├── scripts/                 # Utility scripts
├── pyproject.toml          # Python dependencies
└── README.md               # This file
```

## API Endpoints

### Authentication
- `POST /auth/login` - User login
- `POST /auth/signup` - User registration
- `GET /auth/me` - Current user info

### Posts
- `GET /posts` - List posts
- `GET /posts/{id}` - Get post detail
- `POST /posts` - Create post (admin)
- `PUT /posts/{id}` - Update post (admin)
- `DELETE /posts/{id}` - Delete post (admin)

### Comments
- `GET /posts/{post_id}/comments` - List post comments
- `POST /posts/{post_id}/comments` - Add comment
- `DELETE /comments/{id}` - Delete comment (admin)

### Tags
- `GET /tags` - List all tags
- `POST /tags` - Create tag (admin)
- `DELETE /tags/{id}` - Delete tag (admin)

### Users
- `GET /users` - List users (admin)
- `GET /users/{id}` - Get user detail
- `PUT /users/{id}` - Update user
- `DELETE /users/{id}` - Delete user (admin)

### Settings
- `GET /settings` - Get site settings
- `PUT /settings` - Update settings (admin)

See `http://localhost:8000/docs` for complete API documentation.

## Database Migrations

### Create New Migration

```bash
# Auto-generate migration from model changes
alembic revision --autogenerate -m "Description of changes"

# Or create empty migration
alembic revision -m "Description"
```

### Apply Migrations

```bash
# Upgrade to latest
alembic upgrade head

# Upgrade to specific revision
alembic upgrade <revision_id>

# Upgrade by number of steps
alembic upgrade +2
```

### Rollback Migrations

```bash
# Downgrade one step
alembic downgrade -1

# Downgrade to specific revision
alembic downgrade <revision_id>
```

### View Migration History

```bash
alembic history
alembic current
```

## Key Models

### User
- Email-based authentication
- Bcrypt password hashing
- Admin role flag
- Timestamps

### Post
- Title, content (markdown), excerpt
- Author relationship
- Published status
- SEO fields (slug, meta_description)
- Tags relationship
- Timestamps

### Comment
- Author and post relationship
- Moderation status
- Timestamps

### Tag
- Name and slug
- Post relationship

### SiteSettings
- Global configuration (branding, SEO, contact info)
- Footer content
- About page content

## Authentication

JWT-based authentication with secure password hashing:

1. **Login**: POST `/auth/login` → Returns access token
2. **Request**: Include token in `Authorization: Bearer <token>` header
3. **Validation**: Token verified on protected endpoints

Protected endpoints require valid JWT token.

## Development Tips

### Debug Mode
Set `DEBUG=True` in code for detailed error messages (not recommended for production).

### Hot Reload
Run with `--reload` flag automatically restarts server on file changes:
```bash
uv run uvicorn app.main:app --reload
```

### Test Data
```bash
python scripts/create_admin.py
```

Creates test admin user with email `admin@example.com` and password `admin123`.

## Common Issues

### Connection refused (Database)
- PostgreSQL not running
- Wrong DATABASE_URL in `.env`
- Check: `psql -U user -d blogapp`

### Migration errors
- Ensure `alembic.ini` path points to correct database
- Check for syntax errors in migration files
- Try running `alembic current` to see state

### CORS errors
- Add frontend URL to `origins` list in `app/main.py`
- Default frontend ports: `5173` (admin), `5174-5175` (blog)

### JWT validation fails
- Ensure `SECRET_KEY` is consistent between requests
- Check token expiration
- Verify `ALGORITHM` matches (default: HS256)

## Environment Variables Reference

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | Required | PostgreSQL connection string |
| `SECRET_KEY` | Required | JWT signing secret |
| `ALGORITHM` | `HS256` | JWT algorithm |
| `CLOUDINARY_CLOUD_NAME` | Optional | For image uploads |
| `CLOUDINARY_API_KEY` | Optional | Image upload API key |
| `CLOUDINARY_API_SECRET` | Optional | Image upload API secret |

## Performance

- Database connection pooling via SQLAlchemy
- Query optimization with proper indexing (see migrations)
- CORS middleware configured for specific origins

## Security

- ✅ Passwords hashed with bcrypt
- ✅ JWT for stateless auth
- ✅ CORS restricted to specific origins
- ✅ SQL injection prevention via SQLModel parameterized queries

## Testing

```bash
# Run tests
pytest

# With coverage
pytest --cov=app
```

Test file: `tests/test_posts_endpoints.py`

## Deployment

For production:
1. Set `SECRET_KEY` to a strong random value
2. Use PostgreSQL (not SQLite)
3. Configure proper CORS origins
4. Use environment variables for all secrets
5. Run with Gunicorn: `gunicorn app.main:app -w 4`
6. Set up proper logging and monitoring

## Additional Resources

- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [SQLModel Documentation](https://sqlmodel.tiangolo.com/)
- [Alembic Documentation](https://alembic.sqlalchemy.org/)
- [JWT Best Practices](https://tools.ietf.org/html/rfc8174)
