export type StepState = "pending" | "active" | "done" | "failed";
export type RunPhase = "running" | "done" | "failed";

export interface RunStep {
  status: string;
  state: StepState;
}

interface Props {
  steps: RunStep[];
  phase: RunPhase;
  startStatus: string | null;
  error: string | null;
  onBack: () => void;
}

export function RunProgress({ steps, phase, startStatus, error, onBack }: Props) {
  return (
    <div className="sm-run-progress">
      {startStatus && (
        <div className="sm-run-start">
          Starting from <strong>{startStatus}</strong>
        </div>
      )}

      <ul className="sm-steps">
        {steps.map((s, i) => (
          <li className={`sm-step sm-${s.state}`} key={`${s.status}-${i}`}>
            <span className={`sm-node sm-${s.state}`}>
              {s.state === "done" ? (
                <CheckIcon />
              ) : s.state === "failed" ? (
                <CrossIcon />
              ) : (
                <span className="sm-node-dot" />
              )}
            </span>
            <span className="sm-step-label">{s.status}</span>
          </li>
        ))}
      </ul>

      {phase === "done" && (
        <div className="sm-run-done">
          <span className="sm-done-badge">
            <CheckIcon />
          </span>
          Flow complete
        </div>
      )}

      {phase === "failed" && (
        <div className="sm-run-failed">
          {error && <div className="sm-error">{error}</div>}
          <button className="sm-btn sm-btn-primary" onClick={onBack}>
            Back
          </button>
        </div>
      )}
    </div>
  );
}

function CheckIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M5 12.5 10 17.5 19 6.5"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CrossIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M6 6l12 12M18 6 6 18"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
    </svg>
  );
}
