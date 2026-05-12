import { ElectronAPI } from "@electron-toolkit/preload";
import type { ReplayState, RitualViewMode } from "../shared/ritual-ipc";
import type {
  RitualCandidate,
  RitualMetadata,
  WorkflowEvent,
} from "../shared/ritual-types";

interface RitualAPI {
  onEvent: (callback: (event: WorkflowEvent) => void) => void;
  removeEventListener: () => void;
  markReady: () => void;
  generateMetadata: (candidate: RitualCandidate) => Promise<RitualMetadata>;
  generatePlaywrightScript: (
    candidate: RitualCandidate,
    title: string
  ) => Promise<string>;
  setViewMode: (mode: RitualViewMode) => void;
  onPanelToggleRequested: (callback: () => void) => void;
  removePanelToggleListener: () => void;
  replayOpenTab: (url: string) => void;
  broadcastReplayState: (state: ReplayState) => void;
  onReplayStopRequested: (callback: () => void) => void;
  removeReplayStopRequestedListener: () => void;
}

declare global {
  interface Window {
    electron: ElectronAPI;
    ritualAPI: RitualAPI;
  }
}

export {};
