import { ElectronAPI } from "@electron-toolkit/preload";

// Will grow as later steps add IPC channels (events, AI, view mode, replay).
declare global {
  interface Window {
    electron: ElectronAPI;
  }
}

export {};
