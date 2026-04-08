# Admin Studio - CMS Dashboard

React + TypeScript admin dashboard for managing blog content, users, comments, and site settings.

## Stack

- **Framework**: React 19 with TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **State Management**: TanStack Query (React Query)
- **Forms**: React Hook Form
- **Editor**: EasyMDE (Markdown)
- **HTTP Client**: Axios
- **Routing**: React Router v7

## Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

1. **Install Dependencies**

```bash
cd frontend/admin-studio
npm install
```

2. **Configure Environment**

Create `.env.local` file:

```env
VITE_API_BASE_URL=http://localhost:8000
```

3. **Run Development Server**

```bash
npm run dev
```

Admin panel runs at `http://localhost:5173`

4. **Build for Production**

```bash
npm run build
```

Built files in `dist/`

## Project Structure

```
admin-studio/
├── src/
│   ├── App.tsx              # Main app component
│   ├── main.tsx             # Entry point
│   ├── index.css            # Global styles
│   ├── App.css              # App styles
│   ├── api/
│   │   └── client.ts        # Axios API client configuration
│   ├── components/
│   │   ├── Modal.tsx        # Generic modal component
│   │   ├── ProtectedRoute.tsx   # Auth-protected route wrapper
│   │   └── Sidebar.tsx      # Navigation sidebar
│   ├── context/
│   │   └── AuthContext.tsx  # AuthContext for user state
│   ├── layouts/
│   │   ├── AdminLayout.tsx  # Main admin layout
│   │   └── SettingsLayout.tsx   # Settings page layout
│   ├── types/
│   │   └── index.ts         # TypeScript type definitions
│   └── views/               # Page components
│       ├── Dashboard.tsx
│       ├── PostEditor.tsx
│       ├── PostList.tsx
│       ├── PostView.tsx
│       ├── UserManager.tsx
│       ├── CommentManager.tsx
│       ├── TagManager.tsx
│       ├── GeneralSettings.tsx
│       ├── BrandingSettings.tsx
│       ├── SEOSettings.tsx
│       ├── FooterSettings.tsx
│       ├── AboutPageSettings.tsx
│       ├── ContactSettings.tsx
│       └── LoginView.tsx
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.js
└── README.md                # This file
```

## Features

### Dashboard
- Overview of recent posts, comments, and site stats
- Quick access to key management tools

### Post Management
- **Create/Edit Posts** - Full markdown editor with EasyMDE
- **Post List** - View, search, and manage all posts
- **Post View** - Preview posts before publishing
- Auto-save drafts

### User Management
- List all users
- View user details
- Create/update/delete users
- Role assignment (admin/user)

### Comment Moderation
- View all comments with filters
- Delete spam/inappropriate comments
- Comment status management

### Tag Management
- Create and manage post tags
- View tag usage statistics
- Bulk operations

### Site Settings
- **General Settings** - Site title, description, favicon
- **Branding** - Logo, colors, theme configuration
- **SEO Settings** - Meta tags, robots.txt configuration
- **Footer Content** - Custom footer text and links
- **About Page** - About section content
- **Contact Settings** - Contact form email, phone, address

### Authentication
- JWT-based login
- Protected routes
- Automatic token refresh
- Role-based access control

## Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `VITE_API_BASE_URL` | Backend API URL | `http://localhost:8000` |

## API Integration

All API calls use Axios configured in `src/api/client.ts`:

```typescript
import { apiClient } from './api/client';

// Axios instance with JWT token handling
// Automatically includes Authorization header
// Base URL from VITE_API_BASE_URL
```

## Available Scripts

```bash
# Development server
npm run dev

# Build for production
npm run build

# Type checking
npm run tsc -b

# Linting
npm run lint

# Preview production build
npm run preview
```

## Key Components

### ProtectedRoute
Wraps routes requiring authentication:
```typescript
<ProtectedRoute>
  <AdminLayout>
    <Dashboard />
  </AdminLayout>
</ProtectedRoute>
```

### AuthContext
Manages user authentication state and token:
```typescript
const { user, token, login, logout } = useAuth();
```

### Modal
Reusable modal for confirmations and forms:
```typescript
<Modal isOpen={true} onClose={handleClose}>
  Content here
</Modal>
```

### Sidebar
Navigation with role-based menu items:
```typescript
<Sidebar>
  {/* Auto-populates with navigation links */}
</Sidebar>
```

## Forms

Using React Hook Form for efficient form management:

```typescript
const { register, handleSubmit, formState: { errors } } = useForm();

<form onSubmit={handleSubmit(onSubmit)}>
  <input {...register('title', { required: true })} />
  {errors.title && <span>Title required</span>}
</form>
```

## TanStack Query (React Query)

Data fetching with automatic caching and synchronization:

```typescript
import { useQuery, useMutation } from '@tanstack/react-query';

// Fetch data
const { data: posts } = useQuery({
  queryKey: ['posts'],
  queryFn: () => apiClient.get('/posts')
});

// Mutate data
const { mutate: createPost } = useMutation({
  mutationFn: (data) => apiClient.post('/posts', data),
  onSuccess: () => queryClient.invalidateQueries({ queryKey: ['posts'] })
});
```

## Markdown Editor

EasyMDE integration for post content:

```typescript
import EasyMDEEditor from 'react-simplemde-editor';

<EasyMDEEditor
  value={content}
  onChange={setContent}
  options={{ spellChecker: false }}
/>
```

## Styling

Tailwind CSS for utility-first styling:

```typescript
<div className="flex gap-4 p-4 bg-white rounded-lg shadow">
  <button className="px-4 py-2 bg-blue-500 text-white rounded">
    Button
  </button>
</div>
```

## Type Safety

TypeScript types in `src/types/index.ts`:

```typescript
interface Post {
  id: number;
  title: string;
  content: string;
  author_id: number;
  // ...
}

interface User {
  id: number;
  email: string;
  is_admin: boolean;
  // ...
}
```

## State Management

1. **AuthContext** - Global auth state
2. **TanStack Query** - Server state (posts, users, comments, etc.)
3. **React Hook Form** - Form state
4. **useState** - Component local state

## Common Patterns

### Data Fetching with Error Handling
```typescript
const { data, isLoading, error } = useQuery({
  queryKey: ['posts'],
  queryFn: async () => {
    try {
      const res = await apiClient.get('/posts');
      return res.data;
    } catch (err) {
      toast.error('Failed to load posts');
      throw err;
    }
  }
});
```

### Protected Route
```typescript
function ProtectedView() {
  const { user } = useAuth();
  
  if (!user?.is_admin) {
    return <NotAuthorized />;
  }
  
  return <AdminContent />;
}
```

## Troubleshooting

### Port 5173 already in use
```bash
# Use different port
npm run dev -- --port 5173
```

### API calls fail with CORS error
- Ensure backend runs at `http://localhost:8000`
- Check `VITE_API_BASE_URL` matches backend URL
- Verify backend has frontend URL in CORS origins

### Token expiration
- Tokens expire after set time
- ApiClient should auto-refresh via backend logic
- Manual re-login if refresh fails

### Build fails
```bash
# Clear cache and reinstall
rm -rf node_modules dist
npm install
npm run build
```

### Hot reload not working
- Check Vite config in `vite.config.ts`
- Ensure file changes are detected
- Restart dev server

## Development Workflow

1. **Component Development**
   - Create new component in `src/components/` or `src/views/`
   - Add TypeScript types in `src/types/index.ts`
   - Import and use in layout

2. **Data Fetching**
   - Use `useQuery` for reading data
   - Use `useMutation` for creating/updating/deleting
   - Handle loading and error states

3. **Forms**
   - Use `react-hook-form` for validation
   - Call API via mutation on submit
   - Show success/error toast notifications

4. **Styling**
   - Use Tailwind classes
   - Keep consistent with existing design
   - Use `App.css` for global overrides

## Best Practices

- ✅ Always handle loading and error states
- ✅ Use TypeScript for type safety
- ✅ Keep components small and focused
- ✅ Use custom hooks for shared logic
- ✅ Implement proper error boundaries
- ✅ Cache API responses with React Query
- ✅ Validate forms on both client and server
- ✅ Show user feedback (toasts) for actions

## Deployment

1. **Build**
   ```bash
   npm run build
   ```

2. **Serve dist/ folder**
   - Static hosting (Netlify, Vercel, AWS S3)
   - Or web server (nginx, Apache)

3. **Environment**
   - Set `VITE_API_BASE_URL` to production backend URL
   - Build with production values

## Additional Resources

- [React Documentation](https://react.dev/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Vite Guide](https://vitejs.dev/)
- [Tailwind CSS Docs](https://tailwindcss.com/docs)
- [TanStack Query Docs](https://tanstack.com/query/latest)
- [React Router Documentation](https://reactrouter.com/)
- [React Hook Form Docs](https://react-hook-form.com/)
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
