import React from "react";
import { Loader2, Sparkles, X } from "lucide-react";
import { cn } from "@common/lib/utils";
import { useRitualStore } from "../store";
import { RitualListItem } from "./RitualListItem";

interface RitualPanelProps {
  onViewScript: (ritualId: string) => void;
}

export const RitualPanel: React.FC<RitualPanelProps> = ({ onViewScript }) => {
  const rituals = useRitualStore((s) => s.rituals);
  const closePanel = useRitualStore((s) => s.closePanel);
  const replayRitual = useRitualStore((s) => s.replayRitual);
  const loadDemoRituals = useRitualStore((s) => s.loadDemoRituals);
  const isSeedingDemo = useRitualStore((s) => s.isSeedingDemo);

  return (
    <aside className="animate-panel-in flex h-full w-full flex-col border-l border-neutral-200 bg-[#FAFAF9]/95 backdrop-blur-xl ">
      <header className="flex items-start justify-between gap-3 border-b border-neutral-200 bg-white/60 px-5 py-4">
        <div>
          <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-neutral-500">
            <Sparkles className="h-3 w-3 text-blue-500" />
            Blueberry Rituals
          </div>
          <h2 className="mt-1 text-base font-semibold text-[rgb(var(--ritual-navy))]">
            Your saved workflows
          </h2>
          <p className="mt-0.5 text-xs text-neutral-500">
            {rituals.length === 0
              ? "Nothing here yet - keep browsing."
              : rituals.length === 1
              ? "1 Ritual saved locally"
              : `${rituals.length} Rituals saved locally`}
          </p>
        </div>
        <button
          type="button"
          onClick={closePanel}
          aria-label="Close panel"
          className="rounded-md p-1 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700"
        >
          <X className="h-4 w-4" />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {rituals.length === 0 ? (
          <EmptyState
            onLoadDemo={() => void loadDemoRituals()}
            isSeeding={isSeedingDemo}
          />
        ) : (
          <div className="space-y-3">
            {rituals.map((r, i) => (
              <RitualListItem
                key={r.id}
                ritual={r}
                indexInList={i}
                onRun={() => void replayRitual(r.id)}
                onViewScript={() => onViewScript(r.id)}
              />
            ))}
          </div>
        )}
      </div>
    </aside>
  );
};

interface EmptyStateProps {
  onLoadDemo: () => void;
  isSeeding: boolean;
}

const EmptyState: React.FC<EmptyStateProps> = ({ onLoadDemo, isSeeding }) => {
  return (
    <div className="mt-10 flex flex-col items-center justify-center px-8 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-100">
        <Sparkles className="h-7 w-7 text-[rgb(var(--ritual-blue))]" />
      </div>
      <h3 className="mt-4 text-sm font-semibold text-neutral-800">
        No Rituals yet
      </h3>
      <p className="mt-1 max-w-[240px] text-xs leading-relaxed text-neutral-500">
        Blueberry watches your tab patterns and surfaces a card when it
        notices something you do repeatedly.
      </p>
      <button
        type="button"
        onClick={onLoadDemo}
        disabled={isSeeding}
        className={cn(
          "mt-5 inline-flex items-center gap-1.5 rounded-md px-3.5 py-1.5",
          "bg-[rgb(var(--ritual-navy))] text-xs font-semibold text-white",
          "transition-all hover:bg-[rgb(var(--ritual-blue))] hover:shadow-md active:scale-[0.98]",
          "disabled:cursor-not-allowed disabled:opacity-60"
        )}
      >
        {isSeeding ? (
          <>
            <Loader2 className="h-3 w-3 animate-spin" />
            Loading…
          </>
        ) : (
          <>
            <Sparkles className="h-3 w-3" />
            Load demo rituals
          </>
        )}
      </button>
      <p className="mt-2 text-[10px] text-neutral-400">
        Three sample workflows — useful for showcasing the feature.
      </p>
    </div>
  );
};
