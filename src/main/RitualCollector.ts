import { ipcMain, WebContentsView } from "electron";
import { randomUUID } from "crypto";
import { RITUAL_IPC } from "../shared/ritual-ipc";
import type {
  WorkflowEvent,
  WorkflowEventType,
} from "../shared/ritual-types";
import type { Tab } from "./Tab";

const NAVIGATION_DEBOUNCE_MS = 500;

// URL schemes ignored.
const INTERNAL_URL_PREFIXES = [
  "chrome://",
  "chrome-extension://",
  "devtools://",
  "about:",
  "view-source:",
  "data:",
  "file://",
];

// Google domain ignored, bcos it's a default domain
const IGNORED_DOMAINS = new Set<string>(["google.com"]);

// Minimum partial shape passed to `emit`.
interface PartialEvent {
  type: WorkflowEventType;
  tabId: string;
  url: string;
  title: string;
}

export class RitualCollector {
  private readonly sessionId: string;
  private readonly ritualView: WebContentsView;
  private readonly debouncers = new Map<string, NodeJS.Timeout>();
  private readonly detachFns = new Map<string, () => void>();
  private readonly lastDomainPerTab = new Map<string, string>();
  private readonly queue: WorkflowEvent[] = [];
  private readonly readyListener: () => void;
  private rendererReady = false;
  private disposed = false;

  constructor(ritualView: WebContentsView) {
    this.sessionId = randomUUID();
    this.ritualView = ritualView;

    this.readyListener = () => {
      this.rendererReady = true;
      this.flushQueue();
    };
    ipcMain.once(RITUAL_IPC.RENDERER_READY, this.readyListener);

    console.log(`[ritual collector] session=${this.sessionId}`);
  }

  // Returns the session id minted on construction.
  get currentSessionId(): string {
    return this.sessionId;
  }

  // Hook a tab into the collector and emit its tab_open event.
  attachTab(tab: Tab): void {
    const detach = this.installTabListeners(tab);
    this.detachFns.set(tab.id, detach);
    this.recordTabOpen(tab);
  }

  // Inverse of attachTab.
  detachTab(tabId: string, lastUrl: string, lastTitle: string): void {
    const detach = this.detachFns.get(tabId);
    if (detach) {
      detach();
      this.detachFns.delete(tabId);
    }
    this.clearDebouncer(tabId);
    this.lastDomainPerTab.delete(tabId);

    // ? This is here, bcos the tab_close won't get Tab object
    this.emit({
      type: "tab_close",
      tabId,
      url: lastUrl,
      title: lastTitle,
    });
  }

  recordTabOpen(tab: Tab): void {
    this.emit({
      type: "tab_open",
      tabId: tab.id,
      url: tab.url,
      title: tab.title,
    });
  }

  recordTabSwitch(tab: Tab): void {
    this.emit({
      type: "tab_switch",
      tabId: tab.id,
      url: tab.url,
      title: tab.title,
    });
  }

  // Tear down all subscriptions.
  cleanup(): void {
    if (this.disposed) return;
    this.disposed = true;
    ipcMain.removeListener(RITUAL_IPC.RENDERER_READY, this.readyListener);
    this.detachFns.forEach((detach) => detach());
    this.detachFns.clear();
    this.debouncers.forEach((timer) => clearTimeout(timer));
    this.debouncers.clear();
    this.lastDomainPerTab.clear();
    this.queue.length = 0;
  }

  // Subscribes to per-tab webContents events that produce navigation events.
  private installTabListeners(tab: Tab): () => void {
    const onDidNavigate = (_event: unknown, url: string): void => {
      this.scheduleNavigation(tab, url);
    };
    const onDidNavigateInPage = (_event: unknown, url: string): void => {
      this.scheduleNavigation(tab, url);
    };

    tab.webContents.on("did-navigate", onDidNavigate);
    tab.webContents.on("did-navigate-in-page", onDidNavigateInPage);

    return () => {
      try {
        tab.webContents.removeListener("did-navigate", onDidNavigate);
        tab.webContents.removeListener(
          "did-navigate-in-page",
          onDidNavigateInPage
        );
      } catch {
        // webContents may already be destroyed during shutdown.
      }
    };
  }

  // Debounces navigation emits per-tab
  // for redirects to avoid spamming the ritual pipeline
  private scheduleNavigation(tab: Tab, url: string): void {
    if (!this.isCapturableUrl(url)) return;

    this.clearDebouncer(tab.id);
    const timer = setTimeout(() => {
      this.debouncers.delete(tab.id);

      const domain = this.extractDomain(url);
      if (!domain) return;
      if (this.lastDomainPerTab.get(tab.id) === domain) return;

      this.emit({
        type: "navigation",
        tabId: tab.id,
        url,
        title: tab.title,
      });
    }, NAVIGATION_DEBOUNCE_MS);
    this.debouncers.set(tab.id, timer);
  }

  private clearDebouncer(tabId: string): void {
    const existing = this.debouncers.get(tabId);
    if (existing) {
      clearTimeout(existing);
      this.debouncers.delete(tabId);
    }
  }

  private isCapturableUrl(url: string): boolean {
    if (!url) return false;
    const lower = url.toLowerCase();
    return !INTERNAL_URL_PREFIXES.some((prefix) => lower.startsWith(prefix));
  }

  private extractDomain(url: string): string {
    try {
      return new URL(url).hostname.replace(/^www\./, "");
    } catch {
      return "";
    }
  }

  private emit(partial: PartialEvent): void {
    if (partial.type !== "tab_close" && !this.isCapturableUrl(partial.url)) {
      return;
    }

    const domain = this.extractDomain(partial.url);
    if (partial.type !== "tab_close" && !domain) return;

    if (domain && IGNORED_DOMAINS.has(domain)) return;

    const event: WorkflowEvent = {
      id: randomUUID(),
      timestamp: Date.now(),
      type: partial.type,
      url: partial.url,
      title: partial.title || "Untitled",
      domain,
      tabId: partial.tabId,
      sessionId: this.sessionId,
    };

    if (event.type !== "tab_close" && domain) {
      this.lastDomainPerTab.set(partial.tabId, domain);
    }

    this.dispatch(event);
  }

  private dispatch(event: WorkflowEvent): void {
    if (!this.rendererReady) {
      this.queue.push(event);
      return;
    }
    this.send(event);
  }

  private flushQueue(): void {
    if (this.queue.length > 0) {
      console.log(
        `[ritual collector] flushing ${this.queue.length} queued event(s)`
      );
    }
    while (this.queue.length > 0) {
      const event = this.queue.shift()!;
      this.send(event);
    }
  }

  private send(event: WorkflowEvent): void {
    try {
      this.ritualView.webContents.send(RITUAL_IPC.EVENT_EMITTED, event);
    } catch {
      // Ritual view is being torn down — silently drop.
    }
  }
}
