// "Ritual" IPC channels.
export const RITUAL_IPC = {
  // Ritual renderer -> main: renderer has finished mounting and is now subscribed to event-emitted.
  RENDERER_READY: "ritual:renderer-ready",

  // Main -> ritual renderer: a new normalized WorkflowEvent has been observed.
  EVENT_EMITTED: "ritual:event-emitted",

  // Ritual renderer -> main: ask main to call the AI for a candidate.
  GENERATE_METADATA: "ritual:generate-metadata",

  // Ritual renderer -> main: build a deterministic Playwright script for a
  // saved ritual's event sequence.
  GENERATE_PLAYWRIGHT: "ritual:generate-playwright",

  // Ritual renderer -> main: ask main to resize the ritual WebContentsView
  // to the appropriate mode: 'hidden' | 'card' | 'panel'.
  SET_VIEW_MODE: "ritual:set-view-mode",

  // TopBar renderer -> main: user clicked the toolbar ritual icon to toggle
  // the panel open/closed.
  TOGGLE_PANEL: "ritual:toggle-panel",

  // Main -> ritual renderer: forwarded TOGGLE_PANEL signal so the store
  // can flip its `isPanelOpen` flag.
  PANEL_TOGGLE_REQUESTED: "ritual:panel-toggle-requested",

  // Ritual renderer -> main -> topbar: real panel-open boolean so the
  // toolbar Sparkles icon stays in sync when the panel closes itself.
  PANEL_STATE_CHANGED: "ritual:panel-state-changed",

  // Main -> topbar renderer: replay state changed (banner needs to update).
  REPLAY_STATE: "ritual:replay-state",

  // Ritual renderer -> main: open a tab on a given URL during replay.
  REPLAY_OPEN_TAB: "ritual:replay-open-tab",

  // Ritual renderer -> main: replay was stopped from the renderer side.
  REPLAY_STOPPED: "ritual:replay-stopped",

  // TopBar renderer -> main: user clicked the Stop link in the replay banner.
  REPLAY_STOP_REQUESTED: "ritual:replay-stop-requested",
};

export type RitualViewMode = "hidden" | "card" | "panel";

// Live replay status broadcast to the topbar so the banner can render.
export interface ReplayState {
  active: boolean;
  ritualTitle: string;
  domainSequence: string[];
  currentStep: number;
  totalSteps: number;
  done: boolean;
}
