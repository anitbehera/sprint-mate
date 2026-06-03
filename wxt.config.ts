import { defineConfig } from "wxt";

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  srcDir: ".",
  manifest: {
    name: "Sprint Mate",
    description: "FastLane for Jira - drive a Jira ticket through your team's status flow in one click.",
    permissions: ["storage"],
    host_permissions: ["*://*.atlassian.net/*"],
    action: { default_title: "Sprint Mate - FastLane for Jira" },
    browser_specific_settings: {
      gecko: { 
        id: "sprint-mate@halfconsole.dev",
        strict_min_version: "140.0",
        data_collection_permissions: {
          required: ["none"],
        }
      },
    },
    // The page-context fetch bridge is injected at runtime, so it must be
    // web-accessible. WXT merges this with its auto-generated CSS entry.
    web_accessible_resources: [
      { resources: ["jira-bridge.js"], matches: ["*://*.atlassian.net/*"] },
    ],
  },
});
