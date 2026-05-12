import { create } from "zustand";
import { generateMetadata, generatePlaywrightScript } from "./ai";
import {
  getRituals,
  saveDismissal,
  saveRitual as persistRitual,
  updateRitual,
} from "./storage";
import type { RitualViewMode } from "@shared/ritual-ipc";
import type { Ritual, RitualCandidate } from "@shared/ritual-types";

export interface RitualStore {
  // Live state
  currentCandidate: RitualCandidate | null;
  isCardVisible: boolean;
  isGenerating: boolean;
  // Set briefly after a save so the Card can render its confirmation state.
  recentlySavedRitual: Ritual | null;

  // Panel state
  isPanelOpen: boolean;

  // Saved data
  rituals: Ritual[];

  // Replay state
  activeReplay: { ritualId: string; currentStep: number } | null;

  // Actions

  // Detection Engine hands us a candidate.
  showCandidate: (candidate: RitualCandidate) => void;

  // User clicked "Not now" — records a dismissal.
  dismissCandidate: () => Promise<void>;

  // Internal: hide the card without recording a dismissal.
  clearCandidate: () => void;

  // User clicked "Remember it".
  saveRitual: (candidate: RitualCandidate) => Promise<void>;

  // Open / close / toggle the right-side panel.
  closePanel: () => void;
  togglePanel: () => void;

  // User clicked "Run this".
  replayRitual: (ritualId: string) => Promise<void>;

  // Hydrates `rituals` from IndexedDB on app boot.
  loadRituals: () => Promise<void>;
}

export const useRitualStore = create<RitualStore>((set, get) => ({
  currentCandidate: null,
  isCardVisible: false,
  isGenerating: false,
  recentlySavedRitual: null,
  isPanelOpen: false,
  rituals: [],
  activeReplay: null,

  showCandidate: (candidate) => {
    const { currentCandidate, isGenerating, isPanelOpen } = get();
    if (currentCandidate !== null || isGenerating) return;
    // Don't slide a card under the panel — it would be hidden anyway.
    if (isPanelOpen) return;
    set({ currentCandidate: candidate, isCardVisible: true });
  },

  dismissCandidate: async () => {
    const candidate = get().currentCandidate;
    if (!candidate) return;
    try {
      await saveDismissal(candidate.domainSequence);
    } catch (err) {
      console.error("[ritual store] saveDismissal failed:", err);
    }
    set({
      currentCandidate: null,
      isCardVisible: false,
      recentlySavedRitual: null,
    });
  },

  clearCandidate: () => {
    set({
      currentCandidate: null,
      isCardVisible: false,
      recentlySavedRitual: null,
    });
  },

  saveRitual: async (candidate) => {
    set({ isGenerating: true });
    try {
      const metadata = await generateMetadata(candidate);
      const playwrightScript = await generatePlaywrightScript(
        candidate,
        metadata.title
      );

      const ritual: Ritual = {
        id: crypto.randomUUID(),
        createdAt: Date.now(),
        lastRunAt: null,
        runCount: 0,
        title: metadata.title,
        summary: metadata.summary,
        steps: metadata.steps,
        domainSequence: candidate.domainSequence,
        events: candidate.events,
        playwrightScript,
        automationIdeas: metadata.automationIdeas,
      };

      await persistRitual(ritual);

      set((state) => ({
        rituals: [ritual, ...state.rituals],
        isGenerating: false,
        recentlySavedRitual: ritual,
      }));

      console.log(`[ritual store] saved "${ritual.title}"`);
    } catch (err) {
      console.error("[ritual store] saveRitual failed:", err);
      set({ isGenerating: false });
    }
  },

  closePanel: () => {
    set({ isPanelOpen: false });
  },

  togglePanel: () => {
    const { isPanelOpen, isGenerating } = get();
    if (isGenerating) return;
    if (isPanelOpen) {
      set({ isPanelOpen: false });
    } else {
      set({
        isPanelOpen: true,
        currentCandidate: null,
        isCardVisible: false,
        recentlySavedRitual: null,
      });
    }
  },

  replayRitual: async (ritualId) => {
    const ritual = get().rituals.find((r) => r.id === ritualId);
    if (!ritual) {
      console.warn(`[ritual store] replayRitual: unknown id ${ritualId}`);
      return;
    }

    set({ activeReplay: { ritualId, currentStep: 0 } });
    console.log(`[ritual store] replay requested: "${ritual.title}"`);

    const lastRunAt = Date.now();
    const runCount = ritual.runCount + 1;
    try {
      await updateRitual(ritualId, { lastRunAt, runCount });
      set((state) => ({
        rituals: state.rituals.map((r) =>
          r.id === ritualId ? { ...r, lastRunAt, runCount } : r
        ),
      }));
    } catch (err) {
      console.error("[ritual store] failed to bump replay stats:", err);
    }
  },

  loadRituals: async () => {
    try {
      const rituals = await getRituals();
      set({ rituals });
      console.log(`[ritual store] loaded ${rituals.length} saved ritual(s)`);
    } catch (err) {
      console.error("[ritual store] loadRituals failed:", err);
    }
  },
}));

// ? Sometimes the panel is open and card is visible, we needed to sync the view mode to main
function deriveViewMode(s: RitualStore): RitualViewMode {
  if (s.isPanelOpen) return "panel";
  if (s.isCardVisible) return "card";
  return "hidden";
}

let lastSyncedMode: RitualViewMode = "hidden";
useRitualStore.subscribe((state) => {
  const next = deriveViewMode(state);
  if (next === lastSyncedMode) return;
  lastSyncedMode = next;
  if (typeof window !== "undefined" && window.ritualAPI) {
    window.ritualAPI.setViewMode(next);
  }
});
