/**
 * Session-based Jira Cloud REST client.
 *
 * Calls are issued from the page's own context via the postMessage bridge
 * (see src/lib/bridge.ts and entrypoints/jira-bridge.ts), so they carry the
 * user's existing session cookies plus the page origin/referer - no API token
 * needed. Running in the page context (rather than the content script's
 * isolated world) is what lets state-changing POSTs pass Jira's XSRF check in
 * Firefox. POSTs also send `X-Atlassian-Token: no-check`.
 */
import { bridgeFetch } from "./bridge";

export interface JiraTransition {
  id: string;
  name: string;
  to?: {
    name: string;
    id: string;
  };
}

export class JiraError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "JiraError";
    this.status = status;
  }
}

const API = "/rest/api/3";

function baseUrl(): string {
  return window.location.origin;
}

interface JiraResponse {
  ok: boolean;
  status: number;
  statusText: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  json: () => any;
  text: () => string;
}

async function jiraFetch(
  path: string,
  init: Record<string, unknown> = {}
): Promise<JiraResponse> {
  const res = await bridgeFetch(`${baseUrl()}${path}`, {
    ...init,
    credentials: "include",
    cache: "no-store",
    headers: {
      Accept: "application/json",
      ...((init.headers as Record<string, string>) ?? {}),
    },
  });
  return {
    ok: res.ok,
    status: res.status,
    statusText: res.statusText,
    json: () => JSON.parse(res.body || "null"),
    text: () => res.body,
  };
}

function readError(res: JiraResponse): string {
  try {
    const data = res.json() as {
      errorMessages?: string[];
      errors?: Record<string, unknown>;
    };
    if (data?.errorMessages?.length) return data.errorMessages.join("; ");
    if (data?.errors && typeof data.errors === "object") {
      const parts = Object.entries(data.errors).map(([k, v]) => `${k}: ${v}`);
      if (parts.length) return parts.join("; ");
    }
    return res.statusText || `HTTP ${res.status}`;
  } catch {
    return res.statusText || `HTTP ${res.status}`;
  }
}

/** The issue's current status name. */
export async function getIssueStatus(issueKey: string): Promise<string> {
  const res = await jiraFetch(
    `${API}/issue/${encodeURIComponent(issueKey)}?fields=status`
  );
  if (!res.ok) {
    const msg = await readError(res);
    throw new JiraError(
      res.status === 404
        ? `Issue "${issueKey}" was not found.`
        : `Could not load issue "${issueKey}": ${msg}`,
      res.status
    );
  }
  const data = await res.json();
  const status = data?.fields?.status?.name;
  if (!status) throw new JiraError(`Issue "${issueKey}" has no status.`, 502);
  return status as string;
}

/** Transitions currently available from the issue's status. */
export async function getTransitions(issueKey: string): Promise<JiraTransition[]> {
  const res = await jiraFetch(
    `${API}/issue/${encodeURIComponent(issueKey)}/transitions`
  );
  if (!res.ok) {
    const msg = await readError(res);
    throw new JiraError(
      `Could not load transitions for "${issueKey}": ${msg}`,
      res.status
    );
  }
  const data = await res.json();
  return (data?.transitions ?? []) as JiraTransition[];
}

/** Every distinct status name configured for a project. */
export async function getProjectStatuses(projectKey: string): Promise<string[]> {
  const res = await jiraFetch(
    `${API}/project/${encodeURIComponent(projectKey)}/statuses`
  );
  if (!res.ok) {
    const msg = await readError(res);
    throw new JiraError(
      res.status === 404
        ? `Project "${projectKey}" was not found.`
        : `Could not load statuses for project "${projectKey}": ${msg}`,
      res.status
    );
  }
  const data = (await res.json()) as Array<{
    statuses?: Array<{ name?: string }>;
  }>;
  const names = new Set<string>();
  for (const issueType of data) {
    for (const status of issueType.statuses ?? []) {
      if (status?.name) names.add(status.name);
    }
  }
  return [...names].sort((a, b) => a.localeCompare(b));
}

/** Execute a transition by id. */
export async function doTransition(
  issueKey: string,
  transitionId: string
): Promise<void> {
  const res = await jiraFetch(
    `${API}/issue/${encodeURIComponent(issueKey)}/transitions`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Atlassian-Token": "no-check",
      },
      body: JSON.stringify({ transition: { id: transitionId } }),
    }
  );
  if (!res.ok) {
    const msg = await readError(res);
    throw new JiraError(`Transition failed for "${issueKey}": ${msg}`, res.status);
  }
}
