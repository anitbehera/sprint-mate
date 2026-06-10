import ReactDOM from "react-dom/client";
import { defineContentScript } from "wxt/utils/define-content-script";
import { createShadowRootUi } from "wxt/utils/content-script-ui/shadow-root";
import { injectScript } from "wxt/utils/inject-script";
import { issueKeyFromLocation, isFilterPage } from "@/src/lib/issue";
import { App } from "@/src/ui/App";
import "@/src/ui/styles.css";

export default defineContentScript({
  matches: ["*://*.atlassian.net/*"],
  cssInjectionMode: "ui",
  async main(ctx) {
    // Run Jira API calls from the page's own context so POSTs carry the page
    // origin/cookies (required for Jira's XSRF check to pass in Firefox).
    await injectScript("/jira-bridge.js", { keepInDom: true });

    const ui = await createShadowRootUi(ctx, {
      name: "sprint-mate-ui",
      position: "inline",
      anchor: "body",
      isolateEvents: true,
      onMount: (container) => {
        const root = ReactDOM.createRoot(container);
        root.render(<App />);
        return root;
      },
      onRemove: (root) => root?.unmount(),
    });

    // Jira Cloud is a single-page app: mount when an issue is open or on the
    // issue navigator / filter page, and re-evaluate on every client-side nav.
    const sync = () => {
      if (issueKeyFromLocation() || isFilterPage()) ui.mount();
      else ui.remove();
    };

    sync();
    ctx.addEventListener(window, "wxt:locationchange", sync);
  },
});
