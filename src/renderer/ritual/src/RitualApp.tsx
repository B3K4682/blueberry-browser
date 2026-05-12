import React, { useEffect, useMemo, useRef, useState } from "react";
import { saveEvent } from "./storage";
import { DetectionEngine } from "./detection";
import { useRitualStore } from "./store";
import { installDevHelpers } from "./_dev";
import { RitualCard } from "./components/RitualCard";
import { RitualPanel } from "./components/RitualPanel";
import { ScriptViewer } from "./components/ScriptViewer";
import type { WorkflowEvent } from "@shared/ritual-types";

export const RitualApp: React.FC = () => {
  const [bootStatus, setBootStatus] = useState<"booting" | "ready" | "error">(
    "booting"
  );
  const [eventCount, setEventCount] = useState(0);
  const subscribed = useRef(false);
  const panelSubscribed = useRef(false);
  const stopReplaySubscribed = useRef(false);

  const ritualsCount = useRitualStore((s) => s.rituals.length);
  const isCardVisible = useRitualStore((s) => s.isCardVisible);
  const isPanelOpen = useRitualStore((s) => s.isPanelOpen);
  const isGenerating = useRitualStore((s) => s.isGenerating);
  const viewingScriptId = useRitualStore((s) => s.viewingScriptId);
  const viewScript = useRitualStore((s) => s.viewScript);
  const currentCandidateId = useRitualStore(
    (s) => s.currentCandidate?.id ?? ""
  );

  const engine = useMemo(() => new DetectionEngine(), []);

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

        engine.onCandidate((candidate) => {
          useRitualStore.getState().showCandidate(candidate);
        });

        installDevHelpers(engine);

        if (!subscribed.current) {
          subscribed.current = true;
          window.ritualAPI.onEvent(handleIncomingEvent);
          window.ritualAPI.markReady();
        }

        if (!panelSubscribed.current) {
          panelSubscribed.current = true;
          window.ritualAPI.onPanelToggleRequested(() => {
            useRitualStore.getState().togglePanel();
          });
        }

        if (!stopReplaySubscribed.current) {
          stopReplaySubscribed.current = true;
          window.ritualAPI.onReplayStopRequested(() => {
            useRitualStore.getState().stopReplay();
          });
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
      if (panelSubscribed.current) {
        window.ritualAPI.removePanelToggleListener();
        panelSubscribed.current = false;
      }
      if (stopReplaySubscribed.current) {
        window.ritualAPI.removeReplayStopRequestedListener();
        stopReplaySubscribed.current = false;
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
        <span data-ritual-panel-open={isPanelOpen ? "true" : "false"} />
        <span data-ritual-generating={isGenerating ? "true" : "false"} />
        <span data-ritual-candidate-id={currentCandidateId} />
        <span data-ritual-viewing-script={viewingScriptId ?? ""} />
      </div>

      {isCardVisible && <RitualCard />}
      {isPanelOpen && <RitualPanel onViewScript={viewScript} />}
      {isPanelOpen && viewingScriptId && <ScriptViewer />}
    </div>
  );
};
