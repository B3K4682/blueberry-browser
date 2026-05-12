import { contextBridge } from "electron";
import { electronAPI } from "@electron-toolkit/preload";
import { RITUAL_IPC } from "../shared/ritual-ipc";
import type {
  RitualCandidate,
  RitualMetadata,
  WorkflowEvent,
} from "../shared/ritual-types";

// Bridge between the ritual renderer and the main process.
const ritualAPI = {
  // Subscribes to WorkflowEvent emissions
  onEvent: (callback: (event: WorkflowEvent) => void): void => {
    electronAPI.ipcRenderer.on(RITUAL_IPC.EVENT_EMITTED, (_evt, payload) =>
      callback(payload as WorkflowEvent)
    );
  },

  // Tears down all event-emitted listeners
  removeEventListener: (): void => {
    electronAPI.ipcRenderer.removeAllListeners(RITUAL_IPC.EVENT_EMITTED);
  },

  // Signals to the collector that the renderer has subscribed and any queued events can now be flushed
  markReady: (): void => {
    electronAPI.ipcRenderer.send(RITUAL_IPC.RENDERER_READY);
  },

  // Asks the main-process AI Layer to produce metadata for a candidate.
  generateMetadata: (candidate: RitualCandidate): Promise<RitualMetadata> =>
    electronAPI.ipcRenderer.invoke(RITUAL_IPC.GENERATE_METADATA, candidate),

  // Asks main to render the candidate's events as a Playwright script.
  generatePlaywrightScript: (
    candidate: RitualCandidate,
    title: string
  ): Promise<string> =>
    electronAPI.ipcRenderer.invoke(
      RITUAL_IPC.GENERATE_PLAYWRIGHT,
      candidate,
      title
    ),
};

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld("electron", electronAPI);
    contextBridge.exposeInMainWorld("ritualAPI", ritualAPI);
  } catch (error) {
    console.error(error);
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI;
  // @ts-ignore (define in dts)
  window.ritualAPI = ritualAPI;
}
