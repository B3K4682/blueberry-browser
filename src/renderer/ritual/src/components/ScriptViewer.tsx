import React, { useState } from "react";
import { Copy, Check, Download, X, Code2 } from "lucide-react";
import { cn } from "@common/lib/utils";
import { useRitualStore } from "../store";

const COPY_FEEDBACK_MS = 1500;

function safeFilename(title: string): string {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60) || "ritual"
  );
}

export const ScriptViewer: React.FC = () => {
  const viewingId = useRitualStore((s) => s.viewingScriptId);
  const close = useRitualStore((s) => s.closeScriptViewer);
  const ritual = useRitualStore((s) =>
    viewingId ? s.rituals.find((r) => r.id === viewingId) ?? null : null
  );

  const [copied, setCopied] = useState(false);

  if (!ritual) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(ritual.playwrightScript);
      setCopied(true);
      setTimeout(() => setCopied(false), COPY_FEEDBACK_MS);
    } catch (err) {
      console.error("[script-viewer] copy failed:", err);
    }
  };

  const handleDownload = () => {
    const blob = new Blob([ritual.playwrightScript], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${safeFilename(ritual.title)}.spec.ts`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className="absolute inset-0 z-20 flex flex-col bg-white/95 backdrop-blur-md animate-panel-in"
      role="dialog"
      aria-label="Playwright script"
    >
      <header className="flex items-start justify-between gap-3 border-b border-neutral-200 px-5 py-4">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-neutral-500">
            <Code2 className="h-3 w-3 text-blue-500" />
            Playwright script
          </div>
          <h2 className="mt-1 truncate text-base font-semibold text-[rgb(var(--ritual-navy))]">
            {ritual.title}
          </h2>
          <p className="mt-0.5 text-xs text-neutral-500">
            Generated locally · ready to run with <code className="font-mono">npx playwright test</code>
          </p>
        </div>
        <button
          type="button"
          onClick={close}
          aria-label="Close script viewer"
          className="rounded-md p-1 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700"
        >
          <X className="h-4 w-4" />
        </button>
      </header>

      <div className="flex items-center gap-2 border-b border-neutral-200 bg-neutral-50 px-5 py-2">
        <button
          type="button"
          onClick={handleCopy}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-medium",
            "border border-neutral-200 bg-white text-neutral-700",
            "transition-colors hover:bg-neutral-50"
          )}
        >
          {copied ? (
            <>
              <Check className="h-3 w-3 text-emerald-600" />
              Copied
            </>
          ) : (
            <>
              <Copy className="h-3 w-3" />
              Copy
            </>
          )}
        </button>
        <button
          type="button"
          onClick={handleDownload}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-medium",
            "border border-neutral-200 bg-white text-neutral-700",
            "transition-colors hover:bg-neutral-50"
          )}
        >
          <Download className="h-3 w-3" />
          Download .spec.ts
        </button>
        <span className="ml-auto text-[10px] text-neutral-400">
          {ritual.playwrightScript.split("\n").length} lines
        </span>
      </div>

      <pre className="flex-1 overflow-auto bg-[#0F172A] px-4 py-4 font-mono text-[11px] leading-relaxed text-neutral-100">
        <code>{ritual.playwrightScript}</code>
      </pre>
    </div>
  );
};
