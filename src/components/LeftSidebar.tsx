"use client";
import { useState } from "react";
import { useTheme } from "@/lib/theme";
import FileUpload from "./FileUpload";
import URLInput from "./URLInput";
import type { ChatSession, IngestionSource } from "@/lib/types";

interface Props {
  sessions:        ChatSession[];
  activeSessionId: string;
  onSelectSession: (id: string) => void;
  onNewChat:       () => void;
  onFileIngested:  (msg: string, source?: IngestionSource) => void;
  sources:         IngestionSource[];
  onSourceToggle:  (id: string) => void;
  onSourceRemove:  (id: string) => void;
}

const TYPE_ICON: Record<string, string> = { pdf: "📄", url: "🌐", document: "📝" };

export default function LeftSidebar({
  sessions, activeSessionId, onSelectSession, onNewChat,
  onFileIngested, sources, onSourceToggle, onSourceRemove,
}: Props) {
  const { theme, toggle } = useTheme();
  const [showUpload, setShowUpload] = useState(false);

  const selectedCount = sources.filter((s) => s.selected).length;

  return (
    <aside
      className="w-64 shrink-0 flex flex-col overflow-hidden border-r"
      style={{ background: "var(--bg-surface)", borderColor: "var(--border)" }}
    >
      {/* ── Logo bar ─────────────────────────────────── */}
      <div
        className="flex items-center gap-2.5 px-4 py-3.5 border-b shrink-0"
        style={{ borderColor: "var(--border)" }}
      >
        <div
          className="w-8 h-8 rounded-xl flex items-center justify-center text-white text-xs font-bold shrink-0"
          style={{ background: "var(--accent)" }}
        >
          N
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold truncate" style={{ color: "var(--text-primary)" }}>NeuralArch</p>
          <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>Research Assistant</p>
        </div>
        <button
          onClick={toggle}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-sm
                     hover:bg-white/5 transition shrink-0"
          style={{ color: "var(--text-secondary)" }}
          aria-label="Toggle theme"
        >
          {theme === "dark" ? "☀" : "☾"}
        </button>
      </div>

      {/* ── New Research ─────────────────────────────── */}
      <div className="px-3 pt-3 pb-1 shrink-0">
        <button
          onClick={onNewChat}
          className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl
                     text-sm font-semibold text-white transition-all
                     hover:scale-[1.02] active:scale-[0.98]"
          style={{ background: "var(--accent)" }}
        >
          + New Research
        </button>
      </div>

      {/* ── Chat history ─────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-3 py-2 min-h-0">
        <p className="text-[9px] uppercase tracking-widest px-1 mb-1.5"
          style={{ color: "var(--text-muted)" }}>
          Recent
        </p>
        <div className="flex flex-col gap-0.5">
          {sessions.map((s) => {
            const isActive = s.id === activeSessionId;
            return (
              <button
                key={s.id}
                onClick={() => onSelectSession(s.id)}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg
                           text-left text-xs transition-all hover:bg-white/[0.04]"
                style={{
                  background: isActive ? "var(--accent-dim)"  : "transparent",
                  border:     `1px solid ${isActive ? "var(--accent-border)" : "transparent"}`,
                  color:      isActive ? "var(--accent)"       : "var(--text-secondary)",
                  fontWeight: isActive ? 500                   : 400,
                }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                  className="shrink-0 opacity-70">
                  <circle cx="12" cy="12" r="10"/>
                  <polyline points="12 6 12 12 16 14"/>
                </svg>
                <span className="truncate">{s.title || "New Research"}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Knowledge Base ────────────────────────────── */}
      <div className="shrink-0 border-t" style={{ borderColor: "var(--border)" }}>

        {/* Header row */}
        <div
          className="flex items-center gap-2 px-3 py-2"
          style={{ borderBottom: `1px solid var(--border)` }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
            stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" className="shrink-0">
            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
            <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
          </svg>
          <span className="text-[9px] font-semibold uppercase tracking-widest flex-1"
            style={{ color: "var(--text-muted)" }}>
            Knowledge Base
          </span>
          {sources.length > 0 && (
            <span
              className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold"
              style={{
                background: selectedCount > 0 ? "var(--accent-dim)" : "var(--bg-base)",
                color:      selectedCount > 0 ? "var(--accent)"      : "var(--text-muted)",
                border:     `1px solid ${selectedCount > 0 ? "var(--accent-border)" : "var(--border)"}`,
              }}
            >
              {selectedCount > 0 ? `${selectedCount} active` : `${sources.length}`}
            </span>
          )}
        </div>

        {/* Source list */}
        {sources.length > 0 ? (
          <div className="max-h-40 overflow-y-auto px-2 py-1 space-y-0.5">
            {sources.map((src) => (
              <div
                key={src.id}
                className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg group"
                style={{
                  background: src.selected ? "var(--accent-dim)" : "transparent",
                  border:     `1px solid ${src.selected ? "var(--accent-border)" : "transparent"}`,
                }}
              >
                {/* Checkbox */}
                <button
                  onClick={() => onSourceToggle(src.id)}
                  className="w-3.5 h-3.5 rounded border flex items-center justify-center
                             shrink-0 transition-all"
                  style={{
                    background:  src.selected ? "var(--accent)" : "transparent",
                    borderColor: src.selected ? "var(--accent)" : "var(--border-mid)",
                  }}
                  title={src.selected ? "Deselect" : "Select for RAG filter"}
                >
                  {src.selected && (
                    <svg width="8" height="8" viewBox="0 0 12 12" fill="none"
                      stroke="white" strokeWidth="2.5" strokeLinecap="round">
                      <polyline points="2,6 5,9 10,3"/>
                    </svg>
                  )}
                </button>

                <span className="text-xs shrink-0">{TYPE_ICON[src.type] ?? "📎"}</span>

                <span
                  className="flex-1 text-[11px] truncate leading-none"
                  style={{ color: src.selected ? "var(--text-primary)" : "var(--text-muted)" }}
                  title={src.filename ?? src.url ?? src.name}
                >
                  {src.name}
                </span>

                <button
                  onClick={() => onSourceRemove(src.id)}
                  className="opacity-0 group-hover:opacity-60 hover:!opacity-100
                             transition text-[10px] shrink-0"
                  style={{ color: "var(--text-muted)" }}
                  title="Remove from library"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="px-3 py-2 text-[10px]" style={{ color: "var(--text-muted)" }}>
            Upload a file or add a URL to build your knowledge base.
          </p>
        )}

        {/* Upload toggle */}
        <div className="p-2.5 space-y-2 border-t" style={{ borderColor: "var(--border)" }}>
          <button
            onClick={() => setShowUpload((v) => !v)}
            className="w-full flex items-center gap-2 text-xs px-2 py-1.5
                       rounded-lg hover:bg-white/[0.04] transition"
            style={{ color: "var(--text-secondary)" }}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="shrink-0">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>
            </svg>
            Add Sources
            <span className="ml-auto text-[10px] opacity-60">{showUpload ? "▲" : "▼"}</span>
          </button>

          {showUpload && (
            <div className="space-y-2 animate-fade-up">
              <FileUpload onDone={onFileIngested} />
              <URLInput   onDone={onFileIngested} />
            </div>
          )}
        </div>
      </div>

      {/* ── Footer ───────────────────────────────────── */}
      <div
        className="shrink-0 px-4 py-2 border-t text-[9px] text-center"
        style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
      >
        LangGraph · RAG · Multi-Model
      </div>
    </aside>
  );
}
