const icons = {
  courses: (
    <>
      <rect x="5" y="5" width="14" height="14" rx="3" />
      <path d="M9 9h6v6H9z" />
    </>
  ),
  library: (
    <>
      <path d="M7 5h10a2 2 0 0 1 2 2v10H9a2 2 0 0 0-2 2z" />
      <path d="M7 5a2 2 0 0 0-2 2v12h12" />
      <path d="M10 9h6" />
      <path d="M10 12h6" />
    </>
  ),
  schedule: (
    <>
      <circle cx="12" cy="12" r="7" />
      <path d="M12 8v4l3 2" />
    </>
  ),
  analytics: (
    <>
      <path d="M5 19V9" />
      <path d="M10 19V5" />
      <path d="M15 19v-7" />
      <path d="M20 19V11" />
    </>
  ),
  grades: (
    <>
      <path d="M6 6h12" />
      <path d="M6 12h8" />
      <path d="M6 18h6" />
      <path d="m16 15 2 2 4-5" />
    </>
  ),
  students: (
    <>
      <circle cx="9" cy="9" r="3" />
      <circle cx="17" cy="10" r="2.5" />
      <path d="M4.5 18a4.5 4.5 0 0 1 9 0" />
      <path d="M14.5 18a3.5 3.5 0 0 1 5 0" />
    </>
  ),
  staff: (
    <>
      <circle cx="8.5" cy="9" r="2.8" />
      <circle cx="15.5" cy="8" r="2.2" />
      <path d="M4.5 18a4.2 4.2 0 0 1 8.4 0" />
      <path d="M13.5 17.5a3.2 3.2 0 0 1 5 0" />
      <path d="M18.5 5.5v4" />
      <path d="M16.5 7.5h4" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 3.8v2.1" />
      <path d="M12 18.1v2.1" />
      <path d="m5.9 5.9 1.5 1.5" />
      <path d="m16.6 16.6 1.5 1.5" />
      <path d="M3.8 12h2.1" />
      <path d="M18.1 12h2.1" />
      <path d="m5.9 18.1 1.5-1.5" />
      <path d="m16.6 7.4 1.5-1.5" />
    </>
  ),
  logout: (
    <>
      <path d="M9 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h3" />
      <path d="M14 16l4-4-4-4" />
      <path d="M10 12h8" />
    </>
  ),
  chevronLeft: <path d="m14.5 6-5 6 5 6" />,
  chevronRight: <path d="m9.5 6 5 6-5 6" />,
  menuTab: (
    <>
      <path d="M6 6h9a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3H6" />
      <path d="m10 9 3 3-3 3" />
    </>
  ),
  close: (
    <>
      <path d="M7 7l10 10" />
      <path d="M17 7 7 17" />
    </>
  ),
};

export default function AppIcon({ name, className = "", strokeWidth = 1.8 }) {
  const icon = icons[name];
  if (!icon) return null;

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {icon}
    </svg>
  );
}
