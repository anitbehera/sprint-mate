import { useEffect, useState } from "react";
import { extractIssueKey } from "./issue";

const ROW_SELECTOR = '[role="row"], tr, [data-testid*="row"]';

/** Issue keys for every checked row in the issue navigator, de-duped. */
export function getSelectedIssueKeys(): string[] {
  const keys = new Set<string>();
  const boxes = document.querySelectorAll<HTMLInputElement>(
    'input[type="checkbox"]'
  );

  for (const box of boxes) {
    if (!box.checked) continue;

    const row = box.closest<HTMLElement>(ROW_SELECTOR);
    if (!row) continue;

    const key = issueKeyFromRow(row);
    if (key) keys.add(key);
  }

  return [...keys];
}

function issueKeyFromRow(row: HTMLElement): string | null {
  const anchor = row.querySelector<HTMLAnchorElement>('a[href*="/browse/"]');
  if (anchor) {
    const fromHref = extractIssueKey(anchor.getAttribute("href") ?? "");
    if (fromHref) return fromHref;
  }

  const dataKey =
    row.getAttribute("data-issue-key") ??
    row.getAttribute("data-issuekey") ??
    row.getAttribute("data-row-id");
  if (dataKey) {
    const fromData = extractIssueKey(dataKey);
    if (fromData) return fromData;
  }

  return null;
}

/**
 * Live-tracked selected keys for the panel.(polls)
 */
export function useSelectedIssues(active: boolean): string[] {
  const [keys, setKeys] = useState<string[]>([]);

  useEffect(() => {
    if (!active) {
      setKeys([]);
      return;
    }

    const read = () => {
      setKeys((prev) => {
        const next = getSelectedIssueKeys();
        if (prev.length === next.length && prev.every((k, i) => k === next[i])) {
          return prev;
        }
        return next;
      });
    };

    read();
    const id = window.setInterval(read, 500);
    return () => window.clearInterval(id);
  }, [active]);

  return keys;
}
