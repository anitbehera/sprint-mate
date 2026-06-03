/**
 * Helpers for recognising Jira issue pages and pulling the issue/project key
 * out of a URL. Ported and tightened from the web app's `extractIssueKey`.
 */

const KEY = "[A-Za-z][A-Za-z0-9]*-\\d+";

/**
 * Strict issue-key detection for the *current page*. Only returns a key when
 * the URL actually represents an open issue (browse, issues path, or a board
 * with a selected issue), so the floating UI never appears on dashboards,
 * backlogs, settings, etc.
 */
export function issueKeyFromLocation(): string | null {
  const { pathname, search } = window.location;

  const selected = search.match(new RegExp(`[?&]selectedIssue=(${KEY})`));
  if (selected) return selected[1].toUpperCase();

  const browse = pathname.match(new RegExp(`/browse/(${KEY})`));
  if (browse) return browse[1].toUpperCase();

  // e.g. /jira/software/projects/EC/issues/EC-1234
  const issuesPath = pathname.match(new RegExp(`/issues/(${KEY})(?:$|/)`));
  if (issuesPath) return issuesPath[1].toUpperCase();

  return null;
}

/** Loose extraction from any string (used for manual input / fallbacks). */
export function extractIssueKey(input: string): string | null {
  const raw = input.trim();
  const selected = raw.match(new RegExp(`[?&]selectedIssue=(${KEY})`));
  if (selected) return selected[1].toUpperCase();
  const m = raw.match(new RegExp(KEY));
  return m ? m[0].toUpperCase() : null;
}

/** The project key is the part before the dash, e.g. EC-1234 -> EC. */
export function projectKeyOf(issueKey: string): string {
  return issueKey.split("-")[0].toUpperCase();
}
