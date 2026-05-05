"use client";
import { useState } from "react";
import type { Source } from "@/lib/api";

interface Props {
  source: Source;
  index:  number;
}

export default function CitationCard({ source, index }: Props) {
  const [open, setOpen] = useState(false);
  const isPdf = source.source_type === "pdf";

  return (
    <div
      className="rounded-xl overflow-hidden transition-all duration-200"
      style={{ background: "var(--bg-base)", border: "1px solid var(--border)" }}
    >
      {/* Header row — always visible */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-start gap-2.5 p-3 text-left hover:bg-white/[0.025] dark:hover:bg-white/[0.03] transition"
      >
        <span
          className="text-[10px] px-1.5 py-0.5 rounded font-bold shrink-0 mt-px"
          style={{
            background: isPdf ? "rgba(251,146,60,0.12)" : "rgba(96,165,250,0.12)",
            color:      isPdf ? "#fb923c"               : "#60a5fa",
          }}
        >
          [{index}]
        </span>

        <span className="text-xs font-medium flex-1 min-w-0 truncate" style={{ color: "var(--text-primary)" }}>
          {source.title}
        </span>

        <span
          className="text-[10px] shrink-0 transition-transform duration-200"
          style={{
            color:     "var(--text-muted)",
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            display:   "inline-block",
          }}
        >
          ▾
        </span>
      </button>

      {/* Expanded content */}
      {open && (
        <div className="px-3 pb-3 border-t space-y-2" style={{ borderColor: "var(--border)" }}>
          {source.url && (
            <a
              href={source.url}
              target="_blank"
              rel="noreferrer"
              className="text-[10px] block mt-2 truncate underline underline-offset-2 hover:opacity-70 transition"
              style={{ color: "var(--accent)" }}
            >
              {source.url}
            </a>
          )}
          {source.snippet && (
            <p
              className="text-[11px] leading-relaxed line-clamp-4"
              style={{ color: "var(--text-secondary)" }}
            >
              {source.snippet}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
