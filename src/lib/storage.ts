/**
 * Per-project workflow configuration, stored in `storage.sync` keyed by
 * `flow:<host>:<PROJECT>` so different teams/projects keep independent flows.
 *
 * Shaped so an enterprise can later push defaults via managed storage without
 * changing callers (see `getFlow`).
 *
 * Uses WXT's `browser` namespace (promise-based) so storage works identically
 * in Chrome and Firefox - the raw `chrome.*` API is callback-based in Firefox.
 */
import { browser } from "wxt/browser";

export interface FlowConfig {
  /** Ordered status names the ticket is driven through. */
  ordered: string[];
  updatedAt: number;
}

function storageKey(host: string, projectKey: string): string {
  return `flow:${host}:${projectKey.toUpperCase()}`;
}

export async function getFlow(
  host: string,
  projectKey: string
): Promise<FlowConfig | null> {
  const key = storageKey(host, projectKey);

  const synced = await browser.storage.sync.get(key);
  if (synced[key]) return synced[key] as FlowConfig;

  // Fall back to an admin-pushed default if one exists.
  try {
    const managed = await browser.storage.managed.get(key);
    if (managed[key]) return managed[key] as FlowConfig;
  } catch {
    // managed storage is unavailable outside enterprise installs - ignore.
  }

  return null;
}

export async function saveFlow(
  host: string,
  projectKey: string,
  ordered: string[]
): Promise<FlowConfig> {
  const config: FlowConfig = { ordered, updatedAt: Date.now() };
  await browser.storage.sync.set({ [storageKey(host, projectKey)]: config });
  return config;
}

export async function resetFlow(host: string, projectKey: string): Promise<void> {
  await browser.storage.sync.remove(storageKey(host, projectKey));
}
