import { useEffect, useMemo, useState } from "react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { getProjectStatuses, JiraError } from "@/src/lib/jira";
import { saveFlow, type FlowConfig } from "@/src/lib/storage";

interface Props {
  host: string;
  projectKey: string;
  existing: string[];
  onSaved: (flow: FlowConfig) => void;
  onCancel: () => void;
}

export function SetupWizard({ host, projectKey, existing, onSaved, onCancel }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [allStatuses, setAllStatuses] = useState<string[]>([]);
  const [chosen, setChosen] = useState<string[]>(existing);
  const [saving, setSaving] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } })
  );

  useEffect(() => {
    let cancelled = false;
    getProjectStatuses(projectKey)
      .then((statuses) => {
        if (cancelled) return;
        setAllStatuses(statuses);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(
          e instanceof JiraError
            ? e.message
            : "Could not load statuses for this project."
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectKey]);

  const available = useMemo(
    () => allStatuses.filter((s) => !chosen.includes(s)),
    [allStatuses, chosen]
  );

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setChosen((prev) => {
      const from = prev.indexOf(String(active.id));
      const to = prev.indexOf(String(over.id));
      if (from === -1 || to === -1) return prev;
      return arrayMove(prev, from, to);
    });
  }

  async function handleSave() {
    setSaving(true);
    try {
      const config = await saveFlow(host, projectKey, chosen);
      onSaved(config);
    } catch {
      setError("Could not save your flow. Please try again.");
      setSaving(false);
    }
  }

  return (
    <div className="sm-setup">
      <div className="sm-setup-intro">
        <p className="sm-setup-cta-title">Set up your flow</p>
        <p className="sm-muted">
          Pick the statuses for <strong>{projectKey}</strong> and drag them into
          the order your tickets move through. This is a one-time setup.
        </p>
      </div>

      {error && <div className="sm-error">{error}</div>}
      {loading && <div className="sm-loading">Loading statuses...</div>}

      {!loading && (
        <>
          <p className="sm-field-label">Your flow (top to bottom)</p>
          {chosen.length === 0 ? (
            <div className="sm-empty">Add statuses from below to build your flow.</div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={onDragEnd}
            >
              <SortableContext items={chosen} strategy={verticalListSortingStrategy}>
                <ul className="sm-chosen">
                  {chosen.map((status, i) => (
                    <SortableRow
                      key={status}
                      id={status}
                      index={i}
                      onRemove={() =>
                        setChosen((prev) => prev.filter((s) => s !== status))
                      }
                    />
                  ))}
                </ul>
              </SortableContext>
            </DndContext>
          )}

          {available.length > 0 && (
            <>
              <p className="sm-field-label">Available statuses</p>
              <div className="sm-available">
                {available.map((status) => (
                  <button
                    key={status}
                    className="sm-chip sm-chip-add"
                    onClick={() => setChosen((prev) => [...prev, status])}
                  >
                    + {status}
                  </button>
                ))}
              </div>
            </>
          )}

          <div className="sm-setup-actions">
            <button className="sm-btn sm-btn-ghost" onClick={onCancel}>
              Cancel
            </button>
            <button
              className="sm-btn sm-btn-primary"
              disabled={chosen.length < 2 || saving}
              onClick={handleSave}
            >
              {saving ? "Saving..." : "Save flow"}
            </button>
          </div>
          {chosen.length < 2 && (
            <p className="sm-hint">Add at least two statuses to save.</p>
          )}
        </>
      )}
    </div>
  );
}

function SortableRow({
  id,
  index,
  onRemove,
}: {
  id: string;
  index: number;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };

  return (
    <li ref={setNodeRef} style={style} className="sm-chosen-row">
      <span className="sm-drag" {...attributes} {...listeners} aria-label="Drag to reorder">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="9" cy="6" r="1.4" fill="currentColor" />
          <circle cx="15" cy="6" r="1.4" fill="currentColor" />
          <circle cx="9" cy="12" r="1.4" fill="currentColor" />
          <circle cx="15" cy="12" r="1.4" fill="currentColor" />
          <circle cx="9" cy="18" r="1.4" fill="currentColor" />
          <circle cx="15" cy="18" r="1.4" fill="currentColor" />
        </svg>
      </span>
      <span className="sm-chosen-index">{index + 1}</span>
      <span className="sm-chosen-label">{id}</span>
      <button className="sm-remove" onClick={onRemove} aria-label={`Remove ${id}`}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>
    </li>
  );
}
