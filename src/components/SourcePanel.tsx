"use client";
import { useState, useEffect, useRef } from "react";
import type { Source } from "@/lib/api";
import type { AgentLogEntry, SessionStats } from "@/lib/types";
import { fetchSourceChunks, getFileUrl } from "@/lib/api";
import CitationCard from "./CitationCard";

interface Props {
  sources:       Source[];
  stats:         SessionStats;
  agentLog:      AgentLogEntry[];
  onClose:       () => void;
  viewingSource: Source | null;
  onCloseViewer: () => void;
}

const MIN_W = 260;
const MAX_W = 960;
const DEFAULT_W = 340;

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-3 rounded-xl"
      style={{ background: "var(--bg-base)", border: "1px solid var(--border)" }}>
      <p className="text-[9px] uppercase tracking-widest mb-1" style={{ color: "var(--text-muted)" }}>
        {label}
      </p>
      <p className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>{value}</p>
    </div>
  );
}

function SectionLabel({ icon, title }: { icon: string; title: string }) {
  return (
    <div className="flex items-center gap-1.5 mb-3">
      <span className="text-sm">{icon}</span>
      <h3 className="text-[10px] uppercase tracking-widest font-semibold"
        style={{ color: "var(--text-secondary)" }}>
        {title}
      </h3>
    </div>
  );
}

const NODE_LABELS: Record<string, string> = {
  planner:        "Planner",
  researcher:     "Researcher",
  reasoning_step: "Reasoning",
  generator:      "Generator",
};

/* ── Document / URL viewer ────────────────────────────────── */
function DocumentViewer({ source, onClose }: { source: Source; onClose: () => void }) {
  const isPdf = source.source_type === "pdf";
  const [chunks,  setChunks]  = useState<{ text: string; page?: number }[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setChunks([]);
    setLoading(true);
    fetchSourceChunks(source.title)
      .then(setChunks)
      .catch(() => setChunks([]))
      .finally(() => setLoading(false));
  }, [source.title]);

  return (
    <div className="flex flex-col" style={{ height: "100%", overflow: "hidden" }}>

      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 shrink-0 border-b"
        style={{ borderColor: "var(--border)" }}>
        <button
          onClick={onClose}
          className="w-6 h-6 rounded-lg flex items-center justify-center text-xs hover:bg-black/5 transition shrink-0"
          style={{ color: "var(--text-muted)" }}
          title="Back to sources"
        >
          ←
        </button>
        <span className="text-[11px] font-semibold truncate flex-1"
          style={{ color: "var(--text-primary)" }}>
          {isPdf ? "📄" : "🌐"} {source.title}
        </span>
        {source.url && (
          <a href={source.url} target="_blank" rel="noreferrer"
            className="text-[9px] px-2 py-1 rounded-lg shrink-0 hover:bg-black/5 transition"
            style={{ color: "var(--accent)" }}>
            Open ↗
          </a>
        )}
      </div>

      {/* PDF iframe — scrollable within the iframe itself */}
      {isPdf && (
        <div style={{ flex: 1, minHeight: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          <iframe
            src={getFileUrl(source.title)}
            style={{ flex: 1, width: "100%", border: "none", minHeight: 0 }}
            title={source.title}
          />
        </div>
      )}

      {/* Web URL: snippet + link */}
      {!isPdf && (
        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "16px" }}>
          {source.url && (
            <a href={source.url} target="_blank" rel="noreferrer"
              className="block text-[11px] underline underline-offset-2 mb-3 break-all"
              style={{ color: "var(--accent)" }}>
              {source.url}
            </a>
          )}
          {source.snippet && (
            <p className="text-[12px] leading-relaxed"
              style={{ color: "var(--text-secondary)" }}>
              {source.snippet}
            </p>
          )}
        </div>
      )}

      {/* Indexed passages — scrollable section, max 373px tall */}
      {(loading || chunks.length > 0) && (
        <div
          className="shrink-0 border-t"
          style={{
            borderColor: "var(--border)",
            maxHeight:   "373px",
            overflowY:   "auto",
            scrollBehavior: "smooth",
          }}
        >
          {/* Sticky header */}
          <div
            className="sticky top-0 z-10 flex items-center justify-between px-3 py-2 border-b"
            style={{
              background:  "var(--bg-elevated)",
              borderColor: "var(--border)",
            }}
          >
            <p className="text-[9px] uppercase tracking-widest font-bold"
              style={{ color: "var(--text-muted)" }}>
              Indexed Passages
            </p>
            {!loading && (
              <span
                className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold"
                style={{
                  background: "var(--accent-dim)",
                  color:      "var(--accent)",
                  border:     "1px solid var(--accent-border)",
                }}
              >
                {chunks.length}
              </span>
            )}
          </div>

          {/* Loading state */}
          {loading && (
            <div className="p-4 text-center">
              <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                Loading passages…
              </p>
            </div>
          )}

          {/* Passage cards */}
          {!loading && (
            <div className="p-2.5 flex flex-col gap-2">
              {chunks.map((c, i) => (
                <div
                  key={i}
                  style={{
                    display:      "flex",
                    gap:          "10px",
                    padding:      "10px 12px",
                    borderRadius: "10px",
                    background:   "var(--bg-base)",
                    border:       "1px solid var(--border)",
                    borderLeft:   "3px solid var(--accent-border)",
                  }}
                >
                  {/* Left: index + page badge */}
                  <div
                    style={{
                      display:        "flex",
                      flexDirection:  "column",
                      alignItems:     "center",
                      gap:            "4px",
                      flexShrink:     0,
                      minWidth:       "28px",
                    }}
                  >
                    <span
                      style={{
                        fontSize:     "9px",
                        fontWeight:   700,
                        lineHeight:   1,
                        padding:      "2px 5px",
                        borderRadius: "4px",
                        background:   "var(--accent-dim)",
                        color:        "var(--accent)",
                        border:       "1px solid var(--accent-border)",
                      }}
                    >
                      #{i + 1}
                    </span>
                    {c.page != null && (
                      <span
                        style={{
                          fontSize:  "8px",
                          fontWeight: 600,
                          color:     "var(--text-muted)",
                          lineHeight: 1,
                        }}
                      >
                        p.{c.page}
                      </span>
                    )}
                  </div>

                  {/* Right: passage text */}
                  <p
                    style={{
                      fontSize:   "11px",
                      lineHeight: "1.65",
                      color:      "var(--text-secondary)",
                      margin:     0,
                      wordBreak:  "break-word",
                    }}
                  >
                    {c.text}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Drag-resize handle ───────────────────────────────────── */
function ResizeHandle({ onDrag }: { onDrag: (e: React.MouseEvent) => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onMouseDown={onDrag}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position:   "absolute",
        left:       0,
        top:        0,
        bottom:     0,
        width:      "6px",
        cursor:     "col-resize",
        zIndex:     20,
        display:    "flex",
        alignItems: "center",
        justifyContent: "center",
        background: hovered ? "rgba(99,102,241,0.10)" : "transparent",
        transition: "background 0.15s",
      }}
    >
      {/* Visual grip dots */}
      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
        {[0, 1, 2].map((i) => (
          <div key={i} style={{
            width:        "2px",
            height:       "2px",
            borderRadius: "50%",
            background:   hovered ? "var(--accent)" : "var(--border-mid)",
            transition:   "background 0.15s",
          }} />
        ))}
      </div>
    </div>
  );
}

/* ── Main panel ──────────────────────────────────────────── */
export default function SourcePanel({
  sources, stats, agentLog, onClose, viewingSource, onCloseViewer,
}: Props) {
  const [panelWidth, setPanelWidth] = useState(DEFAULT_W);

  const pdfs = sources.filter((s) => s.source_type === "pdf");
  const webs = sources.filter((s) => s.source_type === "web");

  const tokenDisplay = stats.tokens > 999
    ? `${(stats.tokens / 1000).toFixed(1)}k`
    : String(stats.tokens || "—");

  /* Drag-to-resize: dragging left edge leftward = wider panel */
  function startResize(e: React.MouseEvent) {
    e.preventDefault();
    const startX = e.clientX;
    const startW = panelWidth;
    document.body.style.userSelect = "none";
    document.body.style.cursor     = "col-resize";

    function onMove(ev: MouseEvent) {
      const newW = Math.max(MIN_W, Math.min(MAX_W, startW + (startX - ev.clientX)));
      setPanelWidth(newW);
    }
    function onUp() {
      document.body.style.userSelect = "";
      document.body.style.cursor     = "";
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup",   onUp);
    }
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup",   onUp);
  }

  return (
    <aside
      style={{
        position:    "relative",
        width:       `${panelWidth}px`,
        minWidth:    `${MIN_W}px`,
        maxWidth:    `${MAX_W}px`,
        flexShrink:  0,
        display:     "flex",
        flexDirection: "column",
        overflow:    "hidden",
        borderLeft:  "1px solid var(--border)",
        background:  "var(--bg-surface)",
      }}
    >
      {/* ── Drag handle (left edge) ─────────── */}
      <ResizeHandle onDrag={startResize} />

      {/* ── Panel header ────────────────────── */}
      <div className="flex items-center justify-between px-4 py-3 shrink-0 border-b"
        style={{ borderColor: "var(--border)", paddingLeft: "18px" }}>
        <h2 className="text-xs font-semibold uppercase tracking-wider"
          style={{ color: "var(--text-secondary)" }}>
          {viewingSource ? "Document Viewer" : "Sources & Stats"}
        </h2>
        <div className="flex items-center gap-2">
          {/* Width indicator */}
          <span className="text-[9px]" style={{ color: "var(--text-muted)" }}>
            {panelWidth}px
          </span>
          <button onClick={onClose}
            className="w-6 h-6 rounded-lg flex items-center justify-center text-xs
                       hover:bg-black/5 transition"
            style={{ color: "var(--text-muted)" }}>
            ✕
          </button>
        </div>
      </div>

      {/* ── Viewer mode ─────────────────────── */}
      {viewingSource ? (
        <div style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
          <DocumentViewer source={viewingSource} onClose={onCloseViewer} />
        </div>
      ) : (

        /* ── Normal: sources + stats ────────── */
        <div className="flex-1 overflow-y-auto divide-y" style={{ borderColor: "var(--border)" }}>

          {pdfs.length > 0 && (
            <section className="p-4">
              <SectionLabel icon="📄" title="PDF Sources" />
              <div className="flex flex-col gap-2">
                {pdfs.map((s, i) => <CitationCard key={i} source={s} index={i + 1} />)}
              </div>
            </section>
          )}

          {webs.length > 0 && (
            <section className="p-4">
              <SectionLabel icon="🌐" title="Web Sources" />
              <div className="flex flex-col gap-2">
                {webs.map((s, i) => <CitationCard key={i} source={s} index={i + 1} />)}
              </div>
            </section>
          )}

          {sources.length === 0 && (
            <div className="p-6 text-center">
              <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                Sources appear here after your first query.
              </p>
            </div>
          )}

          <section className="p-4">
            <SectionLabel icon="📊" title="Session Stats" />
            <div className="grid grid-cols-2 gap-2">
              <StatBox label="Model"     value={stats.model || "AI"} />
              <StatBox label="Tokens"    value={tokenDisplay} />
              <StatBox label="Retrieval" value={stats.chunks ? `${stats.chunks} Chunks` : "—"} />
              <StatBox label="Latency"   value={stats.latency ? `${stats.latency}ms` : "—"} />
            </div>
          </section>

          {agentLog.length > 0 && (
            <section className="p-4">
              <SectionLabel icon="⚡" title="Live Agentic Log" />
              <div className="flex flex-col gap-2.5">
                {agentLog.map((entry, i) => {
                  const label = NODE_LABELS[entry.node] ?? entry.node;
                  const done  = entry.status === "done";
                  return (
                    <div key={i} className="flex items-start gap-2">
                      <div className="w-2 h-2 rounded-full shrink-0 mt-1.5"
                        style={{ background: done ? "#22c55e" : "var(--accent)" }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] leading-snug"
                          style={{ color: "var(--text-primary)" }}>
                          {done ? `Completed ${label}` : `Running ${label}…`}
                        </p>
                        <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                          {entry.time}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      )}
    </aside>
  );
}
