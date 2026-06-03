/**
 * Pure workflow logic, generalised from the web app so the ordered list of
 * statuses is supplied at runtime (per project) instead of being hardcoded.
 */
import type { JiraTransition } from "./jira";

export function normalize(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Find the transition that lands the issue in `targetStatus`. Prefers matching
 * by destination status (`to.name`); falls back to the transition's own name -
 * this handles steps reached via a transition named differently than its
 * destination (e.g. "US Approval" -> "Waiting for Business Approval").
 */
export function matchTransition(
  transitions: JiraTransition[],
  targetStatus: string
): JiraTransition | undefined {
  const target = normalize(targetStatus);
  return (
    transitions.find((t) => normalize(t.to?.name ?? "") === target) ??
    transitions.find((t) => normalize(t.name ?? "") === target)
  );
}

/** Index of a status within the ordered flow, or -1. */
export function indexInFlow(ordered: string[], status: string): number {
  const target = normalize(status);
  return ordered.findIndex((s) => normalize(s) === target);
}

/**
 * The statuses the ticket still needs to move through, in order, from just
 * after `current` up to and including `stopAt` (defaults to the last status).
 * Returns an empty array when the current status is unknown or already at/after
 * the target.
 */
export function computeRemaining(
  current: string,
  ordered: string[],
  stopAt?: string
): string[] {
  const currentIdx = indexInFlow(ordered, current);
  if (currentIdx === -1) return [];

  let endIdx = ordered.length - 1;
  if (stopAt) {
    const stopIdx = indexInFlow(ordered, stopAt);
    if (stopIdx !== -1) endIdx = stopIdx;
  }
  if (endIdx <= currentIdx) return [];

  return ordered.slice(currentIdx + 1, endIdx + 1);
}
