import { contextBridge } from "electron";
import { electronAPI } from "@electron-toolkit/preload";

// Preload for the ritual renderer. In Step 1 we expose nothing project-
// specific yet — the renderer only needs IndexedDB, which it already has.
// Subsequent steps will hang `ritualAPI` on the window with IPC channels
// for events, AI calls, view-mode requests, and replay.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld("electron", electronAPI);
  } catch (error) {
    console.error(error);
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI;
}
