import { ElectronAPI } from "@electron-toolkit/preload";
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
}

declare global {
  interface Window {
    electron: ElectronAPI;
    ritualAPI: RitualAPI;
  }
}

export {};
