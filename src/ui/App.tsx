import { useCallback, useEffect, useRef, useState } from "react";
import {
  issueKeyFromLocation,
  isFilterPage,
  projectKeyOf,
} from "@/src/lib/issue";
import { getFlow, type FlowConfig } from "@/src/lib/storage";
import {
  doTransition,
  getIssueStatus,
  getTransitions,
  JiraError,
} from "@/src/lib/jira";
import { computeRemaining, indexInFlow, matchTransition } from "@/src/lib/flow";
import { FloatingIcon } from "./FloatingIcon";
import { FloatingBar } from "./FloatingBar";
import { RunProgress, type RunPhase, type RunStep } from "./RunProgress";
import { SettingsPanel } from "./SettingsPanel";
import { SetupWizard } from "./SetupWizard";
import { BulkPanel } from "./BulkPanel";

type View = "idle" | "running" | "settings" | "setup";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Track the current issue/project from the URL, reacting to SPA navigation. */
function useIssueContext() {
  const [issueKey, setIssueKey] = useState<string | null>(issueKeyFromLocation);
  const [filter, setFilter] = useState<boolean>(isFilterPage);

  useEffect(() => {
    const onNav = () => {
      setIssueKey(issueKeyFromLocation());
      setFilter(isFilterPage());
    };
    window.addEventListener("wxt:locationchange", onNav);
    return () => window.removeEventListener("wxt:locationchange", onNav);
  }, []);

  return {
    issueKey,
    isFilter: filter,
    projectKey: issueKey ? projectKeyOf(issueKey) : null,
    host: window.location.host,
  };
}

export function App() {
  const { issueKey, isFilter, projectKey, host } = useIssueContext();

  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>("idle");

  // undefined = still loading, null = not configured yet
  const [flow, setFlow] = useState<FlowConfig | null | undefined>(undefined);
  const [stopAt, setStopAt] = useState("");

  const [runSteps, setRunSteps] = useState<RunStep[]>([]);
  const [runPhase, setRunPhase] = useState<RunPhase>("running");
  const [startStatus, setStartStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const runningRef = useRef(false);

  // Reset transient UI when navigating to a different ticket.
  useEffect(() => {
    setView("idle");
    setError(null);
    setInfo(null);
    setRunSteps([]);
  }, [issueKey]);

  // Load the saved flow whenever the project changes.
  useEffect(() => {
    if (!projectKey) return;
    let cancelled = false;
    setFlow(undefined);
    getFlow(host, projectKey).then((f) => {
      if (!cancelled) setFlow(f);
    });
    return () => {
      cancelled = true;
    };
  }, [host, projectKey]);

  const setStep = useCallback((index: number, state: RunStep["state"]) => {
    setRunSteps((prev) =>
      prev.map((s, i) => (i === index ? { ...s, state } : s))
    );
  }, []);

  const runFlow = useCallback(async () => {
    if (!issueKey || !flow || runningRef.current) return;
    runningRef.current = true;
    setError(null);
    setInfo(null);

    try {
      let current: string;
      try {
        current = await getIssueStatus(issueKey);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not load the issue.");
        return;
      }
      setStartStatus(current);

      if (indexInFlow(flow.ordered, current) === -1) {
        setError(
          `Current status "${current}" isn't part of your configured flow, so I don't know where to start.`
        );
        return;
      }

      const remaining = computeRemaining(
        current,
        flow.ordered,
        stopAt || undefined
      );
      if (remaining.length === 0) {
        setInfo(`Nothing to do - already at "${current}".`);
        return;
      }

      setRunSteps(remaining.map((status) => ({ status, state: "pending" })));
      setRunPhase("running");
      setView("running");

      for (let i = 0; i < remaining.length; i++) {
        setStep(i, "active");
        try {
          const transitions = await getTransitions(issueKey);
          const match = matchTransition(transitions, remaining[i]);
          if (!match) {
            const names = transitions
              .map((t) => t.to?.name ?? t.name)
              .filter(Boolean)
              .join(", ");
            throw new JiraError(
              `No transition to "${remaining[i]}".` +
                (names ? ` Available from here: ${names}.` : ""),
              409
            );
          }
          await doTransition(issueKey, match.id);
        } catch (e) {
          setStep(i, "failed");
          setRunPhase("failed");
          setError(
            `Stopped at "${remaining[i]}". ${
              e instanceof Error ? e.message : "Transition failed."
            }`
          );
          return;
        }
        setStep(i, "done");
        await sleep(420);
      }

      setRunPhase("done");
      setInfo(`Done - now at "${remaining[remaining.length - 1]}".`);
      await sleep(1200);
      window.location.reload();
    } finally {
      runningRef.current = false;
    }
  }, [issueKey, flow, stopAt, setStep]);

  const handleSaveFlow = useCallback((saved: FlowConfig) => {
    setFlow(saved);
    setStopAt("");
    setError(null);
    setInfo("Flow saved. You're all set!");
    setView("idle");
  }, []);

  if (!issueKey && isFilter) {
    return (
      <div className="sm-root">
        {!open && <FloatingIcon onClick={() => setOpen(true)} />}

        {open && (
          <FloatingBar
            subtitle="Bulk update"
            onClose={() => setOpen(false)}
          >
            <BulkPanel host={host} active={open} />
          </FloatingBar>
        )}
      </div>
    );
  }

  if (!issueKey) return null;

  return (
    <div className="sm-root">
      {!open && <FloatingIcon onClick={() => setOpen(true)} />}

      {open && (
        <FloatingBar
          subtitle={issueKey}
          onClose={() => {
            setOpen(false);
            setView("idle");
          }}
        >
          {flow === undefined && <div className="sm-loading">Loading flow...</div>}

          {flow === null && view !== "setup" && (
            <div className="sm-setup-cta">
              <p className="sm-setup-cta-title">One-time setup</p>
              <p className="sm-muted">
                Tell Sprint Mate the order of statuses for{" "}
                <strong>{projectKey}</strong>. Takes about 30 seconds - you only
                do this once per project.
              </p>
              <button className="sm-btn sm-btn-primary" onClick={() => setView("setup")}>
                Set up flow
              </button>
            </div>
          )}

          {view === "setup" && projectKey && (
            <SetupWizard
              host={host}
              projectKey={projectKey}
              existing={flow?.ordered ?? []}
              onSaved={handleSaveFlow}
              onCancel={() => setView("idle")}
            />
          )}

          {flow && view === "idle" && (
            <div className="sm-idle">
              {error && <div className="sm-error">{error}</div>}
              {info && <div className="sm-banner-ok">{info}</div>}
              <div className="sm-actions">
                <button className="sm-btn sm-btn-primary sm-run" onClick={runFlow}>
                  Run Flow
                </button>
                <button
                  className="sm-btn sm-btn-icon"
                  title="FastLane Settings"
                  aria-label="FastLane Settings"
                  onClick={() => setView("settings")}
                >
                  <GearIcon />
                </button>
              </div>
            </div>
          )}

          {flow && view === "running" && (
            <RunProgress
              steps={runSteps}
              phase={runPhase}
              startStatus={startStatus}
              error={error}
              onBack={() => setView("idle")}
            />
          )}

          {flow && view === "settings" && (
            <SettingsPanel
              host={host}
              projectKey={projectKey!}
              ordered={flow.ordered}
              stopAt={stopAt}
              onStopAtChange={setStopAt}
              onEdit={() => setView("setup")}
              onReset={() => {
                setFlow(null);
                setStopAt("");
                setView("idle");
              }}
              onClose={() => setView("idle")}
            />
          )}
        </FloatingBar>
      )}
    </div>
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
