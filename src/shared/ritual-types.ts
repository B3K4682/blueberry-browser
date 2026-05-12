export type WorkflowEventType =
  | "tab_open"
  | "tab_switch"
  | "navigation"
  | "tab_close";

// One normalized browser action.
export interface WorkflowEvent {
  id: string;
  timestamp: number;
  type: WorkflowEventType;
  url: string;
  title: string;
  domain: string;
  tabId: string;
  sessionId: string;
}

// A single replay step inside a saved Ritual.
export interface RitualStep {
  order: number;
  domain: string;
  title: string;
  url: string;
}

// Transient object emitted by the Detection Engine when a repeated sequence is found.
export interface RitualCandidate {
  id: string;
  detectedAt: number;
  domainSequence: string[];
  occurrences: number;
  events: WorkflowEvent[];
  confidence: number;
}

// A user-confirmed Ritual, enriched with AI metadata + a generated Playwright script.
export interface Ritual {
  id: string;
  createdAt: number;
  lastRunAt: number | null;
  runCount: number;
  title: string;
  summary: string;
  steps: RitualStep[];
  domainSequence: string[];
  events: WorkflowEvent[];
  playwrightScript: string;
  automationIdeas: string[];
}

export interface RitualMetadata {
  title: string;
  summary: string;
  steps: RitualStep[];
  automationIdeas: string[];
}

// Internal dismissal record stored in IndexedDB.
export interface DismissalRecord {
  key: string;
  domainSequence: string[];
  dismissedAt: number;
}
