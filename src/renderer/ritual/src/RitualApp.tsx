import React, { useEffect, useMemo, useRef, useState } from "react";
import { getRecentEvents, getRituals, saveEvent } from "./storage";
import { DetectionEngine } from "./detection";
import { installDevHelpers } from "./_dev";
import type { WorkflowEvent, RitualCandidate } from "@shared/ritual-types";

export const RitualApp: React.FC = () => {
  const [bootStatus, setBootStatus] = useState<"booting" | "ready" | "error">(
    "booting"
  );
  const [counts, setCounts] = useState<{ events: number; rituals: number }>({
    events: 0,
    rituals: 0,
  });
  const subscribed = useRef(false);
  // Initialize the detection engine
  const engine = useMemo(() => new DetectionEngine(), []);

  // Persists one incoming event and logs it for verification.
  async function handleIncomingEvent(event: WorkflowEvent): Promise<void> {
    try {
      await saveEvent(event);
      setCounts((prev) => ({ ...prev, events: prev.events + 1 }));
      await engine.ingest(event);
    } catch (err) {
      console.error("[ritual] failed to handle event:", event, err);
    }
  }

  // Logs every emitted candidate.
  function handleCandidate(candidate: RitualCandidate): void {
    console.log(
      `[ritual] candidate: ${candidate.domainSequence.join(" > ")} ` +
        `(occurrences=${candidate.occurrences}, confidence=${candidate.confidence})`,
      candidate
    );
  }

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      try {
        const [events, rituals] = await Promise.all([
          getRecentEvents(1000),
          getRituals(),
        ]);
        if (cancelled) return;
        setCounts({ events: events.length, rituals: rituals.length });
        setBootStatus("ready");
        console.log(
          `[ritual] storage ready — ${events.length} event(s), ${rituals.length} ritual(s)`
        );

        engine.onCandidate(handleCandidate);
        installDevHelpers(engine);

        if (!subscribed.current) {
          subscribed.current = true;
          window.ritualAPI.onEvent(handleIncomingEvent);
          window.ritualAPI.markReady();
        }
      } catch (err) {
        if (cancelled) return;
        console.error("[ritual] storage failed to open:", err);
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
    <div style={{ display: "none" }} aria-hidden>
      <span data-ritual-status={bootStatus} />
      <span data-ritual-events={counts.events} />
      <span data-ritual-rituals={counts.rituals} />
    </div>
  );
};
