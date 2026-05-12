import { saveRitual } from "./storage";
import { generatePlaywrightScript } from "./ai";
import type {
  Ritual,
  RitualCandidate,
  WorkflowEvent,
} from "@shared/ritual-types";

interface DemoSpec {
  title: string;
  summary: string;
  domainSequence: string[];
  pageTitles: Record<string, string>;
  automationIdeas: string[];
  daysAgo: number;
  runCount: number;
}

const DEMOS: DemoSpec[] = [
  {
    title: "Morning standup prep",
    summary: "Quick scan of the inbox, today's sprint board, and the team's product doc before standup.",
    domainSequence: ["mail.google.com", "linear.app", "notion.so"],
    pageTitles: {
      "mail.google.com": "Inbox · Gmail",
      "linear.app": "Sprint Board · Linear",
      "notion.so": "Product Roadmap · Notion",
    },
    automationIdeas: [
      "Run before 9:30am to have everything ready when standup starts.",
      "Pin the three tabs after the routine so they survive the day.",
    ],
    daysAgo: 0,
    runCount: 8,
  },
  {
    title: "Pull request review pass",
    summary: "Triage the GitHub PR queue, jump into the linked Linear ticket, then check Figma for the latest design.",
    domainSequence: ["github.com", "linear.app", "figma.com"],
    pageTitles: {
      "github.com": "Pull Requests · GitHub",
      "linear.app": "Issues assigned to me · Linear",
      "figma.com": "Design · Figma",
    },
    automationIdeas: [
      "Trigger this when a new PR mentions you to skip the manual lookup.",
      "Capture the ticket + PR link pair as a draft review comment.",
    ],
    daysAgo: 2,
    runCount: 12,
  },
  {
    title: "Friday metrics review",
    summary: "Open the analytics dashboard, then the team's weekly Slack channel, then the Notion retro page.",
    domainSequence: ["app.amplitude.com", "slack.com", "notion.so"],
    pageTitles: {
      "app.amplitude.com": "Weekly Metrics · Amplitude",
      "slack.com": "#team-product · Slack",
      "notion.so": "Weekly Retro · Notion",
    },
    automationIdeas: [
      "Schedule a 15-minute Friday block to walk the dashboards.",
      "Auto-paste this week's top metric into the retro doc.",
    ],
    daysAgo: 6,
    runCount: 3,
  },
];

function syntheticEvents(
  domainSequence: string[],
  pageTitles: Record<string, string>
): WorkflowEvent[] {
  const sessionId = `demo-${crypto.randomUUID()}`;
  const base = Date.now() - 60_000;
  return domainSequence.map((domain, i) => ({
    id: crypto.randomUUID(),
    timestamp: base + i * 5_000,
    type: "navigation",
    url: `https://${domain}/`,
    title: pageTitles[domain] ?? domain,
    domain,
    tabId: `demo-tab-${i}`,
    sessionId,
  }));
}

function syntheticCandidate(spec: DemoSpec): RitualCandidate {
  return {
    id: crypto.randomUUID(),
    detectedAt: Date.now(),
    domainSequence: spec.domainSequence,
    occurrences: spec.runCount,
    events: syntheticEvents(spec.domainSequence, spec.pageTitles),
    confidence: 1,
  };
}

export async function seedDemoRituals(): Promise<Ritual[]> {
  const ONE_DAY = 24 * 60 * 60 * 1000;
  const now = Date.now();
  const created: Ritual[] = [];

  for (const spec of DEMOS) {
    const candidate = syntheticCandidate(spec);
    const steps = candidate.events.map((event, i) => ({
      order: i + 1,
      domain: event.domain,
      title: event.title,
      url: event.url,
    }));
    const playwrightScript = await generatePlaywrightScript(
      candidate,
      spec.title
    );
    const createdAt = now - spec.daysAgo * ONE_DAY;
    const ritual: Ritual = {
      id: crypto.randomUUID(),
      createdAt,
      lastRunAt: spec.runCount > 0 ? createdAt : null,
      runCount: spec.runCount,
      title: spec.title,
      summary: spec.summary,
      steps,
      domainSequence: spec.domainSequence,
      events: candidate.events,
      playwrightScript,
      automationIdeas: spec.automationIdeas,
    };
    await saveRitual(ritual);
    created.push(ritual);
  }

  return created;
}
