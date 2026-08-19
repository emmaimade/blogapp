import { Loader2 } from 'lucide-react';

interface SpinnerProps {
  size?: number;
  className?: string;
}

export const Spinner = ({ size = 20, className = 'text-violet-600' }: SpinnerProps) => (
  <Loader2 size={size} className={`animate-spin ${className}`} />
);

interface CenteredSpinnerProps extends SpinnerProps {
  minHeight?: string;
}

export const CenteredSpinner = ({ size = 28, className = 'text-violet-600', minHeight = 'min-h-64' }: CenteredSpinnerProps) => (
  <div className={`flex items-center justify-center ${minHeight}`}>
    <Spinner size={size} className={className} />
  </div>
);
