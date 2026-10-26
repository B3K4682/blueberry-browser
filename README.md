# Blueberry Browser

Blueberry is an Electron + React browser with a built-in AI sidebar. This fork adds **Ritual**, a workflow-learning system that notices the routines you repeat across browsing sessions and offers to turn them into one-click automations.

Most browsers wait for commands. Blueberry tries to be proactive instead: it watches how you work, recognizes repeated work, and offers to replay it for you, so you never have to set up an automation by hand.

---

## What the browser does

| Surface | What it is |
| --- | --- |
| **Top bar** | Tabs, address bar, navigation, dark mode, and the Ritual toolbar icon. It grows a replay banner while a Ritual is running. |
| **Tabs** | Each tab is its own Electron `WebContentsView` that renders the actual web page. |
| **Chat sidebar** | An AI assistant (OpenAI or Anthropic) that can read the current page and answer questions about it. |
| **Ritual** | A floating suggestion card plus a right-side panel listing saved Rituals that you can run with one click. |

---

## ✨ Ritual: a browser that learns your workflows

### Example

Every Monday you open Notion to grab the weekly analytics, switch to Linear to check the sprint board, then go to Gmail to send the report to the same person.

The second time Blueberry sees that same sequence of sites in a new session, a card slides in at the bottom-right corner:

> **I noticed a Ritual:** `notion.so › linear.app › mail.google.com`. Want me to remember it?

Click **Remember the Ritual** and Blueberry:

1. asks an LLM to name and summarize the workflow (for example *"Weekly Analytics Report"*),
2. stores it as a Ritual with its steps, a few automation ideas, and an exported Playwright script,
3. adds it to the Ritual panel, where **Run this** replays the whole routine.

Click **Not now** and that exact sequence is never suggested again.

### What's included

- **Workflow event tracking:** tab opens, switches, navigations, and closes are captured and normalized.
- **Pattern detection engine:** finds repeated contiguous sequences of domains across sessions.
- **Ritual candidate generation:** each detected candidate gets a confidence score and representative events.
- **AI metadata:** the title, summary, steps, and automation ideas are generated with `gpt-4o-mini`, with a deterministic fallback when no API key is set.
- **Replay:** opens each step's URL in order, reusing an existing tab for the same site when one is open, with a live progress banner and a Stop button.
- **Playwright export:** every Ritual comes with a script you can view and run outside the browser.
- **Sidebar Ritual UI:** a suggestion card, a saved-Rituals panel with a timeline and domain chips, and a script viewer.
- **IPC sync** between the main process, the Ritual renderer, and the top bar.
- **Lifecycle state** managed with Zustand (candidate, then generating, then saved, then replaying).
- **Debouncing and duplicate prevention**, so the same suggestion isn't shown repeatedly.
- **Local persistence** in IndexedDB. Events older than 30 days are pruned automatically.

---

## 🧠 How it works

```
 Tab (webContents)          Main process                     Ritual renderer
 ─────────────────          ────────────                     ───────────────
 did-navigate  ───────▶  RitualCollector  ── IPC event ──▶  storage (IndexedDB)
 tab open/switch/close    • 500ms debounce                         │
                          • filters internal URLs                  ▼
                          • session id                      DetectionEngine
                                                                   │ candidate
                          RitualAI  ◀── IPC generate ──────  Zustand store ──▶ Card / Panel
                          • LLM metadata                           │
                          • Playwright script                      │ run
                                                                   ▼
                          Window.openOrFocusTab  ◀── IPC replay ── replay loop
                          TopBar replay banner   ◀── IPC state ──
```

### 1. Event collection: `src/main/RitualCollector.ts`

The collector hooks into every tab's `did-navigate` and `did-navigate-in-page` events and records `tab_open`, `tab_switch`, `navigation`, and `tab_close` events as normalized `WorkflowEvent`s (url, title, domain, tabId, sessionId).

- Navigations are **debounced per tab (500 ms)** so redirect chains count as one step.
- Consecutive navigations within the same domain in a tab are collapsed.
- Internal URLs (`chrome://`, `about:`, `file://`, `data:` …) and default pages like `google.com` are ignored.
- Each app launch gets a fresh **session id**. Events are queued until the Ritual renderer reports that it is ready.

### 2. Pattern detection: `src/renderer/ritual/src/detection.ts`

The detection engine runs on every new event and works with domain sequences.

1. **Rolling buffer:** keeps the last 50 events in memory.
2. **Session filtering:** builds the current session's domain sequence, dropping consecutive duplicates (`notion → notion → gmail` becomes `notion → gmail`).
3. **Window evaluation:** checks the most recent windows of **5, 4, then 3** domains, largest first.
4. **Historical matching:** for each window, it loads the past sessions that touched those domains from IndexedDB and counts how many contain the window as a **contiguous** subsequence. At least one earlier match is required.
5. **Confidence scoring:** a 5-step match scores `1.0`, 4 steps score `0.8`, and 3 steps score `0.6`.
6. **Representative events:** picks the actual events behind each step so replay opens the real URLs rather than domain roots.

A candidate is skipped when:

- it was already shown in this session,
- it was shown within the last 60 seconds (cooldown),
- it is already fully covered by a saved Ritual,
- the user dismissed it before.

A re-entrancy guard keeps overlapping async evaluations from emitting the same candidate twice.

### 3. AI enrichment: `src/main/RitualAI.ts`

When a candidate is accepted, the main process sends its step list to `gpt-4o-mini` and expects a strict JSON response (`title`, `summary`, `steps`, `automationIdeas`). The response is validated and merged with the real event URLs. If the model is unavailable or returns invalid output, a deterministic fallback is used so saving always succeeds. A Playwright script is generated from the same events.

### 4. State and UI: `src/renderer/ritual/src/store.ts`

A Zustand store owns the Ritual lifecycle: showing and dismissing candidates, saving, opening the panel, replaying, and viewing scripts. A store subscription maps the UI state to one of three view modes (`hidden`, `card`, or `panel`), and the main process resizes the transparent Ritual `WebContentsView` to match. The top bar's toolbar icon stays in sync through IPC.

### 5. Replay

The renderer steps through the Ritual's URLs about once per second. For each step, the main process either focuses an existing tab on that site or opens a new one, and the top bar shows a banner with progress and a **Stop** button. Each run updates the Ritual's run count and last-run time.

> Replay currently **navigates** between the saved pages; it doesn't click or type yet. The exported Playwright script follows the same approach and is the starting point for richer automation.

---

## 🗂 Project structure

```
src/
├── main/                     # Electron main process
│   ├── index.ts              # App bootstrap
│   ├── Window.ts             # BaseWindow, tabs, view stacking, openOrFocusTab
│   ├── Tab.ts                # A single web page view
│   ├── TopBar.ts / SideBar.ts
│   ├── EventManager.ts       # IPC routing (tabs, chat, ritual replay)
│   ├── LLMClient.ts          # Chat sidebar LLM (OpenAI / Anthropic)
│   ├── Ritual.ts             # Ritual view: card/panel geometry + IPC handlers
│   ├── RitualCollector.ts    # Workflow event tracking
│   └── RitualAI.ts           # Metadata generation + Playwright export
├── preload/                  # Context-isolated bridges (topbar, sidebar, ritual)
├── renderer/
│   ├── topbar/               # Tabs, address bar, replay banner
│   ├── sidebar/              # AI chat
│   └── ritual/               # Ritual app
│       └── src/
│           ├── detection.ts  # Pattern detection engine
│           ├── storage.ts    # IndexedDB (events, rituals, dismissals)
│           ├── store.ts      # Zustand lifecycle store
│           ├── demoSeed.ts   # Demo rituals
│           ├── _dev.ts       # DevTools helpers
│           └── components/   # Card, Panel, Timeline, ScriptViewer…
└── shared/                   # Types + IPC channel names shared across processes
```

---

## 🚀 Getting started

### Install

```bash
pnpm install
```

### Configure

Create a `.env` file in the project root (see `.env.example`):

```bash
OPENAI_API_KEY=sk-...
# Optional, for the chat sidebar:
# LLM_PROVIDER=anthropic
# ANTHROPIC_API_KEY=...
# LLM_MODEL=...
```

Ritual still works without a key; it just falls back to generic titles and summaries.

### Run

```bash
pnpm dev
```

### Other scripts

```bash
pnpm typecheck   # node + web TypeScript checks
pnpm lint
pnpm build       # typecheck + production build
pnpm build:win   # / build:mac / build:linux
```

---

## 🧪 Trying Ritual

Detection only fires when the same sequence appears in **more than one session**, so there are two ways to see it.

**The real way**

1. Run `pnpm dev`, then visit three or more sites in a row (for example `linear.app`, `notion.so`, `mail.google.com`).
2. Quit and relaunch the app (which starts a new session), then visit the same sites in the same order.
3. The Ritual card appears. Click **Remember the Ritual**, open the panel from the toolbar icon, and click **Run this**.

**The fast way (dev only)**

Open DevTools on the Ritual view; `window._ritualDev` exposes these helpers:

| Helper | What it does |
| --- | --- |
| `seed([...domains], n)` | Inserts `n` fake past sessions with that sequence. Browse the same sites afterwards to trigger detection. |
| `pokeCandidate([...domains])` | Shows the suggestion card immediately. |
| `seedDemo()` | Loads three pre-built demo Rituals into the panel. |
| `testAI([...domains])` | Runs metadata + Playwright generation and logs the result. |
| `snapshot()` | Prints the engine's buffer, session, and surfaced sequences. |
| `reset()` | Clears IndexedDB and resets the engine and store. |

---

## 🛠 Tech stack

Electron 37 · electron-vite · React 19 · TypeScript · Tailwind CSS · Zustand · IndexedDB (`idb`) · Vercel AI SDK (OpenAI / Anthropic)

---

## Design notes

- **Lightweight and modular:** collection lives in the main process, while detection, storage, and UI live in their own renderer. The pieces talk only through typed IPC channels in `src/shared/ritual-ipc.ts`.
- **Local-first:** browsing events never leave the machine. Only the short list of domains and page titles of an accepted Ritual is sent to the LLM.
- **Domain-level matching** keeps detection fast and resilient to URL noise (query strings, ids). The trade-off is that it ignores what you do *within* a page.

### Possible next steps

- Record DOM actions (clicks, form fills) so replay can perform the work, not just navigate.
- Use an AI web agent driven by the Ritual summary for steps that need judgment.
- Add time-based triggers ("every Monday at 9am").
- Allow fuzzy, non-contiguous sequence matching and editing of saved Rituals.
