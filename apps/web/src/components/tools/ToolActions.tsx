"use client";

import { useState } from "react";

import { Button } from "@/components/ui/primitives";
import type { ExportFormat } from "@/lib/analytics";

/**
 * Save / share / export actions for a tool result: print (or save as PDF from the print dialog),
 * download a plain-text summary, copy a share link. Nothing is uploaded; the link carries only the
 * non-personal answer code the tool provides.
 */
export function ToolActions({
  title,
  labels,
  summaryText,
  fileName,
  shareUrl,
  onExport,
}: {
  title: string;
  labels: { print: string; download: string; copyLink: string; copied: string; copyFailed: string };
  summaryText: () => string;
  fileName: string;
  shareUrl: () => string;
  onExport?: (format: ExportFormat) => void;
}) {
  const [message, setMessage] = useState("");

  function download() {
    onExport?.("text");
    const blob = new Blob([summaryText()], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function copy() {
    onExport?.("link");
    try {
      await navigator.clipboard.writeText(shareUrl());
      setMessage(labels.copied);
    } catch {
      setMessage(labels.copyFailed);
    }
  }

  return (
    <section aria-labelledby="tool-actions-title" className="print:hidden">
      <h2 id="tool-actions-title" className="t-label">
        {title}
      </h2>
      <div className="mt-3 flex flex-wrap gap-3">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            onExport?.("print");
            window.print();
          }}
        >
          {labels.print}
        </Button>
        <Button variant="secondary" size="sm" onClick={download}>
          {labels.download}
        </Button>
        <Button variant="secondary" size="sm" onClick={copy}>
          {labels.copyLink}
        </Button>
      </div>
      <p role="status" aria-live="polite" className="mt-2 min-h-5 text-sm text-fg-muted">
        {message}
      </p>
    </section>
  );
}
