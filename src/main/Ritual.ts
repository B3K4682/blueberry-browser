import { is } from "@electron-toolkit/utils";
import { BaseWindow, ipcMain, WebContentsView } from "electron";
import { join } from "path";
import { RITUAL_IPC, type RitualViewMode } from "../shared/ritual-ipc";
import { RitualAI } from "./RitualAI";
import type { RitualCandidate } from "../shared/ritual-types";

const PANEL_WIDTH = 480;
const CARD_WIDTH = 380;
const CARD_HEIGHT = 220;
// Extra transparent margin around the card so the drop-shadow renders.
const CARD_SHADOW_PAD = 24;
const CARD_VIEW_WIDTH = CARD_WIDTH + CARD_SHADOW_PAD * 2;
const CARD_VIEW_HEIGHT = CARD_HEIGHT + CARD_SHADOW_PAD * 2;
const TOPBAR_HEIGHT = 88;

export class Ritual {
  private webContentsView: WebContentsView;
  private baseWindow: BaseWindow;
  private mode: RitualViewMode = "hidden";
  private replayBannerOffset = 0;
  private readonly ai: RitualAI;
  private viewModeListener:
    | ((_evt: Electron.IpcMainEvent, mode: RitualViewMode) => void)
    | null = null;
  private togglePanelListener: ((_evt: Electron.IpcMainEvent) => void) | null =
    null;

  constructor(baseWindow: BaseWindow) {
    this.baseWindow = baseWindow;
    this.webContentsView = this.createWebContentsView();
    baseWindow.contentView.addChildView(this.webContentsView);
    this.applyBounds();

    this.ai = new RitualAI();
    this.registerIpcHandlers();
  }

  // Returns the underlying view so the Window can re-stack it above newly
  // created tabs (a tab added via addChildView would otherwise cover us).
  get view(): WebContentsView {
    return this.webContentsView;
  }

  // Active surface mode. The renderer asks for transitions via IPC, the main
  // process applies the geometry.
  get currentMode(): RitualViewMode {
    return this.mode;
  }

  // Pushes the ritual view to the front of the z-stack. Called by Window
  // after creating a tab so the Card/Panel keeps overlaying web content.
  bringToFront(): void {
    this.baseWindow.contentView.addChildView(this.webContentsView);
  }

  // Switches the surface and re-applies the matching bounds. No-op if the
  // mode is unchanged so we don't spam Electron with redundant geometry.
  setViewMode(mode: RitualViewMode): void {
    if (this.mode === mode) return;
    this.mode = mode;
    this.applyBounds();
    if (mode !== "hidden") {
      this.bringToFront();
    }
  }

  // The topbar grows by ~40px during replay. Window forwards the offset so
  // the ritual surfaces stay aligned with the visible browser chrome.
  setReplayBannerOffset(offsetPx: number): void {
    if (this.replayBannerOffset === offsetPx) return;
    this.replayBannerOffset = offsetPx;
    this.applyBounds();
  }

  // Recompute bounds whenever the window resizes. Called from Window.
  updateBounds(): void {
    this.applyBounds();
  }

  private createWebContentsView(): WebContentsView {
    const view = new WebContentsView({
      webPreferences: {
        preload: join(__dirname, "../preload/ritual.js"),
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: false,
        transparent: true,
      },
    });

    // Transparent background lets the floating Card visually overlay web
    // content. The renderer paints its own surfaces with rounded corners.
    view.setBackgroundColor("#00000000");

    // TODO: Remove this after development
    view.webContents.openDevTools({mode: "detach"});

    if (is.dev && process.env["ELECTRON_RENDERER_URL"]) {
      const url = new URL("/ritual/", process.env["ELECTRON_RENDERER_URL"]);
      view.webContents.loadURL(url.toString());
    } else {
      view.webContents.loadFile(join(__dirname, "../renderer/ritual.html"));
    }

    return view;
  }

  private applyBounds(): void {
    const { width, height } = this.baseWindow.getBounds();
    const topOffset = TOPBAR_HEIGHT + this.replayBannerOffset;

    switch (this.mode) {
      case "hidden":
        // Zero-size keeps the renderer alive (IndexedDB stays open) without
        // capturing any input or paint area.
        this.webContentsView.setBounds({ x: 0, y: 0, width: 0, height: 0 });
        break;

      case "card":
        // Bottom-right anchor; the shadow pad acts as both gutter and shadow room.
        this.webContentsView.setBounds({
          x: Math.max(0, width - CARD_VIEW_WIDTH),
          y: Math.max(topOffset, height - CARD_VIEW_HEIGHT),
          width: CARD_VIEW_WIDTH,
          height: CARD_VIEW_HEIGHT,
        });
        break;

      case "panel":
        // Full-height right-side sidebar — sits to the right of the tab
        // content, replacing the chat sidebar visually when both are open.
        this.webContentsView.setBounds({
          x: Math.max(0, width - PANEL_WIDTH),
          y: topOffset,
          width: PANEL_WIDTH,
          height: Math.max(0, height - topOffset),
        });
        break;
    }
  }

  // Registers the main-process IPC handlers the ritual renderer talks to.
  private registerIpcHandlers(): void {
    ipcMain.handle(
      RITUAL_IPC.GENERATE_METADATA,
      async (_evt, candidate: RitualCandidate) =>
        this.ai.generateMetadata(candidate)
    );

    ipcMain.handle(
      RITUAL_IPC.GENERATE_PLAYWRIGHT,
      (_evt, candidate: RitualCandidate, title: string) =>
        this.ai.generatePlaywrightScript(candidate, title)
    );

    // the store calls this on every visibility change
    this.viewModeListener = (_evt, mode) => this.setViewMode(mode);
    ipcMain.on(RITUAL_IPC.SET_VIEW_MODE, this.viewModeListener);

    // Topbar toolbar button -> forward into ritual renderer's store
    this.togglePanelListener = () => this.forwardPanelToggle();
    ipcMain.on(RITUAL_IPC.TOGGLE_PANEL, this.togglePanelListener);
  }

  // Forwards a toolbar-icon click to the ritual renderer's store.
  private forwardPanelToggle(): void {
    try {
      this.webContentsView.webContents.send(RITUAL_IPC.PANEL_TOGGLE_REQUESTED);
    } catch (err) {
      console.error("[ritual] forwardPanelToggle failed:", err);
    }
  }

  destroy(): void {
    try {
      ipcMain.removeHandler(RITUAL_IPC.GENERATE_METADATA);
      ipcMain.removeHandler(RITUAL_IPC.GENERATE_PLAYWRIGHT);
      if (this.viewModeListener) {
        ipcMain.removeListener(RITUAL_IPC.SET_VIEW_MODE, this.viewModeListener);
        this.viewModeListener = null;
      }
      if (this.togglePanelListener) {
        ipcMain.removeListener(
          RITUAL_IPC.TOGGLE_PANEL,
          this.togglePanelListener
        );
        this.togglePanelListener = null;
      }
    } catch {
      // Handlers may already be removed if destroy is called twice.
    }
    try {
      this.webContentsView.webContents.close();
    } catch {
      // View may already be torn down during window-close.
    }
  }
}
