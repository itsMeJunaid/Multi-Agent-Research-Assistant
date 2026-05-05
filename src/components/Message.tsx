"use client";
import React, { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ChatMessage } from "@/lib/types";
import type { Source } from "@/lib/api";

/* ── Code block ─────────────────────────────────────────── */
function CodeBlock({ lang, code }: { lang?: string; code: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(code).catch(() => null);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <div className="code-block">
      <div className="code-header">
        <span className="code-lang">{lang?.toUpperCase() ?? "CODE"}</span>
        <button className="code-copy-btn" onClick={copy}>
          {copied ? "✓ Copied" : "Copy"}
        </button>
      </div>
      <div className="code-body">{code}</div>
    </div>
  );
}

/* ── Citation popup ──────────────────────────────────────── */
function CitationPopup({
  source,
  n,
  onClose,
  anchorRef,
  onView,
}: {
  source:    Source;
  n:         number;
  onClose:   () => void;
  anchorRef: React.RefObject<HTMLElement | null>;
  onView?:   (s: Source) => void;
}) {
  const popupRef = useRef<HTMLDivElement>(null);
  const isPdf    = source.source_type === "pdf";

  /* Close on outside click */
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (
        popupRef.current && !popupRef.current.contains(e.target as Node) &&
        anchorRef.current && !anchorRef.current.contains(e.target as Node)
      ) onClose();
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose, anchorRef]);

  return (
    <div
      ref={popupRef}
      className="animate-fade-up"
      style={{
        position:    "absolute",
        zIndex:      9999,
        top:         "calc(100% + 6px)",
        left:        "50%",
        transform:   "translateX(-50%)",
        width:       "300px",
        borderRadius: "12px",
        padding:     "12px",
        background:  "var(--bg-surface)",
        border:      "1px solid var(--border-mid)",
        boxShadow:   "0 8px 32px rgba(0,0,0,0.18)",
        color:       "var(--text-primary)",
      }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-xs shrink-0">{isPdf ? "📄" : "🌐"}</span>
          <span className="text-[11px] font-semibold truncate"
            style={{ color: "var(--text-primary)" }}>
            [{n}] {source.title}
          </span>
        </div>
        <button onClick={onClose}
          className="shrink-0 text-[11px] opacity-50 hover:opacity-100 transition"
          style={{ color: "var(--text-muted)" }}>
          ✕
        </button>
      </div>

      {/* Page info */}
      {(source as Source & { page?: number }).page != null && (
        <p className="text-[10px] mb-1.5" style={{ color: "var(--text-muted)" }}>
          Page {(source as Source & { page?: number }).page}
        </p>
      )}

      {/* Snippet */}
      {source.snippet && (
        <p className="text-[11px] leading-relaxed line-clamp-5 mb-2"
          style={{ color: "var(--text-secondary)" }}>
          {source.snippet}
        </p>
      )}

      {/* URL */}
      {source.url && (
        <a href={source.url} target="_blank" rel="noreferrer"
          className="block text-[10px] truncate underline underline-offset-2 mb-2"
          style={{ color: "var(--accent)" }}>
          {source.url}
        </a>
      )}

      {/* View button for PDFs */}
      {isPdf && onView && (
        <button
          onClick={() => { onView(source); onClose(); }}
          className="w-full text-[11px] py-1.5 rounded-lg font-semibold transition"
          style={{
            background: "var(--accent-dim)",
            border:     "1px solid var(--accent-border)",
            color:      "var(--accent)",
          }}
        >
          Open in Document Viewer →
        </button>
      )}
    </div>
  );
}

/* ── Inline citation badge [N] ───────────────────────────── */
function CiteBadge({
  n,
  source,
  onView,
}: {
  n:       number;
  source?: Source;
  onView?: (s: Source) => void;
}) {
  const [open, setOpen]     = useState(false);
  const btnRef              = useRef<HTMLButtonElement>(null);

  if (!source) {
    return (
      <span style={{
        fontSize: "0.72em", verticalAlign: "super",
        color: "var(--accent)", fontWeight: 600,
      }}>[{n}]</span>
    );
  }

  return (
    <span style={{ position: "relative", display: "inline" }}>
      <button
        ref={btnRef}
        onClick={() => setOpen((v) => !v)}
        title={`Source [${n}]: ${source.title}`}
        style={{
          fontSize:       "0.72em",
          verticalAlign:  "super",
          color:          "var(--accent)",
          fontWeight:     700,
          background:     "var(--accent-dim)",
          border:         "1px solid var(--accent-border)",
          borderRadius:   "4px",
          padding:        "0 3px",
          cursor:         "pointer",
          lineHeight:     1.4,
          transition:     "opacity 0.15s",
        }}
      >
        [{n}]
      </button>
      {open && (
        <CitationPopup
          source={source}
          n={n}
          onClose={() => setOpen(false)}
          anchorRef={btnRef}
          onView={onView}
        />
      )}
    </span>
  );
}

/* ── Inject [N] citation badges into React children ─────── */
function injectCitations(
  children: React.ReactNode,
  sources:  Source[],
  onView?:  (s: Source) => void,
): React.ReactNode {
  return React.Children.map(children, (child) => {
    if (typeof child === "string") {
      const parts = child.split(/(\[\d+\])/g);
      if (parts.length === 1) return child;
      return parts.map((part, i) => {
        const m = part.match(/^\[(\d+)\]$/);
        if (m) {
          const n   = parseInt(m[1]);
          const src = sources[n - 1];
          return <CiteBadge key={i} n={n} source={src} onView={onView} />;
        }
        return part;
      });
    }
    if (React.isValidElement(child)) {
      const el = child as React.ReactElement<{ children?: React.ReactNode }>;
      if (el.props.children) {
        return React.cloneElement(el, {
          children: injectCitations(el.props.children, sources, onView),
        });
      }
    }
    return child;
  });
}

/* ── Markdown components factory (receives sources + onView) */
function makeMdComponents(sources: Source[], onView?: (s: Source) => void) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const components: Record<string, any> = {
    code({ className, children }: { className?: string; children?: React.ReactNode }) {
      const lang  = /language-(\w+)/.exec(className ?? "")?.[1];
      const raw   = String(children ?? "").replace(/\n$/, "");
      const block = raw.includes("\n") || Boolean(lang);
      if (block) return <CodeBlock lang={lang} code={raw} />;
      return (
        <code style={{
          padding: "1px 6px", borderRadius: "5px",
          fontSize: "0.83em",
          fontFamily: "JetBrains Mono, Fira Code, Consolas, monospace",
          background: "var(--code-header)", color: "var(--accent)",
        }}>{children}</code>
      );
    },

    /* Inject citations inside paragraph text */
    p({ children }: { children?: React.ReactNode }) {
      return <p>{injectCitations(children, sources, onView)}</p>;
    },

    /* Inject citations inside list items */
    li({ children }: { children?: React.ReactNode }) {
      return <li>{injectCitations(children, sources, onView)}</li>;
    },

    a({ href, children }: { href?: string; children?: React.ReactNode }) {
      return (
        <a href={href} target="_blank" rel="noreferrer"
          style={{ color: "var(--accent)", textDecoration: "underline", textUnderlineOffset: "2px" }}>
          {children}
        </a>
      );
    },

    pre({ children }: { children?: React.ReactNode }) {
      return <>{children}</>;
    },
  };
  return components;
}

/* ── Message bubble ─────────────────────────────────────── */
export default function Message({
  message,
  onViewSource,
}: {
  message:      ChatMessage;
  onViewSource?: (source: Source) => void;
}) {
  const isUser  = message.role === "user";
  const isError = message.isError;

  if (isUser) {
    return (
      <div className="flex justify-end items-end gap-2 animate-fade-up">
        <div style={{
          maxWidth: "78%", padding: "10px 16px",
          borderRadius: "18px 18px 4px 18px",
          fontSize: "14px", lineHeight: "1.6",
          background: "var(--accent)", color: "#fff",
          boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
        }}>
          {message.content}
        </div>
        <div style={{
          width: 32, height: 32, borderRadius: "50%",
          flexShrink: 0, display: "flex",
          alignItems: "center", justifyContent: "center",
          fontSize: "11px", fontWeight: 700,
          background: "var(--accent)", color: "#fff",
        }}>U</div>
      </div>
    );
  }

  const bubbleBg     = isError ? "rgba(245,158,11,0.06)" : "var(--bg-elevated)";
  const bubbleBorder = isError ? "rgba(245,158,11,0.20)" : "var(--border)";
  const textColor    = isError ? "#fbbf24"                : "var(--text-primary)";
  const avatarBg     = isError ? "rgba(245,158,11,0.12)" : "var(--accent-dim)";
  const avatarBorder = isError ? "rgba(245,158,11,0.30)" : "var(--accent-border)";
  const avatarColor  = isError ? "#f59e0b"                : "var(--accent)";

  const sources        = message.sources ?? [];
  const mdComponents   = makeMdComponents(sources, onViewSource);

  return (
    <div className="flex items-start gap-3 animate-fade-up">
      <div style={{
        width: 32, height: 32, borderRadius: "50%",
        flexShrink: 0, display: "flex",
        alignItems: "center", justifyContent: "center",
        fontSize: "11px", fontWeight: 700, marginTop: "2px",
        background: avatarBg, border: `1px solid ${avatarBorder}`, color: avatarColor,
      }}>
        {isError ? "!" : "AI"}
      </div>

      <div style={{
        flex: 1, maxWidth: "87%",
        padding: "14px 16px",
        borderRadius: "4px 18px 18px 18px",
        fontSize: "14px", lineHeight: "1.7",
        background: bubbleBg, border: `1px solid ${bubbleBorder}`,
        color: textColor,
      }}>
        {isError && (
          <p style={{ fontSize: "11px", fontWeight: 600, color: "#f59e0b", marginBottom: "8px" }}>
            ⚠ Provider error
          </p>
        )}

        <div className="prose" style={{ color: textColor, maxWidth: "none" }}>
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
            {message.content}
          </ReactMarkdown>
        </div>

        {/* Source chips */}
        {sources.length > 0 && (
          <div style={{
            display: "flex", flexWrap: "wrap", gap: "6px",
            marginTop: "12px", paddingTop: "12px",
            borderTop: "1px solid var(--border)",
          }}>
            {sources.map((s, i) => {
              const isPdf = s.source_type === "pdf";
              const chip: React.CSSProperties = {
                fontSize: "10px", padding: "3px 8px",
                borderRadius: "999px", fontWeight: 500,
                cursor: "pointer", transition: "opacity 0.15s",
                background: isPdf ? "rgba(251,146,60,0.10)" : "rgba(96,165,250,0.10)",
                color:      isPdf ? "#c2410c"                : "#1d4ed8",
                border:     `1px solid ${isPdf ? "rgba(251,146,60,0.30)" : "rgba(96,165,250,0.30)"}`,
              };

              return isPdf ? (
                <button key={i} onClick={() => onViewSource?.(s)} style={chip}
                  title="Click to open in Document Viewer">
                  📄 [{i + 1}] {s.title}
                </button>
              ) : s.url ? (
                <a key={i} href={s.url} target="_blank" rel="noreferrer" style={chip}
                  title={s.url}>
                  🌐 {s.title}
                </a>
              ) : (
                <span key={i} style={chip}>🌐 {s.title}</span>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
