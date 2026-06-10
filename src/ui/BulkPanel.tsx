import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSelectedIssues } from "@/src/lib/selection";
import { runBulkFlow, type TicketProgress } from "@/src/lib/bulk";
import { projectKeyOf } from "@/src/lib/issue";
import { getFlow, type FlowConfig } from "@/src/lib/storage";
import { SetupWizard } from "./SetupWizard";
import { SettingsPanel } from "./SettingsPanel";

type Phase = "idle" | "running" | "done";
type View = "idle" | "setup" | "settings";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Bulk "Run Flow" UI shown on the issue navigator / filter page. */
export function BulkPanel({ host, active }: { host: string; active: boolean }) {
  const selected = useSelectedIssues(active);
  const [phase, setPhase] = useState<Phase>("idle");
  const [tickets, setTickets] = useState<TicketProgress[]>([]);
  const runningRef = useRef(false);

  const [view, setView] = useState<View>("idle");
  const [setupProject, setSetupProject] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [stopAts, setStopAts] = useState<Record<string, string>>({});

  // Distinct projects across the current selection (e.g. EC-1, EC-2 -> ["EC"]).
  const projects = useMemo(
    () => [...new Set(selected.map(projectKeyOf))],
    [selected]
  );
  const projectsKey = projects.join(",");

  // Flow status per project: undefined = loading, null = not configured.
  const [flows, setFlows] = useState<
    Record<string, FlowConfig | null | undefined>
  >({});

  useEffect(() => {
    if (projects.length === 0) {
      setFlows({});
      return;
    }
    let cancelled = false;
    Promise.all(
      projects.map(async (p) => [p, await getFlow(host, p)] as const)
    ).then((entries) => {
      if (!cancelled) setFlows(Object.fromEntries(entries));
    });
    return () => {
      cancelled = true;
    };
  }, [host, projectsKey, refresh]);

  const needSetup = projects.filter((p) => flows[p] === null);
  const configured = projects.filter((p) => flows[p]);

  const run = useCallback(async () => {
    if (runningRef.current || selected.length === 0) return;
    runningRef.current = true;
    setPhase("running");

    try {
      const results = await runBulkFlow(selected, host, setTickets, stopAts);
      setTickets(results);
      setPhase("done");

      const failed = results.filter((t) => t.state === "failed").length;
      // Give the user a beat to read the outcome, then refresh the list.
      await sleep(failed > 0 ? 2600 : 1200);
      window.location.reload();
    } finally {
      runningRef.current = false;
    }
  }, [selected, host, stopAts]);

  if (phase !== "idle") {
    return <BulkProgress tickets={tickets} phase={phase} />;
  }

  if (view === "setup" && setupProject) {
    return (
      <SetupWizard
        host={host}
        projectKey={setupProject}
        existing={flows[setupProject]?.ordered ?? []}
        onSaved={() => {
          setView("idle");
          setSetupProject(null);
          setRefresh((r) => r + 1);
        }}
        onCancel={() => {
          setView("idle");
          setSetupProject(null);
        }}
      />
    );
  }

  if (view === "settings") {
    return (
      <div className="sm-settings">
        <div className="sm-settings-head">
          <h2 className="sm-settings-title">FastLane Settings</h2>
          <button className="sm-link" onClick={() => setView("idle")}>
            Done
          </button>
        </div>
        {configured.length === 0 ? (
          <p className="sm-muted">
            No configured projects in the current selection.
          </p>
        ) : (
          configured.map((p) => (
            <div className="sm-bulk-settings-card" key={p}>
              <SettingsPanel
                embedded
                host={host}
                projectKey={p}
                ordered={flows[p]!.ordered}
                stopAt={stopAts[p] ?? ""}
                onStopAtChange={(v) =>
                  setStopAts((m) => ({ ...m, [p]: v }))
                }
                onEdit={() => {
                  setSetupProject(p);
                  setView("setup");
                }}
                onReset={() => {
                  setStopAts((m) => {
                    const next = { ...m };
                    delete next[p];
                    return next;
                  });
                  setRefresh((r) => r + 1);
                }}
                onClose={() => setView("idle")}
              />
            </div>
          ))
        )}
      </div>
    );
  }

  return (
    <div className="sm-bulk">
      {needSetup.length > 0 && (
        <div className="sm-bulk-setup">
          {needSetup.map((p) => (
            <div className="sm-setup-cta" key={p}>
              <p className="sm-setup-cta-title">One-time setup</p>
              <p className="sm-muted">
                Tell Sprint Mate the order of statuses for{" "}
                <strong>{p}</strong>. Takes about 30 seconds - you only do this
                once per project.
              </p>
              <button
                className="sm-btn sm-btn-primary"
                onClick={() => {
                  setSetupProject(p);
                  setView("setup");
                }}
              >
                Set up flow
              </button>
            </div>
          ))}
        </div>
      )}

      <p className="sm-bulk-count">
        <strong>{selected.length}</strong>{" "}
        {selected.length === 1 ? "ticket" : "tickets"} selected
      </p>

      {selected.length === 0 ? (
        <p className="sm-muted">
          Tick one or more rows in the list, then run the flow on all of them.
        </p>
      ) : (
        <ul className="sm-bulk-keys">
          {selected.map((key) => (
            <li className="sm-chip" key={key}>
              {key}
            </li>
          ))}
        </ul>
      )}

      <div className="sm-actions">
        <button
          className="sm-btn sm-btn-primary sm-run"
          onClick={run}
          disabled={selected.length === 0 || needSetup.length > 0}
        >
          Run Flow on {selected.length || "selected"}{" "}
          {selected.length === 1 ? "ticket" : "tickets"}
        </button>
        {configured.length > 0 && (
          <button
            className="sm-btn sm-btn-icon"
            title="FastLane Settings"
            aria-label="FastLane Settings"
            onClick={() => setView("settings")}
          >
            <GearIcon />
          </button>
        )}
      </div>
    </div>
  );
}

function BulkProgress({
  tickets,
  phase,
}: {
  tickets: TicketProgress[];
  phase: Phase;
}) {
  const done = tickets.filter((t) => t.state === "done").length;
  const failed = tickets.filter((t) => t.state === "failed").length;
  const skipped = tickets.filter((t) => t.state === "skipped").length;

  return (
    <div className="sm-bulk-progress">
      <ul className="sm-steps">
        {tickets.map((t) => (
          <li className={`sm-step sm-${t.state}`} key={t.key}>
            <span className={`sm-node sm-${t.state}`}>
              {t.state === "done" ? (
                <CheckIcon />
              ) : t.state === "failed" ? (
                <CrossIcon />
              ) : t.state === "skipped" ? (
                <DashIcon />
              ) : (
                <span className="sm-node-dot" />
              )}
            </span>
            <span className="sm-bulk-row">
              <span className="sm-step-label">{t.key}</span>
              {t.state === "running" && t.current ? (
                <span className="sm-bulk-msg sm-bulk-current"> → {t.current}</span>
              ) : (
                t.message && <span className="sm-bulk-msg">{t.message}</span>
              )}
            </span>
          </li>
        ))}
      </ul>

      {phase === "done" && (
        <div className="sm-run-done">
          <span className="sm-done-badge">
            <CheckIcon />
          </span>
          {done} done
          {skipped > 0 ? `, ${skipped} skipped` : ""}
          {failed > 0 ? `, ${failed} failed` : ""} - reloading...
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

function DashIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 12h12" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  );
}

function GearIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}
