import { BaseWindow, shell } from "electron";
import { Tab } from "./Tab";
import { TopBar } from "./TopBar";
import { SideBar } from "./SideBar";
import { Ritual } from "./Ritual";
import { IPC } from "../shared/ipc-channels";
import type { TabInfo } from "../shared/types";

export class Window {
  private _baseWindow: BaseWindow;
  private tabsMap: Map<string, Tab> = new Map();
  private activeTabId: string | null = null;
  private tabCounter: number = 0;
  private _topBar: TopBar;
  private _sideBar: SideBar;
  private _ritual: Ritual;

  constructor() {
    this._baseWindow = new BaseWindow({
      width: 1000,
      height: 800,
      show: true,
      autoHideMenuBar: false,
      titleBarStyle: "hidden",
      ...(process.platform !== "darwin" ? { titleBarOverlay: true } : {}),
      trafficLightPosition: { x: 15, y: 13 },
    });

    this._baseWindow.setMinimumSize(1000, 800);

    this._topBar = new TopBar(this._baseWindow);
    this._sideBar = new SideBar(this._baseWindow);
    this._ritual = new Ritual(this._baseWindow);

    this._sideBar.client.setWindow(this);

    this.createTab();

    this._baseWindow.on("resize", () => {
      this.updateTabBounds();
      this._topBar.updateBounds();
      this._sideBar.updateBounds();
      this._ritual.updateBounds();

      const bounds = this._baseWindow.getBounds();
      if (this.activeTab) {
        this.activeTab.webContents.send(IPC.WINDOW_RESIZED, {
          width: bounds.width,
          height: bounds.height,
        });
      }
    });

    this._baseWindow.on("closed", () => {
      this.tabsMap.forEach((tab) => tab.destroy());
      this.tabsMap.clear();
    });
  }

  get baseWindow(): BaseWindow {
    return this._baseWindow;
  }

  get activeTab(): Tab | null {
    if (this.activeTabId) {
      return this.tabsMap.get(this.activeTabId) || null;
    }
    return null;
  }

  get allTabs(): Tab[] {
    return Array.from(this.tabsMap.values());
  }

  get tabCount(): number {
    return this.tabsMap.size;
  }

  get sidebar(): SideBar {
    return this._sideBar;
  }

  get topBar(): TopBar {
    return this._topBar;
  }

  get ritual(): Ritual {
    return this._ritual;
  }

  // Serializes current tab state for IPC
  getTabsInfo(): TabInfo[] {
    return this.allTabs.map((tab) => ({
      id: tab.id,
      title: tab.title,
      url: tab.url,
      isActive: this.activeTabId === tab.id,
    }));
  }

  createTab(url?: string): Tab {
    const tabId = `tab-${++this.tabCounter}`;
    const tab = new Tab(tabId, url);

    this._baseWindow.contentView.addChildView(tab.view);

    const bounds = this._baseWindow.getBounds();
    const sidebarWidth = this._sideBar.getIsVisible() ? 400 : 0;
    tab.view.setBounds({
      x: 0,
      y: 88,
      width: bounds.width - sidebarWidth,
      height: bounds.height - 88,
    });

    // Open external links in the OS browser
    tab.webContents.setWindowOpenHandler((details) => {
      shell.openExternal(details.url);
      return { action: "deny" };
    });

    // Push tab state changes to the topbar
    tab.webContents.on("page-title-updated", () => this.notifyTabsChanged());
    tab.webContents.on("did-navigate", () => this.notifyTabsChanged());
    tab.webContents.on("did-navigate-in-page", () => this.notifyTabsChanged());

    this.tabsMap.set(tabId, tab);

    if (this.tabsMap.size === 1) {
      this.switchActiveTab(tabId);
    } else {
      tab.hide();
    }

    // Keep the ritual surfaces visually on top of newly added tabs.
    this._ritual.bringToFront();

    this.notifyTabsChanged();
    return tab;
  }

  closeTab(tabId: string): boolean {
    const tab = this.tabsMap.get(tabId);
    if (!tab) return false;

    this._baseWindow.contentView.removeChildView(tab.view);
    tab.destroy();
    this.tabsMap.delete(tabId);

    if (this.activeTabId === tabId) {
      this.activeTabId = null;
      const remainingTabs = Array.from(this.tabsMap.keys());
      if (remainingTabs.length > 0) {
        this.switchActiveTab(remainingTabs[0]);
      }
    }

    if (this.tabsMap.size === 0) {
      this._baseWindow.close();
    }

    this.notifyTabsChanged();
    return true;
  }

  switchActiveTab(tabId: string): boolean {
    const tab = this.tabsMap.get(tabId);
    if (!tab) return false;

    if (this.activeTabId && this.activeTabId !== tabId) {
      const currentTab = this.tabsMap.get(this.activeTabId);
      if (currentTab) currentTab.hide();
    }

    tab.show();
    this.activeTabId = tabId;
    this._baseWindow.setTitle(tab.title || "Blueberry Browser");

    this.notifyTabsChanged();
    return true;
  }

  getTab(tabId: string): Tab | null {
    return this.tabsMap.get(tabId) || null;
  }

  updateAllBounds(): void {
    this.updateTabBounds();
    this._sideBar.updateBounds();
  }

  private updateTabBounds(): void {
    const bounds = this._baseWindow.getBounds();
    const sidebarWidth = this._sideBar.getIsVisible() ? 400 : 0;

    this.tabsMap.forEach((tab) => {
      tab.view.setBounds({
        x: 0,
        y: 88,
        width: bounds.width - sidebarWidth,
        height: bounds.height - 88,
      });
    });
  }

  // Pushes serialized tab state to the topbar renderer
  private notifyTabsChanged(): void {
    try {
      this._topBar.view.webContents.send(IPC.TABS_UPDATED, this.getTabsInfo());
    } catch {
      // Topbar webContents may be destroyed during shutdown
    }
  }
}
