import type { ReactNode } from "react";

interface Props {
  issueKey: string;
  onClose: () => void;
  children: ReactNode;
}

/** The floating panel that opens from the launcher. */
export function FloatingBar({ issueKey, onClose, children }: Props) {
  return (
    <div className="sm-bar" role="dialog" aria-label="Sprint Mate">
      <div className="sm-bar-head">
        <div className="sm-brand">
          <span className="sm-brand-mark" aria-hidden="true">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path
                d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z"
                fill="currentColor"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <div className="sm-brand-text">
            <span className="sm-brand-name">Sprint Mate</span>
            <span className="sm-brand-sub">{issueKey}</span>
          </div>
        </div>
        <button
          className="sm-btn sm-btn-icon sm-close"
          onClick={onClose}
          aria-label="Close"
          title="Close"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M6 6l12 12M18 6 6 18"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>
      <div className="sm-bar-body">{children}</div>
    </div>
  );
}
