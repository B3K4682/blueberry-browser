import { contextBridge } from "electron";
import { electronAPI } from "@electron-toolkit/preload";
import { IPC } from "../shared/ipc-channels";
import { RITUAL_IPC, type ReplayState } from "../shared/ritual-ipc";
import type { TabInfo } from "../shared/types";

const topBarAPI = {
  createTab: (url?: string) =>
    electronAPI.ipcRenderer.invoke(IPC.CREATE_TAB, url),
  closeTab: (tabId: string) =>
    electronAPI.ipcRenderer.invoke(IPC.CLOSE_TAB, tabId),
  switchTab: (tabId: string) =>
    electronAPI.ipcRenderer.invoke(IPC.SWITCH_TAB, tabId),
  getTabs: () => electronAPI.ipcRenderer.invoke(IPC.GET_TABS),

  navigateTab: (tabId: string, url: string) =>
    electronAPI.ipcRenderer.invoke(IPC.NAVIGATE_TAB, tabId, url),
  goBack: (tabId: string) =>
    electronAPI.ipcRenderer.invoke(IPC.TAB_GO_BACK, tabId),
  goForward: (tabId: string) =>
    electronAPI.ipcRenderer.invoke(IPC.TAB_GO_FORWARD, tabId),
  reload: (tabId: string) =>
    electronAPI.ipcRenderer.invoke(IPC.TAB_RELOAD, tabId),

  tabScreenshot: (tabId: string) =>
    electronAPI.ipcRenderer.invoke(IPC.TAB_SCREENSHOT, tabId),
  tabRunJs: (tabId: string, code: string) =>
    electronAPI.ipcRenderer.invoke(IPC.TAB_RUN_JS, tabId, code),

  toggleSidebar: () =>
    electronAPI.ipcRenderer.invoke(IPC.TOGGLE_SIDEBAR),

  // Tells main the ritual panel should open or close.
  toggleRitualPanel: () => {
    electronAPI.ipcRenderer.send(RITUAL_IPC.TOGGLE_PANEL);
  },

  // Subscribes to replay-state broadcasts so the banner can render progress.
  onReplayState: (callback: (state: ReplayState) => void) => {
    electronAPI.ipcRenderer.on(RITUAL_IPC.REPLAY_STATE, (_, state) =>
      callback(state as ReplayState)
    );
  },
  removeReplayStateListener: () => {
    electronAPI.ipcRenderer.removeAllListeners(RITUAL_IPC.REPLAY_STATE);
  },

  // User clicked Stop in the replay banner.
  stopReplay: () => {
    electronAPI.ipcRenderer.send(RITUAL_IPC.REPLAY_STOP_REQUESTED);
  },

  // Event-driven tab updates from main process
  onTabsUpdated: (callback: (tabs: TabInfo[]) => void) => {
    electronAPI.ipcRenderer.on(IPC.TABS_UPDATED, (_, tabs) => callback(tabs));
  },
  removeTabsUpdatedListener: () => {
    electronAPI.ipcRenderer.removeAllListeners(IPC.TABS_UPDATED);
  },
};

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld("electron", electronAPI);
    contextBridge.exposeInMainWorld("topBarAPI", topBarAPI);
  } catch (error) {
    console.error(error);
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI;
  // @ts-ignore (define in dts)
  window.topBarAPI = topBarAPI;
}
