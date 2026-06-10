import { projectKeyOf } from "./issue";
import { getFlow, type FlowConfig } from "./storage";
import {
  doTransition,
  getIssueStatus,
  getTransitions,
  JiraError,
} from "./jira";
import { computeRemaining, indexInFlow, matchTransition } from "./flow";

export type TicketState = "pending" | "running" | "done" | "failed" | "skipped";

export interface TicketProgress {
  key: string;
  state: TicketState;
  message?: string;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));


export async function runBulkFlow(
  keys: string[],
  host: string,
  onProgress: (snapshot: TicketProgress[]) => void,
  stopAts: Record<string, string> = {}
): Promise<TicketProgress[]> {
  const tickets: TicketProgress[] = keys.map((key) => ({
    key,
    state: "pending",
  }));
  const emit = () => onProgress(tickets.map((t) => ({ ...t })));
  emit();

  // Cache each project's flow so we only fetch it once per run.
  const flowCache = new Map<string, FlowConfig | null>();
  const flowFor = async (projectKey: string): Promise<FlowConfig | null> => {
    if (!flowCache.has(projectKey)) {
      flowCache.set(projectKey, await getFlow(host, projectKey));
    }
    return flowCache.get(projectKey) ?? null;
  };

  for (const ticket of tickets) {
    ticket.state = "running";
    emit();

    try {
      const projectKey = projectKeyOf(ticket.key);
      const flow = await flowFor(projectKey);

      if (!flow) {
        ticket.state = "skipped";
        ticket.message = `No flow configured for ${projectKey}.`;
        emit();
        continue;
      }

      const current = await getIssueStatus(ticket.key);

      if (indexInFlow(flow.ordered, current) === -1) {
        ticket.state = "skipped";
        ticket.message = `Status "${current}" isn't in the ${projectKey} flow.`;
        emit();
        continue;
      }

      const stopAt = stopAts[projectKey] || undefined;
      const remaining = computeRemaining(current, flow.ordered, stopAt);
      if (remaining.length === 0) {
        ticket.state = "skipped";
        ticket.message = stopAt
          ? `Already at or past "${stopAt}".`
          : `Already at "${current}".`;
        emit();
        continue;
      }

      let stoppedAt: string | null = null;
      for (const target of remaining) {
        const transitions = await getTransitions(ticket.key);
        const match = matchTransition(transitions, target);
        if (!match) {
          const names = transitions
            .map((t) => t.to?.name ?? t.name)
            .filter(Boolean)
            .join(", ");
          throw new JiraError(
            `No transition to "${target}".` +
              (names ? ` Available: ${names}.` : ""),
            409
          );
        }
        await doTransition(ticket.key, match.id);
        stoppedAt = target;
        await sleep(250);
      }

      ticket.state = "done";
      ticket.message = stoppedAt ? `Now at "${stoppedAt}".` : undefined;
      emit();
    } catch (e) {
      ticket.state = "failed";
      ticket.message = e instanceof Error ? e.message : "Transition failed.";
      emit();
    }
  }

  return tickets.map((t) => ({ ...t }));
}
