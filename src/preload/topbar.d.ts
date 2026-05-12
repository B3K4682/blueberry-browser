import { ElectronAPI } from "@electron-toolkit/preload";
import type { TabInfo } from "../shared/types";

interface TopBarAPI {
  createTab: (url?: string) => Promise<{ id: string; title: string; url: string } | null>;
  closeTab: (tabId: string) => Promise<boolean>;
  switchTab: (tabId: string) => Promise<boolean>;
  getTabs: () => Promise<TabInfo[]>;

  navigateTab: (tabId: string, url: string) => Promise<void>;
  goBack: (tabId: string) => Promise<void>;
  goForward: (tabId: string) => Promise<void>;
  reload: (tabId: string) => Promise<void>;

  tabScreenshot: (tabId: string) => Promise<string | null>;
  tabRunJs: (tabId: string, code: string) => Promise<any>;

  toggleSidebar: () => Promise<void>;
  toggleRitualPanel: () => void;

  onTabsUpdated: (callback: (tabs: TabInfo[]) => void) => void;
  removeTabsUpdatedListener: () => void;
}

declare global {
  interface Window {
    electron: ElectronAPI;
    topBarAPI: TopBarAPI;
  }
}
