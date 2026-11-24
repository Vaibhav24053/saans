export function BrandMark({ className = 'w-8 h-8' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 36 36"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <rect width="36" height="36" rx="10" fill="#1B4332" />
      <path
        d="M9.5 14.5C12.2 11.8 16.5 11.8 19.2 14.2C21.5 16.2 24.4 16.2 26.5 14"
        stroke="#B7E4C7"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <path
        d="M9.5 20C12.8 17.5 16.8 17.8 19.6 19.8C22 21.5 24.6 21.3 26.5 19.3"
        stroke="#FFFFFF"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <path
        d="M12.5 25C15 23.6 18 23.8 20.5 25.1C22.2 26 24 25.8 25.5 24.6"
        stroke="#74C69D"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
