/**
 * Page-context (MAIN world) fetch bridge.
 *
 * Injected into the Jira page by the content script. Running here means our
 * Jira REST calls originate from the page itself - same origin, referer, and
 * session cookies as Jira's own SPA - which is required for state-changing
 * POSTs to pass Jira's XSRF check in Firefox (an isolated-world content-script
 * fetch gets a 403). The content script talks to it via window.postMessage.
 */
import { defineUnlistedScript } from "wxt/utils/define-unlisted-script";

export default defineUnlistedScript(() => {
  window.addEventListener("message", async (e: MessageEvent) => {
    if (e.source !== window) return;
    const msg = e.data;
    if (!msg || msg.__sm !== "req") return;

    try {
      const res = await fetch(msg.url, msg.init);
      const body = await res.text();
      window.postMessage(
        {
          __sm: "res",
          id: msg.id,
          ok: res.ok,
          status: res.status,
          statusText: res.statusText,
          body,
        },
        window.location.origin
      );
    } catch (err) {
      window.postMessage(
        {
          __sm: "res",
          id: msg.id,
          ok: false,
          status: 0,
          statusText: "",
          body: String(err),
        },
        window.location.origin
      );
    }
  });
});
