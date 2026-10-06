const CSRF_COOKIE_NAME = 'csrf_token';

// csrf_token is deliberately not httpOnly (see backend/app/modules/auth/service.py)
// so this read is possible — it's what proves this request came from a page
// that can actually read this origin's cookies, which a cross-site page can't.
export function getCsrfToken(): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${CSRF_COOKIE_NAME}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}
