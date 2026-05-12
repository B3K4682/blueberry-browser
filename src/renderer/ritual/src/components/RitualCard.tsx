import React, { useEffect } from "react";
import { Check, ChevronRight, Loader2, Sparkles } from "lucide-react";
import { cn } from "@common/lib/utils";
import { useRitualStore } from "../store";
import { DomainChip } from "./DomainChip";

// 3 Sec
const SAVED_AUTO_DISMISS_MS = 3000;

type CardStage = "prompt" | "saving" | "saved";

// Pluralize "time" / "times" for the historical-match subtitle.
function describeFrequency(occurrences: number): string {
  if (occurrences <= 1) return "I noticed you doing this Ritual";
  return `You've done this Ritual ${occurrences} times recently`;
}

export const RitualCard: React.FC = () => {
  const candidate = useRitualStore((s) => s.currentCandidate);
  const isGenerating = useRitualStore((s) => s.isGenerating);
  const recentlySavedRitual = useRitualStore((s) => s.recentlySavedRitual);
  const dismissCandidate = useRitualStore((s) => s.dismissCandidate);
  const saveRitual = useRitualStore((s) => s.saveRitual);
  const clearCandidate = useRitualStore((s) => s.clearCandidate);

  const stage: CardStage = recentlySavedRitual
    ? "saved"
    : isGenerating
    ? "saving"
    : "prompt";

  // Auto-dismiss the saved confirmation after a short delay.
  useEffect(() => {
    if (stage !== "saved") return;
    const t = setTimeout(() => clearCandidate(), SAVED_AUTO_DISMISS_MS);
    return () => clearTimeout(t);
  }, [stage, clearCandidate]);

  if (!candidate) return null;

  return (
    <div className="h-full w-full p-6 pb-3">
      <div
        className={cn(
          "animate-card-in flex h-full w-full flex-col rounded-2xl border border-neutral-200/80",
          "bg-white/95 backdrop-blur-md",
          "shadow-[0_20px_50px_-12px_rgba(15,23,42,0.18),0_8px_24px_-8px_rgba(15,23,42,0.10)]"
        )}
      >
        {stage === "prompt" && (
          <PromptState
            domains={candidate.domainSequence}
            occurrences={candidate.occurrences}
            onDismiss={() => void dismissCandidate()}
            onSave={() => void saveRitual(candidate)}
          />
        )}
        {stage === "saving" && <SavingState />}
        {stage === "saved" && recentlySavedRitual && (
          <SavedState title={recentlySavedRitual.title} />
        )}
      </div>
    </div>
  );
};

interface PromptStateProps {
  domains: string[];
  occurrences: number;
  onDismiss: () => void;
  onSave: () => void;
}

const PromptState: React.FC<PromptStateProps> = ({
  domains,
  occurrences,
  onDismiss,
  onSave,
}) => {
  return (
    <div className="flex h-full flex-col gap-3.5 px-5 py-4">
      <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-neutral-500">
        <Sparkles className="h-3 w-3 text-blue-500" />
        I noticed a Ritual
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {domains.map((d, i) => (
          <React.Fragment key={`${d}-${i}`}>
            <DomainChip domain={d} />
            {i < domains.length - 1 && (
              <ChevronRight className="h-3 w-3 text-neutral-300" />
            )}
          </React.Fragment>
        ))}
      </div>

      <p className="text-sm leading-snug text-neutral-600">
        {describeFrequency(occurrences)}. Want me to remember it?
      </p>

      <div className="mt-auto flex items-center justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onDismiss}
          className="rounded-md px-3 py-1.5 text-xs font-medium text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-700"
        >
          Not now
        </button>
        <button
          type="button"
          onClick={onSave}
          className={cn(
            "rounded-md px-3.5 py-1.5 text-xs font-semibold text-white",
            "bg-[rgb(var(--ritual-navy))] transition-all",
            "hover:bg-[rgb(var(--ritual-blue))] hover:shadow-md active:scale-[0.98]"
          )}
        >
          Remember the Ritual
        </button>
      </div>
    </div>
  );
};

const SavingState: React.FC = () => {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
      <Loader2 className="h-6 w-6 animate-spin text-[rgb(var(--ritual-blue))]" />
      <p className="text-sm font-medium text-neutral-700">
        Blueberry is saving your Ritual…
      </p>
      <p className="text-xs text-neutral-500">
        Naming it and writing the steps.
      </p>
    </div>
  );
};

const SavedState: React.FC<{ title: string }> = ({ title }) => {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
      <div className="animate-check-pop flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
        <Check className="h-5 w-5" strokeWidth={3} />
      </div>
      <div>
        <p className="text-[11px] font-medium uppercase tracking-wide text-neutral-400">
          Saved as
        </p>
        <p className="mt-0.5 text-sm font-semibold text-neutral-800">{title}</p>
      </div>
    </div>
  );
};
