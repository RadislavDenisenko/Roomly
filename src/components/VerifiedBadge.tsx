export function VerifiedBadge({ label = "Verified" }: { label?: string }) {
  return (
    <span className="roomly-badge inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-xs font-semibold text-green-700 ring-1 ring-inset ring-green-600/20 dark:bg-green-950/50 dark:text-green-300 dark:ring-green-400/25">
      <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" aria-hidden="true">
        <circle cx="10" cy="10" r="9" className="fill-green-600 dark:fill-green-400" />
        <path
          d="M8.6 13.4 5.2 10l1.3-1.3 2.1 2.1 4.9-4.9L14.8 7.2z"
          className="fill-white dark:fill-green-950"
        />
      </svg>
      {label}
    </span>
  );
}
