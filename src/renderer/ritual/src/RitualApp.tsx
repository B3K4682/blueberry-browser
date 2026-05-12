import React, { useEffect, useState } from "react";
import { getRecentEvents, getRituals } from "./storage";

export const RitualApp: React.FC = () => {
  const [bootStatus, setBootStatus] = useState<"booting" | "ready" | "error">(
    "booting"
  );
  const [counts, setCounts] = useState<{ events: number; rituals: number }>({
    events: 0,
    rituals: 0,
  });
  
  useEffect(() => {
    let cancelled = false;
    async function probeStorage() {
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
      } catch (err) {
        if (cancelled) return;
        console.error("[ritual] storage failed to open:", err);
        setBootStatus("error");
      }
    }
    probeStorage();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div style={{ display: "none" }} aria-hidden>
      <span data-ritual-status={bootStatus} />
      <span data-ritual-events={counts.events} />
      <span data-ritual-rituals={counts.rituals} />
    </div>
  );
};
