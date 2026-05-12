import { saveEvent, resetAllStores, getRituals } from "./storage";
import type { WorkflowEvent } from "@shared/ritual-types";
import type { DetectionEngine } from "./detection";


const ONE_DAY_MS = 24 * 60 * 60 * 1000;

// Seed sessions for development
async function seedHistoricalSessions(
  domainSequence: string[],
  sessions: number = 2
): Promise<void> {
  const titlesByDomain: Record<string, string> = {
    "linear.app": "Linear — Sprint Board",
    "notion.so": "Notion — Product Roadmap",
    "mail.google.com": "Inbox — Gmail",
    "github.com": "GitHub — Pull Requests",
    "figma.com": "Figma — Design",
  };

  for (let s = 0; s < sessions; s++) {
    const sessionId = `dev-session-${s}-${Date.now()}`;
    let timestamp = Date.now() - (sessions - s) * ONE_DAY_MS;
    for (const domain of domainSequence) {
      const event: WorkflowEvent = {
        id: crypto.randomUUID(),
        timestamp,
        type: "navigation",
        url: `https://${domain}/`,
        title: titlesByDomain[domain] ?? domain,
        domain,
        tabId: `dev-tab-${s}`,
        sessionId,
      };
      await saveEvent(event);
      timestamp += 5_000;
    }
  }
  console.log(
    `[dev] seeded ${sessions} historical session(s) for [${domainSequence.join(
      " > "
    )}]. Now browse the same sites in this session to trigger detection.`
  );
}

// Mounts the dev helpers on `window` so they can be invoked from DevTools
export function installDevHelpers(engine: DetectionEngine): void {
  if (!import.meta.env.DEV) return;

  const helpers = {
    engine,
    seed: seedHistoricalSessions,
    snapshot: () => engine.getDebugSnapshot(),
    rituals: () => getRituals(),
    reset: async () => {
      await resetAllStores();
      engine.reset();
      console.log("[dev] all stores cleared, engine reset");
    },
  };

  (window as unknown as { _ritualDev?: typeof helpers })._ritualDev = helpers;
  console.log(
    "[dev] window._ritualDev ready — try _ritualDev.seed(['linear.app','notion.so','gmail.com']) then browse those sites"
  );
}
