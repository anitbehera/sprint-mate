import { useState } from "react";
import { resetFlow } from "@/src/lib/storage";

interface Props {
  host: string;
  projectKey: string;
  ordered: string[];
  stopAt: string;
  onStopAtChange: (value: string) => void;
  onEdit: () => void;
  onReset: () => void;
  onClose: () => void;
}

export function SettingsPanel({
  host,
  projectKey,
  ordered,
  stopAt,
  onStopAtChange,
  onEdit,
  onReset,
  onClose,
}: Props) {
  const [confirming, setConfirming] = useState(false);
  const last = ordered[ordered.length - 1];

  async function handleReset() {
    await resetFlow(host, projectKey);
    onReset();
  }

  return (
    <div className="sm-settings">
      <div className="sm-settings-head">
        <h2 className="sm-settings-title">FastLane Settings</h2>
        <button className="sm-link" onClick={onClose}>
          Done
        </button>
      </div>

      <label className="sm-field-label" htmlFor="sm-stopat">
        Stop at
      </label>
      <select
        id="sm-stopat"
        className="sm-select"
        value={stopAt}
        onChange={(e) => onStopAtChange(e.target.value)}
      >
        <option value="">Run to the end ({last})</option>
        {ordered.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>

      <div className="sm-settings-divider" />

      <p className="sm-field-label">Workflow ({projectKey})</p>
      <div className="sm-flow-preview">
        {ordered.map((s, i) => (
          <span className="sm-chip" key={s}>
            {i + 1}. {s}
          </span>
        ))}
      </div>

      <div className="sm-settings-actions">
        <button className="sm-btn sm-btn-secondary" onClick={onEdit}>
          Change workflow
        </button>
        {confirming ? (
          <button className="sm-btn sm-btn-danger" onClick={handleReset}>
            Confirm reset
          </button>
        ) : (
          <button className="sm-btn sm-btn-ghost" onClick={() => setConfirming(true)}>
            Reset
          </button>
        )}
      </div>
    </div>
  );
}
