# Blog CMS - Monorepo

A full-stack Content Management System built with FastAPI, PostgreSQL, and React. This monorepo contains the backend API, admin panel, and public-facing blog frontend.

## Project Architecture

```
blogapp/
├── backend/          # FastAPI REST API
├── frontend/
│   ├── admin-studio/ # Admin dashboard (React + TypeScript)
│   └── blog/         # Public blog (React + TypeScript)
└── README.md         # This file
```

## Quick Start

### Prerequisites

- **Python 3.10+** (for backend)
- **Node.js 18+** (for frontend)
- **PostgreSQL 12+** (database)
- **uv** (Python package manager) - [Install uv](https://docs.astral.sh/uv/getting-started/installation/)

### Development Setup

#### 1. Clone and Navigate

```bash
git clone <repository-url>
cd blogapp
```

#### 2. Backend Setup

```bash
cd backend
python -m venv .venv
.venv\Scripts\Activate  # On Windows
# or
source .venv/bin/activate  # On macOS/Linux

uv sync  # Install dependencies
```

Set up your `.env` file (see [backend/README.md](backend/README.md) for required variables).

```bash
# Run migrations
alembic upgrade head

# Start the dev server
uv run uvicorn app.main:app --reload
```

API runs at `http://localhost:8000` | Docs at `http://localhost:8000/docs`

#### 3. Admin Studio Setup

```bash
cd frontend/admin-studio
npm install
npm run dev
```

Admin panel runs at `http://localhost:5173`

#### 4. Blog Frontend Setup

```bash
cd frontend/blog
npm install
npm run dev
```

Blog runs at `http://localhost:5174` (or next available port)

## Workspaces

### [Backend](backend/README.md)
FastAPI REST API with PostgreSQL, JWT authentication, and CMS features.

**Key Files:**
- `app/main.py` - FastAPI application setup
- `app/models/` - SQLModel database models
- `app/routes/` - API endpoints
- `app/schemas/` - Pydantic request/response schemas
- `alembic/` - Database migrations

### [Admin Studio](frontend/admin-studio/README.md)
React admin dashboard for managing posts, users, comments, settings, and tags.

**Key Features:**
- Post editor with markdown support
- User management
- Comment moderation
- Site settings configuration

### [Blog Frontend](frontend/blog/README.md)
Public-facing React blog with post listings, search, and comments.

**Key Features:**
- Post browsing and filtering by tags
- Full-text search
- Comments system
- Responsive design

## Tech Stack

| Layer | Technology |
|-------|------------|
| Backend | FastAPI, SQLModel, PostgreSQL, Alembic |
| Frontend | React 19, TypeScript, Tailwind CSS, Vite |
| State Management | TanStack Query (React Query) |
| Forms | React Hook Form |
| UI Components | Lucide React |
| Editor | EasyMDE (Admin), React Markdown (Blog) |

## Core Features

- ✅ User authentication with JWT
- ✅ Role-based access control (admin/user)
- ✅ Blog post management with markdown support
- ✅ Tag-based categorization
- ✅ Comment system
- ✅ Cloudinary image integration
- ✅ SEO settings
- ✅ Site branding and footer management

## Development Workflow

1. **Backend Changes**: Modify files in `backend/app/`, restart dev server
2. **Admin Changes**: Edit files in `frontend/admin-studio/src/`, auto-reload
3. **Blog Changes**: Edit files in `frontend/blog/src/`, auto-reload
4. **Database Changes**: Create migration, run `alembic upgrade head`

## Database Migrations

```bash
cd backend

# Create new migration
alembic revision --autogenerate -m "Description of change"

# Apply migrations
alembic upgrade head

# Rollback
alembic downgrade -1
```

## API Documentation

Once the backend is running, view interactive API docs at:
- **Swagger UI**: `http://localhost:8000/docs`
- **ReDoc**: `http://localhost:8000/redoc`

## Troubleshooting

### Backend won't start
- Check PostgreSQL is running
- Verify `.env` database credentials
- Run `alembic upgrade head`
- Check port 8000 is available

### Frontend build fails
- Delete `node_modules` and reinstall: `npm install`
- Clear Vite cache: delete `dist` folder, rebuild

### CORS errors
- Ensure frontend URL is in `backend/app/main.py` `origins` list
- Default ports: Admin (5173), Blog (5174 or 5175)

## Project Structure Details

See individual README files in each workspace:
- [Backend Documentation](backend/README.md)
- [Admin Studio Documentation](frontend/admin-studio/README.md)
- [Blog Frontend Documentation](frontend/blog/README.md)

## Contributing

When contributing:
1. Follow the workspace-specific guidelines in each folder's README
2. Create feature branch from `main`
3. Ensure code passes linting (`npm run lint` / backend checks)
4. Test changes thoroughly before submitting PR

<!-- ## License

Add your license here. -->
