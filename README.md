# Sprint Mate

**FastLane for Jira** - a Chrome extension that drives a Jira ticket through your
team's status flow in one click, using your existing Jira login (no API token).

It injects a small floating launcher only on Jira issue pages. Open it, hit
**Run Flow**, and Sprint Mate walks the ticket forward one transition at a time,
showing live progress.

## How it works (Approach A)

- A **content script** runs inside the Jira page (`*.atlassian.net`), so all REST
  calls reuse the browser's existing session cookies. No tokens, no passwords,
  nothing leaves the page's origin.
- The UI is mounted in a **Shadow DOM**, so the extension's styles and Jira's
  styles never collide.
- POST requests send `X-Atlassian-Token: no-check` to satisfy Jira's XSRF check.

## Tech stack

- [WXT](https://wxt.dev) (Vite-based Manifest V3 framework)
- React 19 + TypeScript
- `@dnd-kit/sortable` for the drag-to-order setup
- `chrome.storage.sync` for per-project flow config

## One-time setup (per project)

The first time you open Sprint Mate on a project, it asks you to define the flow:

1. It fetches every status in the project (`/rest/api/3/project/{KEY}/statuses`).
2. You add the statuses you care about and **drag them into order**.
3. The ordered list is saved to `chrome.storage.sync`, keyed by `host:PROJECT`,
   so each team/project keeps its own flow. You only do this once.

At run time it reads the ticket's current status, computes the remaining statuses
up to your **Stop At** target, and transitions through them in order. Transitions
are matched by destination status first, then by transition name (handles steps
like "US Approval" -> "Waiting for Business Approval").

## Develop

```bash
cd sprint-mate
npm install
npm run dev          # launches Chrome with the extension loaded + HMR
```

Or load it manually:

```bash
npm run build        # outputs .output/chrome-mv3
```

Then in Chrome: `chrome://extensions` -> enable **Developer mode** ->
**Load unpacked** -> select `sprint-mate/.output/chrome-mv3`.

Open any Jira issue (e.g. `https://your-domain.atlassian.net/browse/EC-1234`),
click the lightning launcher at the top-right, and set up your flow.

## Firefox

The same codebase builds for Firefox (WXT targets Firefox MV2):

```bash
npm run dev:firefox    # launches Firefox with the extension loaded + reload
npm run build:firefox  # outputs .output/firefox-mv2
```

To load a build manually: open `about:debugging#/runtime/this-firefox` ->
**Load Temporary Add-on** -> select `sprint-mate/.output/firefox-mv2/manifest.json`.
Temporary add-ons are removed when Firefox restarts.

For a permanent install, the add-on must be signed through
[addons.mozilla.org](https://addons.mozilla.org) (AMO), or run in Firefox
Developer Edition / Nightly with `xpinstall.signatures.required` set to `false`.
Note: AMO submissions for new extensions now also require declaring
`data_collection_permissions` - Sprint Mate collects no data (storage is local
only), so `none` applies.

## Scripts

| Script                  | Description                                   |
| ----------------------- | --------------------------------------------- |
| `npm run dev`           | Dev build + auto-reload in Chrome             |
| `npm run dev:firefox`   | Dev build + auto-reload in Firefox            |
| `npm run build`         | Production build (`.output/chrome-mv3`)       |
| `npm run build:firefox` | Production build (`.output/firefox-mv2`)      |
| `npm run zip`           | Zip the Chrome build for distribution         |
| `npm run zip:firefox`   | Zip the Firefox build for distribution        |
| `npm run icons`         | Regenerate extension icons from the launcher  |
| `npm run compile`       | Type-check with `tsc --noEmit`                |

## Project layout

```
sprint-mate/
├─ wxt.config.ts                 # manifest + WXT config
├─ entrypoints/
│  └─ jira.content.tsx           # content script: issue detection + shadow-root mount
└─ src/
   ├─ lib/
   │  ├─ issue.ts                # issue/project key parsing
   │  ├─ jira.ts                 # session-based Jira REST client
   │  ├─ flow.ts                 # pathfinding + transition matching
   │  └─ storage.ts              # per-project flow config
   └─ ui/
      ├─ App.tsx                 # orchestrator / state machine
      ├─ FloatingIcon.tsx        # launcher
      ├─ FloatingBar.tsx         # panel shell
      ├─ RunProgress.tsx         # animated stepper
      ├─ SettingsPanel.tsx       # FastLane Settings (Stop At, change/reset)
      ├─ SetupWizard.tsx         # one-time drag-to-order setup
      └─ styles.css              # SLDS-aligned styles (shadow-root scoped)
```

## Notes / limits

- Jira **Cloud** only (`*.atlassian.net`) for now. Server/Data Center hosts can be
  added via extra `host_permissions`.
- Enterprises can later push a default flow via `chrome.storage.managed`; the
  storage layer already falls back to it.
