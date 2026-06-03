/**
 * Content-script side of the page-context fetch bridge.
 *
 * Sends request descriptors to the injected MAIN-world script
 * (entrypoints/jira-bridge.ts) over window.postMessage and resolves the
 * matching response by id. This lets Jira calls run with the page's own
 * origin/cookies (see jira-bridge.ts for why that matters in Firefox).
 */

export interface BridgeResponse {
  ok: boolean;
  status: number;
  statusText: string;
  body: string;
}

const pending = new Map<string, (r: BridgeResponse) => void>();
let listening = false;

function ensureListener() {
  if (listening) return;
  listening = true;
  window.addEventListener("message", (e: MessageEvent) => {
    if (e.origin !== window.location.origin) return;
    const msg = e.data;
    if (!msg || msg.__sm !== "res") return;
    const resolve = pending.get(msg.id);
    if (resolve) {
      pending.delete(msg.id);
      resolve(msg as BridgeResponse);
    }
  });
}

export function bridgeFetch(
  url: string,
  init: Record<string, unknown>
): Promise<BridgeResponse> {
  ensureListener();
  const id =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random()}`;

  return new Promise<BridgeResponse>((resolve) => {
    const timeout = setTimeout(() => {
      if (pending.has(id)) {
        pending.delete(id);
        resolve({
          ok: false,
          status: 0,
          statusText: "",
          body: "Sprint Mate bridge timed out (no response from page).",
        });
      }
    }, 30000);

    pending.set(id, (r) => {
      clearTimeout(timeout);
      resolve(r);
    });

    window.postMessage({ __sm: "req", id, url, init }, window.location.origin);
  });
}
