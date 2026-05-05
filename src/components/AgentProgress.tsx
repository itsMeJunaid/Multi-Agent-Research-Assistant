"use client";
import { useState } from "react";
import type { NodeOutput } from "@/lib/types";

const STEPS = [
  { key: "planner",        label: "Planning",    icon: "◎" },
  { key: "researcher",     label: "Researching", icon: "⌕" },
  { key: "reasoning_step", label: "Reasoning",   icon: "◈" },
  { key: "generator",      label: "Generating",  icon: "◆" },
] as const;

const NODE_TITLE: Record<string, string> = {
  planner:        "🗺 Agent Plan",
  researcher:     "🔍 Research Strategy",
  reasoning_step: "🧠 CoT Synthesis (DeepSeek)",
  generator:      "✨ Generating Answer",
};

interface Props {
  activeNode:     string | undefined;
  completedNodes: string[];
  nodeOutputs:    NodeOutput[];
}

export default function AgentProgress({ activeNode, completedNodes, nodeOutputs }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const outputMap = Object.fromEntries(nodeOutputs.map((o) => [o.node, o]));

  return (
    <div className="flex flex-col gap-2 pl-11">

      {/* ── Progress pills ──────────────────────────── */}
      <div className="flex items-center gap-1 flex-wrap">
        {STEPS.map((step, i) => {
          const done      = completedNodes.includes(step.key);
          const active    = activeNode === step.key;
          const hasDetail = !!outputMap[step.key];

          return (
            <div key={step.key} className="flex items-center gap-1">
              <button
                onClick={() => done && hasDetail && setExpanded(expanded === step.key ? null : step.key)}
                disabled={!done || !hasDetail}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full
                           text-[11px] font-medium transition-all duration-300"
                style={{
                  background: done
                    ? "rgba(34,197,94,0.10)"
                    : active
                    ? "var(--accent-dim)"
                    : "var(--bg-elevated)",
                  border: `1px solid ${
                    done   ? "rgba(34,197,94,0.28)" :
                    active ? "var(--accent-border)"  :
                             "var(--border-mid)"
                  }`,
                  color:  done ? "#16a34a" : active ? "var(--accent)" : "var(--text-muted)",
                  cursor: done && hasDetail ? "pointer" : "default",
                }}
              >
                {done ? (
                  <span className="font-bold">✓</span>
                ) : active ? (
                  <span className="inline-block w-2 h-2 rounded-full animate-pulse"
                    style={{ background: "var(--accent)" }} />
                ) : (
                  <span className="opacity-50">{step.icon}</span>
                )}
                {step.label}
                {done && hasDetail && (
                  <span className="opacity-40 text-[9px] ml-0.5">
                    {expanded === step.key ? "▲" : "▼"}
                  </span>
                )}
              </button>

              {i < STEPS.length - 1 && (
                <span className="text-[10px] transition-colors duration-500"
                  style={{ color: done ? "rgba(34,197,94,0.45)" : "var(--border-mid)" }}>
                  →
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Transparency panel (click a pill to expand) ─ */}
      {expanded && outputMap[expanded] && (
        <div
          className="rounded-xl p-3.5 text-[11px] leading-relaxed animate-fade-up"
          style={{
            background: "var(--bg-elevated)",
            border:     "1px solid var(--border-mid)",
          }}
        >
          <div className="flex items-center justify-between mb-2.5">
            <p className="text-[10px] font-bold uppercase tracking-wider"
              style={{ color: "var(--text-muted)" }}>
              {NODE_TITLE[expanded] ?? expanded}
            </p>
            <button
              onClick={() => setExpanded(null)}
              className="text-[10px] opacity-50 hover:opacity-100 transition"
              style={{ color: "var(--text-muted)" }}
            >
              ✕
            </button>
          </div>

          {/* Planner: show plan key-value table */}
          {outputMap[expanded].plan && (
            <div className="space-y-1">
              {Object.entries(outputMap[expanded].plan!).map(([k, v]) => (
                <div key={k} className="flex gap-3 items-start">
                  <span
                    className="shrink-0 font-semibold text-[10px] uppercase tracking-wider"
                    style={{ color: "var(--text-primary)", minWidth: "9rem" }}
                  >
                    {k.replace(/_/g, " ")}
                  </span>
                  <span style={{ color: "var(--text-secondary)" }}>
                    {typeof v === "boolean"
                      ? (v ? "✓ Yes" : "✗ No")
                      : Array.isArray(v)
                      ? (v.length ? v.join(", ") : "—")
                      : String(v) || "—"}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Reasoning: show full CoT synthesis */}
          {expanded === "reasoning_step" && outputMap[expanded].full && (
            <div
              className="max-h-64 overflow-y-auto rounded-lg p-3 mt-1"
              style={{ background: "var(--bg-base)", border: "1px solid var(--border)" }}
            >
              <pre className="whitespace-pre-wrap font-sans text-[11px] leading-relaxed"
                style={{ color: "var(--text-secondary)" }}>
                {outputMap[expanded].full}
              </pre>
            </div>
          )}

          {/* Researcher / generic: plain text */}
          {!outputMap[expanded].plan && expanded !== "reasoning_step" && outputMap[expanded].detail && (
            <p style={{ color: "var(--text-secondary)" }}>{outputMap[expanded].detail}</p>
          )}
        </div>
      )}
    </div>
  );
}
