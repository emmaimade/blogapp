import { isAxiosError } from 'axios';

/** HTTP status of a failed API call, if it got a response at all. */
export const getErrorStatus = (err: unknown): number | undefined =>
  isAxiosError(err) ? err.response?.status : undefined;

/**
 * A user-presentable message from a failed API call. FastAPI's `detail` can
 * be a string, a validation-error list, or a structured object, so each
 * shape is flattened to text; anything unusable falls back to `fallback`.
 */
export const getApiErrorMessage = (err: unknown, fallback: string): string => {
  if (!isAxiosError(err)) return fallback;
  const detail: unknown = err.response?.data?.detail;
  if (!detail) return fallback;

  if (Array.isArray(detail)) {
    return detail
      .map((item) => (item && typeof item === 'object' && 'msg' in item ? String(item.msg) : JSON.stringify(item)))
      .join('; ');
  }
  if (typeof detail === 'object') {
    return 'message' in detail && detail.message ? String(detail.message) : fallback;
  }
  return String(detail);
};
