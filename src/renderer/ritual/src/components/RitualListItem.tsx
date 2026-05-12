import React, { useState } from "react";
import { Code2, Play, ChevronDown } from "lucide-react";
import { cn } from "@common/lib/utils";
import type { Ritual } from "@shared/ritual-types";
import { RitualTimeline } from "./RitualTimeline";

interface RitualListItemProps {
  ritual: Ritual;
  onRun: () => void;
  onViewScript: () => void;
  indexInList: number;
}

function relativeTime(ts: number | null): string {
  if (!ts) return "never";
  const diff = Date.now() - ts;
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  return `${weeks}w ago`;
}

function pluralizeRuns(count: number): string {
  return count === 1 ? "1 run" : `${count} runs`;
}

export const RitualListItem: React.FC<RitualListItemProps> = ({
  ritual,
  onRun,
  onViewScript,
  indexInList,
}) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <article
      className="animate-list-item-in rounded-xl border border-neutral-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
      style={{ animationDelay: `${indexInList * 50}ms` }}
    >
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-[rgb(var(--ritual-navy))]">
            {ritual.title}
          </h3>
          <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-neutral-500">
            {ritual.summary}
          </p>
        </div>
      </header>

      <div className="mt-3">
        <RitualTimeline domains={ritual.domainSequence} />
      </div>

      <div className="mt-2 flex items-center justify-between text-[11px] text-neutral-500">
        <span>
          {pluralizeRuns(ritual.runCount)} · last {relativeTime(ritual.lastRunAt)}
        </span>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-neutral-500 hover:bg-neutral-100"
        >
          {expanded ? "Hide steps" : "Show steps"}
          <ChevronDown
            className={cn(
              "h-3 w-3 transition-transform",
              expanded && "rotate-180"
            )}
          />
        </button>
      </div>

      {expanded && (
        <div className="mt-3 space-y-2 rounded-lg bg-neutral-50/80 p-3">
          <ol className="space-y-1.5 text-xs text-neutral-700">
            {ritual.steps.map((step) => (
              <li key={step.order} className="flex gap-2">
                <span className="mt-0.5 flex h-4 w-4 flex-none items-center justify-center rounded-full bg-white text-[10px] font-semibold text-neutral-500 ring-1 ring-neutral-200">
                  {step.order}
                </span>
                <span className="min-w-0">
                  <span className="font-medium text-neutral-800">
                    {step.title}
                  </span>
                  <span className="ml-1 text-neutral-400">· {step.domain}</span>
                </span>
              </li>
            ))}
          </ol>

          {ritual.automationIdeas.length > 0 && (
            <div className="pt-2">
              <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-neutral-400">
                Automation ideas
              </p>
              <ul className="space-y-0.5 text-[11px] text-neutral-600">
                {ritual.automationIdeas.map((idea, i) => (
                  <li key={i} className="leading-snug">
                    • {idea}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={onRun}
          className={cn(
            "inline-flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5",
            "bg-[rgb(var(--ritual-navy))] text-xs font-semibold text-white",
            "transition-all hover:bg-[rgb(var(--ritual-blue))] hover:shadow-md active:scale-[0.98]"
          )}
        >
          <Play className="h-3 w-3" fill="currentColor" />
          Run this
        </button>
        <button
          type="button"
          onClick={onViewScript}
          className="inline-flex items-center justify-center gap-1.5 rounded-md border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-600 transition-colors hover:bg-neutral-50"
        >
          <Code2 className="h-3 w-3" />
          View script
        </button>
      </div>
    </article>
  );
};
