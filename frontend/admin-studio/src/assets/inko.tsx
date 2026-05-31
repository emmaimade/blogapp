type InkoLogoColor = 'purple' | 'white';

export const InkoLogo: React.FC<{
  size?: number;
  className?: string;
  color?: InkoLogoColor;
}> = ({ size = 24, className, color = 'purple' }) => {
  const markColor = color === 'white' ? '#FFFFFF' : '#7C3AED';
  const circleOpacity = color === 'white' ? 1 : 0.72;

  return (
    <svg
      role="img"
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <path
        d="M12 2C12 2 8 6 8 10C8 13.314 9.79 16 12 16C14.21 16 16 13.314 16 10C16 6 12 2 12 2Z"
        fill={markColor}
      />
      <circle
        cx="12"
        cy="19"
        r="2"
        fill={markColor}
        opacity={circleOpacity}
      />
    </svg>
  );
};
