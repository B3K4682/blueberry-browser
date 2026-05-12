import type { RitualCandidate, WorkflowEvent } from "@shared/ritual-types";
import {
  getEventsByDomains,
  getEventsBySession,
  isDismissed,
} from "./storage";

// Buffer size
const BUFFER_MAX = 50;

// Window sizes evaluated on every ingestion
const WINDOW_SIZES = [5, 4, 3] as const;

// Candidate debounce time
const CANDIDATE_DEBOUNCE_MS = 60_000;

// Confidence levels for each window size
const CONFIDENCE: Record<number, number> = {
  5: 1.0,
  4: 0.8,
  3: 0.6,
};

// Callback type for emitted candidates
export type DetectionCallback = (candidate: RitualCandidate) => void;

export class DetectionEngine {
  private buffer: WorkflowEvent[] = [];
  private currentSessionId: string | null = null;
  private callback: DetectionCallback | null = null;
  // Per-sequence cooldown so the same workflow doesn't spam the UI
  private readonly recentlyEmitted = new Map<string, number>();
  // Per-session memory: never show the same sequence twice this session
  private readonly surfacedThisSession = new Set<string>();
  // Domain sequences of rituals the user has already saved - never suggest these again
  private knownSequences: string[][] = [];
  // Re-entrancy guard so async storage queries from concurrent ingests can't double-emit a candidate
  private evaluating = false;

  // Registers the listener that receives every emitted candidate.
  onCandidate(callback: DetectionCallback): void {
    this.callback = callback;
  }

  // Tells the engine which domain sequences are already saved as rituals.
  setKnownSequences(seqs: string[][]): void {
    this.knownSequences = seqs.filter((s) => Array.isArray(s) && s.length > 0);
  }

  // Returns true if the candidate window is fully contained inside any saved ritual.
  private isKnown(windowDomains: string[]): boolean {
    for (const saved of this.knownSequences) {
      if (containsContiguous(saved, windowDomains)) return true;
    }
    return false;
  }

  // Resets transient state
  reset(): void {
    this.buffer = [];
    this.currentSessionId = null;
    this.recentlyEmitted.clear();
    this.surfacedThisSession.clear();
  }

  // Read-only window into the current detection state
  getDebugSnapshot(): {
    bufferSize: number;
    sessionId: string | null;
    domainSequence: string[];
    surfaced: string[];
  } {
    return {
      bufferSize: this.buffer.length,
      sessionId: this.currentSessionId,
      domainSequence: this.extractDomainSequence(this.buffer, true),
      surfaced: [...this.surfacedThisSession],
    };
  }

  // Main entry point. Called for every freshly persisted WorkflowEvent.
  async ingest(event: WorkflowEvent): Promise<void> {
    this.appendToBuffer(event);

    // Lock in the live session on the first event we see
    if (this.currentSessionId === null) {
      this.currentSessionId = event.sessionId;
    }

    if (event.type === "tab_close") return;

    if (this.evaluating) return;
    this.evaluating = true;
    try {
      await this.evaluate();
    } catch (err) {
      console.warn("[detection] evaluate failed:", err);
    } finally {
      this.evaluating = false;
    }
  }

  private appendToBuffer(event: WorkflowEvent): void {
    this.buffer.push(event);
    if (this.buffer.length > BUFFER_MAX) {
      this.buffer.shift();
    }
  }

  // Walks window sizes from largest to smallest and surfaces the first.
  private async evaluate(): Promise<void> {
    if (!this.currentSessionId || !this.callback) return;

    const seq = this.extractDomainSequence(this.buffer, true);

    for (const size of WINDOW_SIZES) {
      if (seq.length < size) continue;

      const windowDomains = seq.slice(-size);
      const key = sequenceKey(windowDomains);

      if (this.surfacedThisSession.has(key)) continue;

      const lastFired = this.recentlyEmitted.get(key) ?? 0;
      if (Date.now() - lastFired < CANDIDATE_DEBOUNCE_MS) continue;

      if (this.isKnown(windowDomains)) continue;

      if (await isDismissed(windowDomains)) continue;

      const historicalCount = await this.countHistoricalMatches(windowDomains);
      if (historicalCount < 1) continue;

      const candidate: RitualCandidate = {
        id: crypto.randomUUID(),
        detectedAt: Date.now(),
        domainSequence: windowDomains,
        occurrences: historicalCount + 1,
        events: this.collectRepresentativeEvents(windowDomains),
        confidence: CONFIDENCE[size] ?? 0.5,
      };

      this.recentlyEmitted.set(key, Date.now());
      this.surfacedThisSession.add(key);

      console.log(
        `[detection] candidate window=${key} occurrences=${candidate.occurrences} confidence=${candidate.confidence}`
      );
      this.callback(candidate);
      return;
    }
  }


  private extractDomainSequence(
    events: WorkflowEvent[],
    sessionScoped: boolean
  ): string[] {
    const out: string[] = [];
    for (const e of events) {
      if (e.type === "tab_close") continue;
      if (!e.domain) continue;
      if (sessionScoped && e.sessionId !== this.currentSessionId) continue;
      if (out[out.length - 1] === e.domain) continue;
      out.push(e.domain);
    }
    return out;
  }

  private async countHistoricalMatches(
    windowDomains: string[]
  ): Promise<number> {
    if (windowDomains.length === 0) return 0;

    const touched = await getEventsByDomains(windowDomains);
    const candidateSessions = new Set<string>();
    for (const e of touched) {
      if (e.sessionId !== this.currentSessionId) {
        candidateSessions.add(e.sessionId);
      }
    }

    let matches = 0;
    for (const sessionId of candidateSessions) {
      const sessionEvents = await getEventsBySession(sessionId);
      const sessionSeq = this.extractDomainSequence(sessionEvents, false);
      if (containsContiguous(sessionSeq, windowDomains)) {
        matches++;
      }
    }
    return matches;
  }

  private collectRepresentativeEvents(
    windowDomains: string[]
  ): WorkflowEvent[] {
    const liveSeqWithEvents: { event: WorkflowEvent; domain: string }[] = [];
    let lastDomain: string | null = null;

    for (const e of this.buffer) {
      if (e.type === "tab_close") continue;
      if (!e.domain) continue;
      if (e.sessionId !== this.currentSessionId) continue;
      if (e.domain !== lastDomain) {
        liveSeqWithEvents.push({ event: e, domain: e.domain });
        lastDomain = e.domain;
      }
    }

    return liveSeqWithEvents
      .slice(-windowDomains.length)
      .map((entry) => entry.event);
  }
}

function sequenceKey(domains: string[]): string {
  return domains.join(" > ");
}

// ? This function is hell to write, but it does the job
function containsContiguous(haystack: string[], needle: string[]): boolean {
  if (needle.length === 0 || needle.length > haystack.length) return false;
  outer: for (let i = 0; i <= haystack.length - needle.length; i++) {
    for (let j = 0; j < needle.length; j++) {
      if (haystack[i + j] !== needle[j]) {
        continue outer;
      }
    }
    return true;
  }
  return false;
}
