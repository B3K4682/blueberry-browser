import React, { useEffect, useState } from "react";
import { Sparkles, Square, CheckCircle2 } from "lucide-react";
import type { ReplayState } from "@shared/ritual-ipc";
import { cn } from "@common/lib/utils";

function prettyDomain(d: string): string {
  return d.replace(/^www\./, "");
}

export const ReplayBanner: React.FC = () => {
  const [state, setState] = useState<ReplayState | null>(null);

  useEffect(() => {
    window.topBarAPI.onReplayState((s) => setState(s));
    return () => window.topBarAPI.removeReplayStateListener();
  }, []);

  if (!state || !state.active) return null;

  const current = state.domainSequence[state.currentStep] ?? "";
  const pct =
    state.totalSteps > 0
      ? ((state.currentStep + (state.done ? 1 : 0)) / state.totalSteps) * 100
      : 0;

  return (
    <div
      className={cn(
        "w-full h-10 flex items-center gap-3 px-4 app-region-no-drag",
        "bg-gradient-to-r from-blue-50 via-indigo-50 to-blue-50",
        "dark:from-blue-950/30 dark:via-indigo-950/30 dark:to-blue-950/30",
        "border-b border-blue-200/60 dark:border-blue-900/40",
        "text-xs"
      )}
    >
      <div className="flex items-center gap-1.5 text-blue-700 dark:text-blue-300">
        {state.done ? (
          <CheckCircle2 className="size-3.5" />
        ) : (
          <Sparkles className="size-3.5" />
        )}
        <span className="font-semibold">
          {state.done ? "Ritual complete" : "Running ritual"}
        </span>
        <span className="text-muted-foreground">·</span>
        <span className="font-medium text-foreground truncate max-w-[180px]">
          {state.ritualTitle}
        </span>
      </div>

      <div className="flex-1 flex items-center gap-2 min-w-0">
        <span className="text-muted-foreground whitespace-nowrap">
          {state.done
            ? `${state.totalSteps}/${state.totalSteps}`
            : `Step ${state.currentStep + 1}/${state.totalSteps}`}
          {!state.done && current && (
            <span className="ml-1 text-foreground">· {prettyDomain(current)}</span>
          )}
        </span>
        <div className="flex-1 h-1 rounded-full bg-blue-100 dark:bg-blue-900/40 overflow-hidden">
          <div
            className="h-full bg-blue-500 transition-[width] duration-500 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {!state.done && (
        <button
          type="button"
          onClick={() => window.topBarAPI.stopReplay()}
          className={cn(
            "inline-flex items-center gap-1 rounded px-2 py-1",
            "text-blue-700 hover:bg-blue-100 dark:text-blue-300 dark:hover:bg-blue-900/40",
            "transition-colors"
          )}
        >
          <Square className="size-3" fill="currentColor" />
          Stop
        </button>
      )}
    </div>
  );
};
