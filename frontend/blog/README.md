# Blog Frontend - Public Blog

React + TypeScript public-facing blog with post browsing, search, comments, and tag filtering.

## Stack

- **Framework**: React 19 with TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **State Management**: TanStack Query (React Query)
- **Forms**: React Hook Form
- **HTTP Client**: Axios
- **Routing**: React Router v7
- **Markdown**: React Markdown with syntax highlighting
- **UI Components**: Lucide React for icons

## Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

1. **Install Dependencies**

```bash
cd frontend/blog
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

Blog runs at `http://localhost:5174` or next available port.

4. **Build for Production**

```bash
npm run build
```

Built files in `dist/`

## Project Structure

```
blog/
├── src/
│   ├── App.tsx              # Main app component & routing
│   ├── main.tsx             # Entry point
│   ├── index.css            # Global styles
│   ├── App.css              # App styles
│   ├── api/
│   │   └── blogApi.ts       # API client and queries
│   ├── components/
│   │   ├── Navbar.tsx       # Header navigation
│   │   ├── Sidebar.tsx      # Tags and recent posts sidebar
│   │   ├── PostCard.tsx     # Blog post card component
│   │   ├── Comments.tsx     # Comment section for posts
│   │   ├── Footer.tsx       # Page footer
│   │   └── NewsletterPopup.tsx  # Newsletter signup modal
│   ├── hooks/
│   │   └── useSiteSettings.ts   # Custom hook for site settings
│   ├── pages/               # Page components (routes)
│   │   ├── Home.tsx         # Homepage with featured posts
│   │   ├── BlogList.tsx     # All posts with pagination
│   │   ├── PostDetail.tsx   # Single post view
│   │   ├── SearchResults.tsx    # Search results page
│   │   ├── TagPosts.tsx     # Posts filtered by tag
│   │   ├── About.tsx        # About page
│   │   ├── Contact.tsx      # Contact form
│   │   ├── Auth.tsx         # User login/signup
│   │   └── NotFound.tsx     # 404 page
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.js
└── README.md                # This file
```

## Features

### Homepage
- Featured/recent posts
- Call-to-action sections
- Newsletter signup
- Site branding and navigation

### Blog Listing
- All published posts with pagination
- Post preview cards
- Created date, author, reading time
- Category/tag display

### Post Detail
- Full post content with markdown rendering
- Syntax-highlighted code blocks
- Post metadata (author, date, reading time)
- Related/recommended posts
- Comment section below post

### Search
- Full-text search across posts
- Real-time search suggestions
- Search results page with filters
- Search history

### Tag Filtering
- Browse posts by tags
- Tag cloud/list view
- Tag statistics

### Comments
- View comments on posts
- Add new comments (authenticated)
- Nested replies (if implemented)
- Comment moderation by admin

### User Features
- Reader authentication (login/signup)
- User profile
- Saved posts/bookmarks (optional)
- Comment history

### Pages
- **About** - About site/author from admin settings
- **Contact** - Contact form with site contact info
- **Search** - Global search functionality
- **404** - Not found page

## Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `VITE_API_BASE_URL` | Backend API URL | `http://localhost:8000` |

## API Integration

All API calls defined in `src/api/blogApi.ts`:

```typescript
import { apiClient } from './api/blogApi';
import { useQuery } from '@tanstack/react-query';

// Fetch posts
const { data: posts } = useQuery({
  queryKey: ['posts'],
  queryFn: () => apiClient.get('/posts')
});
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

### Navbar
Top navigation with:
- Site logo/branding
- Navigation links
- Search bar
- User menu (if logged in)

### Sidebar
Right sidebar with:
- Popular and recent tags
- Recent posts list
- Categories
- Newsletter signup

### PostCard
Reusable post preview:
- Title and excerpt
- Featured image
- Author and date
- Tags
- Read more link

### Comments
Comment section with:
- All comments display
- Comment form (for authenticated users)
- Reply functionality
- Moderation status

### Footer
Site footer with:
- Copyright
- Links (About, Contact, Privacy)
- Social media links
- Footer content from admin settings

## Pages Explained

### Home
Landing page with featured posts and site info.

```typescript
// Fetch featured/recent posts
// Display hero section
// Show newsletter signup
// Display latest posts
```

### BlogList
Paginated list of all posts.

```typescript
// Fetch posts with pagination
// Display post cards
// Show pagination controls
// Sidebar with filters
```

### PostDetail
Full post view with comments.

```typescript
// Fetch specific post
// Fetch post comments
// Render markdown with syntax highlighting
// Show comment section
// Handle new comments
```

### SearchResults
Search results for query.

```typescript
// Fetch search results
// Display matching posts
// Show search filters (author, date, tag)
// Pagination for results
```

### TagPosts
All posts with specific tag.

```typescript
// Fetch posts filtered by tag
// Display tag info
// Show post list
// Related tags sidebar
```

## Markdown Rendering

Posts use `react-markdown` with plugins:

```typescript
import ReactMarkdown from 'react-markdown';
import { Highlight } from 'rehype-highlight';
import remarkGfm from 'remark-gfm';

<ReactMarkdown
  remarkPlugins={[remarkGfm]}
  rehypePlugins={[Highlight]}
>
  {content}
</ReactMarkdown>
```

Features:
- ✅ GitHub Flavored Markdown
- ✅ Syntax highlighting for code blocks
- ✅ Tables and task lists
- ✅ Footnotes
- ✅ Strikethrough

## Custom Hooks

### useSiteSettings
Fetch global site settings:

```typescript
import { useSiteSettings } from './hooks/useSiteSettings';

const { data: settings, isLoading } = useSiteSettings();

{/* Use settings.branding, settings.seo, etc. */}
```

## TanStack Query Usage

Efficient server state management:

```typescript
// Fetch data
const { data: posts, isLoading } = useQuery({
  queryKey: ['posts', page],
  queryFn: () => apiClient.get('/posts', { params: { page } })
});

// Mutate data (create comment)
const { mutate: addComment } = useMutation({
  mutationFn: (data) => apiClient.post('/comments', data),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['comments'] });
    toast.success('Comment posted!');
  }
});
```

## Routing Structure

```
/                      → Home
/blog                  → Blog listing
/blog/:slug            → Post detail
/search?q=...          → Search results
/tag/:name             → Posts by tag
/about                 → About page
/contact               → Contact page
/auth                  → Login/signup
/404                   → Not found
```

## Styling

Responsive Tailwind CSS design:

```typescript
<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
  <article className="col-span-2">
    {/* Main content */}
  </article>
  <aside className="col-span-1">
    {/* Sidebar */}
  </aside>
</div>
```

Responsive breakpoints:
- Mobile: `sm:` (640px)
- Tablet: `md:` (768px)
- Desktop: `lg:` (1024px)
- Large: `xl:` (1280px)

## SEO Optimization

Each page should:
- ✅ Set page title and meta description
- ✅ Include Open Graph tags
- ✅ Use semantic HTML
- ✅ Optimize heading hierarchy
- ✅ Add schema markup for posts

```typescript
// Use react-helmet or similar for meta tags
<Helmet>
  <title>{post.title}</title>
  <meta name="description" content={post.meta_description} />
  <meta property="og:title" content={post.title} />
</Helmet>
```

## Performance

- ✅ Code splitting per route
- ✅ Image lazy loading
- ✅ Query caching with React Query
- ✅ Optimized build with Vite
- ✅ Markdown syntax highlighting only for visible code blocks

## Accessibility

- ✅ Semantic HTML structure
- ✅ ARIA labels for interactive elements
- ✅ Keyboard navigation support
- ✅ Color contrast compliance
- ✅ Focus management on navigation

## Common Patterns

### Data Fetching with Loading State
```typescript
const { data: posts, isLoading } = useQuery({
  queryKey: ['posts'],
  queryFn: () => apiClient.get('/posts')
});

if (isLoading) return <Skeleton />;
return <PostList posts={data} />;
```

### Form Submission
```typescript
const { handleSubmit, register } = useForm();
const { mutate: submitComment } = useMutation({
  mutationFn: addComment,
  onSuccess: () => queryClient.invalidateQueries()
});

<form onSubmit={handleSubmit((data) => mutate(data))}>
  <input {...register('content')} />
  <button type="submit">Post Comment</button>
</form>
```

## Troubleshooting

### Port 5174 already in use
```bash
# Use different port
npm run dev -- --port 5175
```

### API calls fail
- Check backend is running at `http://localhost:8000`
- Verify `VITE_API_BASE_URL` environment variable
- Check network tab in browser DevTools

### Search not working
- Ensure backend search endpoint exists
- Check API response format matches expectations
- Verify search query is being sent

### Comments not displaying
- Ensure user is authenticated (for posting)
- Check post ID is correctly passed to API
- Verify backend comment endpoint returns data

### Build fails
```bash
# Clear cache
rm -rf node_modules dist
npm install
npm run build
```

## Development Workflow

1. **Create new page in `src/pages/`**
   - Import and add to routing in `App.tsx`
   - Fetch data with `useQuery`
   - Handle loading and error states

2. **Create reusable component in `src/components/`**
   - Use TypeScript for props
   - Keep component focused
   - Extract shared logic to custom hooks

3. **Add API calls in `src/api/blogApi.ts`**
   - Use Axios instance
   - Return promises for React Query
   - Handle errors explicitly

4. **Style with Tailwind**
   - Use responsive classes
   - Follow existing color scheme
   - Keep consistent spacing

## Best Practices

- ✅ Always handle loading and error states
- ✅ Use TypeScript for type safety
- ✅ Cache data with React Query
- ✅ Keep components small and reusable
- ✅ Optimize images (lazy load, proper sizing)
- ✅ Implement proper error boundaries
- ✅ Use semantic HTML for SEO
- ✅ Test on mobile devices

## Deployment

1. **Build for production**
   ```bash
   npm run build
   ```

2. **Deploy dist/ folder**
   - Static hosting (Netlify, Vercel)
   - Nginx/Apache web server
   - CDN for static assets

3. **Set environment variables**
   - Update `VITE_API_BASE_URL` to production backend
   - Rebuild with production values

## Additional Resources

- [React Documentation](https://react.dev/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Vite Guide](https://vitejs.dev/)
- [Tailwind CSS Docs](https://tailwindcss.com/docs)
- [TanStack Query Docs](https://tanstack.com/query/latest)
- [React Router Documentation](https://reactrouter.com/)
- [React Markdown Docs](https://github.com/remarkjs/react-markdown)
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
