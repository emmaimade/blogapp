import toast from 'react-hot-toast';
import { slugFromLocation, workspacePath } from './workspacePaths';

/**
 * The billing page of the workspace in the current URL. Read at call time
 * since toasts render outside the router; off a workspace page the legacy
 * path redirects to the last-used workspace.
 */
export const billingPath = () => {
  const slug = slugFromLocation();
  return slug ? workspacePath(slug, '/settings/billing') : '/admin/settings/billing';
};

/** The backend's error envelope, as axios exposes it. */
type ApiErrorLike = { response?: { data?: { code?: string; detail?: string } } } | null | undefined;

/** The backend's user-facing message for a failed request, if it sent one. */
export const apiErrorMessage = (error: unknown): string | undefined =>
  (error as ApiErrorLike)?.response?.data?.detail;

export const isPlanUpgradeError = (error: unknown): boolean =>
  (error as ApiErrorLike)?.response?.data?.code === 'PLAN_UPGRADE_REQUIRED';

/**
 * Toast an API error. When the request was refused by a plan limit the toast
 * also links to the Billing page, so hitting a limit always shows the way out.
 *
 * The Toaster renders outside the router, so the link is a plain anchor.
 */
export const toastApiError = (error: unknown, fallback: string): void => {
  const message = apiErrorMessage(error) || fallback;

  if (!isPlanUpgradeError(error)) {
    toast.error(message);
    return;
  }

  toast.error(
    () => (
      <span className="text-sm">
        {message}{' '}
        <a href={billingPath()} className="font-semibold text-violet-600 underline underline-offset-2 dark:text-violet-400">
          See plans
        </a>
      </span>
    ),
    { duration: 7000 },
  );
};
