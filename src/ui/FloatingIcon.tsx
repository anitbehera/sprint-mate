/** Small floating launcher shown bottom-right on Jira issue pages. */
export function FloatingIcon({ onClick }: { onClick: () => void }) {
  return (
    <button
      className="sm-fab"
      onClick={onClick}
      title="Sprint Mate - FastLane for Jira"
      aria-label="Open Sprint Mate"
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z"
          fill="currentColor"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
