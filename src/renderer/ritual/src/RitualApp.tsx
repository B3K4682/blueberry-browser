import React, { useEffect, useRef, useState } from "react";
import { getRecentEvents, getRituals, saveEvent } from "./storage";
import type { WorkflowEvent } from "@shared/ritual-types";

export const RitualApp: React.FC = () => {
  const [bootStatus, setBootStatus] = useState<"booting" | "ready" | "error">(
    "booting"
  );
  const [counts, setCounts] = useState<{ events: number; rituals: number }>({
    events: 0,
    rituals: 0,
  });
  const subscribed = useRef(false);

  // Persists one incoming event and logs it for verification.
  async function handleIncomingEvent(event: WorkflowEvent): Promise<void> {
    try {
      await saveEvent(event);
      setCounts((prev) => ({ ...prev, events: prev.events + 1 }));

      // TODO: Remove this after development
      console.log(
        `[ritual] saved ${event.type} ${event.domain || "(no-domain)"}: ${
          event.title
        }`
      );
    } catch (err) {
      console.error("[ritual] failed to save event:", event, err);
    }
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
