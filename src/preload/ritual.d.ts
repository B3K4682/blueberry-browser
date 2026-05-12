import { ElectronAPI } from "@electron-toolkit/preload";
import type { WorkflowEvent } from "../shared/ritual-types";

interface RitualAPI {
  onEvent: (callback: (event: WorkflowEvent) => void) => void;
  removeEventListener: () => void;
  markReady: () => void;
}

declare global {
  interface Window {
    electron: ElectronAPI;
    ritualAPI: RitualAPI;
  }
}

export {};
