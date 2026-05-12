import React, { useEffect, useMemo, useRef, useState } from "react";
import { saveEvent } from "./storage";
import { DetectionEngine } from "./detection";
import { useRitualStore } from "./store";
import { installDevHelpers } from "./_dev";
import { RitualCard } from "./components/RitualCard";
import type { WorkflowEvent } from "@shared/ritual-types";

export const RitualApp: React.FC = () => {
  const [bootStatus, setBootStatus] = useState<"booting" | "ready" | "error">(
    "booting"
  );
  const [eventCount, setEventCount] = useState(0);
  const subscribed = useRef(false);

  // Store slices for the debug-attribute readout
  const ritualsCount = useRitualStore((s) => s.rituals.length);
  const isCardVisible = useRitualStore((s) => s.isCardVisible);
  const isGenerating = useRitualStore((s) => s.isGenerating);
  const currentCandidateId = useRitualStore(
    (s) => s.currentCandidate?.id ?? ""
  );

  const engine = useMemo(() => new DetectionEngine(), []);

  // Persists one incoming event and logs it for verification.
  async function handleIncomingEvent(event: WorkflowEvent): Promise<void> {
    try {
      await saveEvent(event);
      setEventCount((prev) => prev + 1);
      await engine.ingest(event);
    } catch (err) {
      console.error("[ritual] failed to handle event:", event, err);
    }
  }

  useEffect(() => {
    let cancelled = false;
    const store = useRitualStore.getState();

    async function boot() {
      try {
        await store.loadRituals();
        if (cancelled) return;
        setBootStatus("ready");
        console.log("[ritual] boot complete");

        // Route Detection Engine candidates directly into the store
        engine.onCandidate((candidate) => {
          useRitualStore.getState().showCandidate(candidate);
        });

        installDevHelpers(engine);

        if (!subscribed.current) {
          subscribed.current = true;
          window.ritualAPI.onEvent(handleIncomingEvent);
          window.ritualAPI.markReady();
        }
      } catch (err) {
        if (cancelled) return;
        console.error("[ritual] boot failed:", err);
        setBootStatus("error");
      }
    }

    boot();

    return () => {
      cancelled = true;
      if (subscribed.current) {
        window.ritualAPI.removeEventListener();
        subscribed.current = false;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="relative h-screen w-screen">
      <div className="absolute inset-0 hidden" aria-hidden>
        <span data-ritual-status={bootStatus} />
        <span data-ritual-events={eventCount} />
        <span data-ritual-rituals={ritualsCount} />
        <span data-ritual-card-visible={isCardVisible ? "true" : "false"} />
        <span data-ritual-generating={isGenerating ? "true" : "false"} />
        <span data-ritual-candidate-id={currentCandidateId} />
      </div>

      {isCardVisible && <RitualCard />}
    </div>
  );
};
