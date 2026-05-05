"use client";
import { useState } from "react";
import { ingestUrl } from "@/lib/api";
import type { IngestionSource } from "@/lib/types";

interface Props {
  onDone?: (msg: string, source?: IngestionSource) => void;
}

export default function URLInput({ onDone }: Props) {
  const [url,     setUrl]     = useState("");
  const [loading, setLoading] = useState(false);

  async function handleIngest() {
    const trimmed = url.trim();
    if (!trimmed) return;
    setLoading(true);
    try {
      await ingestUrl(trimmed);
      const domain = new URL(trimmed).hostname;
      const source: IngestionSource = {
        id:      crypto.randomUUID(),
        name:    domain,
        type:    "url",
        url:     trimmed,
        addedAt: Date.now(),
        selected: true,
      };
      onDone?.(`✓ ${domain} ingested`, source);
      setUrl("");
    } catch {
      onDone?.("URL ingest failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="flex items-center gap-2 px-3 py-2 rounded-xl transition-all"
      style={{ background: "var(--bg-base)", border: "1px solid var(--border-mid)" }}
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
        stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" className="shrink-0">
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
      </svg>

      <input
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && handleIngest()}
        placeholder="Import URL…"
        className="flex-1 bg-transparent text-[11px] focus:outline-none min-w-0"
        style={{ color: "var(--text-primary)" }}
      />

      <button
        onClick={handleIngest}
        disabled={loading || !url.trim()}
        className="shrink-0 disabled:opacity-40 transition hover:scale-110 active:scale-95"
        style={{ color: "var(--accent)" }}
        aria-label="Ingest URL"
      >
        {loading ? (
          <svg className="animate-spin" width="12" height="12" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.5">
            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4
                     M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" strokeLinecap="round"/>
          </svg>
        ) : (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
            <path d="M9 18l6-6-6-6"/>
          </svg>
        )}
      </button>
    </div>
  );
}
