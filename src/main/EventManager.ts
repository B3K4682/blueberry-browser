import { ipcMain, WebContents } from "electron";
import { IPC } from "../shared/ipc-channels";
import { RITUAL_IPC, type ReplayState } from "../shared/ritual-ipc";
import type { Window } from "./Window";

const REPLAY_BANNER_PX = 40;

export class EventManager {
  private mainWindow: Window;
  private readonly registeredHandles: string[] = [];
  private readonly registeredListeners: { channel: string; handler: (...args: any[]) => void }[] = [];

  constructor(mainWindow: Window) {
    this.mainWindow = mainWindow;
    this.setupEventHandlers();
  }

  // Wraps ipcMain.handle and tracks the channel for cleanup
  private handle(channel: string, handler: (...args: any[]) => any): void {
    ipcMain.handle(channel, handler);
    this.registeredHandles.push(channel);
  }

  // Wraps ipcMain.on and tracks the channel/handler for cleanup
  private on(channel: string, handler: (...args: any[]) => void): void {
    ipcMain.on(channel, handler);
    this.registeredListeners.push({ channel, handler });
  }

  private setupEventHandlers(): void {
    this.handleTabEvents();
    this.handleSidebarEvents();
    this.handlePageContentEvents();
    this.handleDarkModeEvents();
    this.handleRitualReplayEvents();
  }

  private handleTabEvents(): void {
    // Create tab event
    this.handle(IPC.CREATE_TAB, (_, url?: string) => {
      const newTab = this.mainWindow.createTab(url);
      return { id: newTab.id, title: newTab.title, url: newTab.url };
    });

    // Close tab event
    this.handle(IPC.CLOSE_TAB, (_, id: string) => {
      this.mainWindow.closeTab(id);
    });

    // Switch tab event
    this.handle(IPC.SWITCH_TAB, (_, id: string) => {
      this.mainWindow.switchActiveTab(id);
    });

    // Get tabs event
    this.handle(IPC.GET_TABS, () => {
      return this.mainWindow.getTabsInfo();
    });

    // Navigate tab event
    this.handle(IPC.NAVIGATE_TAB, async (_, tabId: string, url: string) => {
      const tab = this.mainWindow.getTab(tabId);
      if (tab) {
        await tab.loadURL(url);
        return true;
      }
      return false;
    });

    this.handle(IPC.TAB_GO_BACK, (_, tabId: string) => {
      const tab = this.mainWindow.getTab(tabId);
      if (tab) {
        tab.goBack();
        return true;
      }
      return false;
    });

    this.handle(IPC.TAB_GO_FORWARD, (_, tabId: string) => {
      const tab = this.mainWindow.getTab(tabId);
      if (tab) {
        tab.goForward();
        return true;
      }
      return false;
    });

    this.handle(IPC.TAB_RELOAD, (_, tabId: string) => {
      const tab = this.mainWindow.getTab(tabId);
      if (tab) {
        tab.reload();
        return true;
      }
      return false;
    });

    this.handle(IPC.TAB_SCREENSHOT, async (_, tabId: string) => {
      const tab = this.mainWindow.getTab(tabId);
      if (tab) {
        const image = await tab.screenshot();
        return image.toDataURL();
      }
      return null;
    });

    this.handle(IPC.TAB_RUN_JS, async (_, tabId: string, code: string) => {
      const tab = this.mainWindow.getTab(tabId);
      if (tab) {
        return await tab.runJs(code);
      }
      return null;
    });

    this.handle(IPC.GET_ACTIVE_TAB_INFO, () => {
      const activeTab = this.mainWindow.activeTab;
      if (activeTab) {
        return {
          id: activeTab.id,
          url: activeTab.url,
          title: activeTab.title,
          canGoBack: activeTab.webContents.canGoBack(),
          canGoForward: activeTab.webContents.canGoForward(),
        };
      }
      return null;
    });
  }

  private handleSidebarEvents(): void {
    this.handle(IPC.TOGGLE_SIDEBAR, () => {
      this.mainWindow.sidebar.toggle();
      this.mainWindow.updateAllBounds();
      return true;
    });

    this.handle(IPC.CHAT_SEND_MESSAGE, async (_, request) => {
      await this.mainWindow.sidebar.client.sendChatMessage(request);
    });

    this.handle(IPC.CHAT_CLEAR, () => {
      this.mainWindow.sidebar.client.clearMessages();
      return true;
    });

    this.handle(IPC.CHAT_GET_MESSAGES, () => {
      return this.mainWindow.sidebar.client.getMessages();
    });
  }

  private handlePageContentEvents(): void {
    this.handle(IPC.GET_PAGE_CONTENT, async () => {
      if (this.mainWindow.activeTab) {
        try {
          return await this.mainWindow.activeTab.getTabHtml();
        } catch (error) {
          console.error("Error getting page content:", error);
          return null;
        }
      }
      return null;
    });

    this.handle(IPC.GET_PAGE_TEXT, async () => {
      if (this.mainWindow.activeTab) {
        try {
          return await this.mainWindow.activeTab.getTabText();
        } catch (error) {
          console.error("Error getting page text:", error);
          return null;
        }
      }
      return null;
    });

    this.handle(IPC.GET_CURRENT_URL, () => {
      if (this.mainWindow.activeTab) {
        return this.mainWindow.activeTab.url;
      }
      return null;
    });
  }

  private handleDarkModeEvents(): void {
    this.on(IPC.DARK_MODE_CHANGED, (event, isDarkMode) => {
      this.broadcastDarkMode(event.sender, isDarkMode);
    });
  }

  // Wires the three replay IPC flows that need access to the Window
  private handleRitualReplayEvents(): void {
    this.on(RITUAL_IPC.REPLAY_OPEN_TAB, (_evt, url: string) => {
      if (typeof url !== "string" || url.length === 0) return;
      try {
        this.mainWindow.openOrFocusTab(url);
      } catch (err) {
        console.error("[replay] openOrFocusTab failed for", url, err);
      }
    });

    this.on(RITUAL_IPC.REPLAY_STATE, (_evt, state: ReplayState) => {
      const targetBanner = state.active && !state.done ? REPLAY_BANNER_PX : 0;
      this.mainWindow.setReplayBannerHeight(targetBanner);
      try {
        this.mainWindow.topBar.view.webContents.send(
          RITUAL_IPC.REPLAY_STATE,
          state
        );
      } catch (err) {
        console.error("[replay] failed to forward state to topbar:", err);
      }
    });

    this.on(RITUAL_IPC.REPLAY_STOP_REQUESTED, () => {
      try {
        this.mainWindow.ritual.view.webContents.send(
          RITUAL_IPC.REPLAY_STOP_REQUESTED
        );
      } catch (err) {
        console.error("[replay] failed to forward stop to ritual:", err);
      }
    });

    // Real panel-open state from the ritual renderer -> topbar icon
    this.on(RITUAL_IPC.PANEL_STATE_CHANGED, (_evt, open: boolean) => {
      try {
        this.mainWindow.topBar.view.webContents.send(
          RITUAL_IPC.PANEL_STATE_CHANGED,
          Boolean(open)
        );
      } catch (err) {
        console.error("[ritual] failed to forward panel state:", err);
      }
    });
  }

  private broadcastDarkMode(sender: WebContents, isDarkMode: boolean): void {
    if (this.mainWindow.topBar.view.webContents !== sender) {
      this.mainWindow.topBar.view.webContents.send(IPC.DARK_MODE_UPDATED, isDarkMode);
    }

    if (this.mainWindow.sidebar.view.webContents !== sender) {
      this.mainWindow.sidebar.view.webContents.send(IPC.DARK_MODE_UPDATED, isDarkMode);
    }

    this.mainWindow.allTabs.forEach((tab) => {
      if (tab.webContents !== sender) {
        tab.webContents.send(IPC.DARK_MODE_UPDATED, isDarkMode);
      }
    });
  }

  // Removes only the handlers/listeners registered by this instance
  public cleanup(): void {
    for (const channel of this.registeredHandles) {
      ipcMain.removeHandler(channel);
    }
    for (const { channel, handler } of this.registeredListeners) {
      ipcMain.removeListener(channel, handler);
    }
    this.registeredHandles.length = 0;
    this.registeredListeners.length = 0;
  }
}
