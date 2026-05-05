"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { streamChat } from "@/lib/api";
import type { Source } from "@/lib/api";
import type { ChatMessage, ChatSession, AgentLogEntry, SessionStats, IngestionSource, NodeOutput } from "@/lib/types";
import LeftSidebar   from "./LeftSidebar";
import Message       from "./Message";
import InputBox      from "./InputBox";
import AgentProgress from "./AgentProgress";
import SourcePanel   from "./SourcePanel";

/* ── Constants ──────────────────────────────────────────── */
const PIPELINE = ["planner", "researcher", "reasoning_step", "generator"];

const ERROR_PREFIXES = [
  "Generation failed", "Agent pipeline error",
  "LLM request failed", "The AI provider is rate-limiting",
  "All AI models are currently", "LLM_MODE", "Could not reach",
];

const SUGGESTIONS = [
  "What are the latest trends in quantum computing?",
  "Summarize the uploaded research paper",
  "Compare RAG vs fine-tuning approaches",
  "Find recent papers on neural architecture search",
];

const STORAGE_KEY = "research_sources_v1";

/* ── Helpers ────────────────────────────────────────────── */
function uid() { return Math.random().toString(36).slice(2) + Date.now().toString(36); }
function isErrorAnswer(t: string) { return ERROR_PREFIXES.some((p) => t.startsWith(p)); }
function emptyStats(): SessionStats { return { tokens: 0, chunks: 0, latency: 0, model: "Multi-Model" }; }
function newSession(title = "New Research"): ChatSession {
  return { id: uid(), title, messages: [], sources: [], agentLog: [], stats: emptyStats() };
}

function loadSources(): IngestionSource[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]"); }
  catch { return []; }
}

function saveSources(s: IngestionSource[]) {
  if (typeof window !== "undefined") localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

/* ── Component ──────────────────────────────────────────── */
export default function ChatBox() {
  const [sessions,       setSessions]       = useState<ChatSession[]>([newSession()]);
  const [activeId,       setActiveId]       = useState<string>(() => sessions[0].id);
  const [loading,        setLoading]        = useState(false);
  const [completedNodes, setCompletedNodes] = useState<string[]>([]);
  const [nodeOutputs,    setNodeOutputs]    = useState<NodeOutput[]>([]);
  const [toast,          setToast]          = useState("");
  const [leftOpen,       setLeftOpen]       = useState(true);
  const [rightOpen,      setRightOpen]      = useState(true);

  /* Source library — persisted in localStorage (load after mount to avoid SSR mismatch) */
  const [libSources,     setLibSources]     = useState<IngestionSource[]>([]);

  useEffect(() => {
    setLibSources(loadSources());
  }, []);

  /* Which source is open in the right-panel viewer */
  const [viewingSource,  setViewingSource]  = useState<Source | null>(null);

  const startRef  = useRef<number>(0);
  const bottomRef = useRef<HTMLDivElement>(null);

  const session   = sessions.find((s) => s.id === activeId) ?? sessions[0];
  const activeNode = loading
    ? PIPELINE.find((n) => !completedNodes.includes(n))
    : undefined;

  const patchSession = useCallback(
    (fn: (s: ChatSession) => ChatSession) =>
      setSessions((prev) => prev.map((s) => (s.id === activeId ? fn(s) : s))),
    [activeId],
  );

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [session.messages.length, loading]);

  /* ── Source library helpers ─────────────────────────── */
  function addSource(source: IngestionSource) {
    setLibSources((prev) => {
      const next = [source, ...prev.filter((s) => s.id !== source.id)];
      saveSources(next);
      return next;
    });
  }

  function toggleSource(id: string) {
    setLibSources((prev) => {
      const next = prev.map((s) => s.id === id ? { ...s, selected: !s.selected } : s);
      saveSources(next);
      return next;
    });
  }

  function removeSource(id: string) {
    setLibSources((prev) => {
      const next = prev.filter((s) => s.id !== id);
      saveSources(next);
      return next;
    });
  }

  /* Called by LeftSidebar when FileUpload / URLInput complete */
  function handleFileIngested(msg: string, source?: IngestionSource) {
    showToast(msg);
    if (source) addSource(source);
  }

  /* ── Toast ──────────────────────────────────────────── */
  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 3500);
  }

  /* ── Send message ───────────────────────────────────── */
  async function send(text: string) {
    if (!text.trim() || loading) return;

    const sessionId = activeId;
    const patch = (fn: (s: ChatSession) => ChatSession) =>
      setSessions((prev) => prev.map((s) => (s.id === sessionId ? fn(s) : s)));

    const userMsg: ChatMessage = { id: uid(), role: "user", content: text.trim() };

    patch((s) => ({
      ...s,
      title:    s.messages.length === 0 ? text.trim().slice(0, 42) : s.title,
      messages: [...s.messages, userMsg],
      agentLog: [],
    }));

    setLoading(true);
    setCompletedNodes([]);
    setNodeOutputs([]);
    setViewingSource(null);
    startRef.current = Date.now();

    /* Build source filter from selected library items */
    const sourceFilter = libSources
      .filter((s) => s.selected)
      .map((s) => s.filename ?? s.url ?? s.name)
      .filter(Boolean) as string[];

    let answer  = "";
    let sources: Source[] = [];

    try {
      for await (const event of streamChat(text.trim(), sourceFilter)) {
        if (event.type === "status" && event.node) {
          const entry: AgentLogEntry = {
            node:   event.node,
            status: event.status as "running" | "done",
            time:   new Date().toLocaleTimeString([], {
              hour: "2-digit", minute: "2-digit", second: "2-digit",
            }),
          };
          patch((s) => ({ ...s, agentLog: [...s.agentLog, entry] }));
          if (event.status === "done") {
            setCompletedNodes((prev) => [...prev, event.node!]);
          }
        }
        if (event.type === "node_output" && event.node) {
          const output: NodeOutput = {
            node:   event.node,
            detail: event.detail ?? "",
            full:   event.full,
            plan:   event.plan,
          };
          setNodeOutputs((prev) => [...prev, output]);
        }
        if (event.type === "answer") {
          answer  = event.text    ?? "";
          sources = event.sources ?? [];
        }
      }
    } catch {
      answer = "Could not reach the backend. Is the server running on port 8000?";
    }

    const latency   = Date.now() - startRef.current;
    const tokens    = Math.ceil(answer.length / 4);
    const ragChunks = sources.filter((s) => s.source_type === "pdf").length;

    const assistantMsg: ChatMessage = {
      id:      uid(),
      role:    "assistant",
      content: answer,
      sources,
      isError: isErrorAnswer(answer),
    };

    patch((s) => ({
      ...s,
      messages: [...s.messages, assistantMsg],
      sources:  [...s.sources, ...sources],
      stats: {
        ...s.stats,
        tokens:  s.stats.tokens + tokens,
        chunks:  s.stats.chunks + ragChunks,
        latency,
      },
    }));

    setLoading(false);
    setCompletedNodes([]);
  }

  function newChat() {
    const s = newSession();
    setSessions((prev) => [s, ...prev]);
    setActiveId(s.id);
  }

  /* ── Render ─────────────────────────────────────────── */
  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "var(--bg-base)" }}>

      {/* ── Left sidebar ─────────────────────────────── */}
      {leftOpen && (
        <LeftSidebar
          sessions={sessions}
          activeSessionId={activeId}
          onSelectSession={setActiveId}
          onNewChat={newChat}
          onFileIngested={handleFileIngested}
          sources={libSources}
          onSourceToggle={toggleSource}
          onSourceRemove={removeSource}
        />
      )}

      {/* ── Center: header + messages + input ────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Header */}
        <header
          className="shrink-0 flex items-center gap-3 px-4 py-2.5 border-b"
          style={{ borderColor: "var(--border)", background: "var(--bg-surface)" }}
        >
          {!leftOpen && (
            <button onClick={() => setLeftOpen(true)}
              className="p-1.5 rounded-lg hover:bg-white/5 transition text-base"
              style={{ color: "var(--text-muted)" }}>
              ☰
            </button>
          )}

          <div className="flex-1 min-w-0 flex items-center gap-2">
            <span className="text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>
              {session.title || "New Research"}
            </span>
            <span
              className="text-[10px] px-2 py-0.5 rounded-full shrink-0 font-semibold tracking-wide"
              style={{
                background: "var(--accent-dim)",
                border:     "1px solid var(--accent-border)",
                color:      "var(--accent)",
              }}
            >
              LIVE SYNTHESIS
            </span>
            {/* Active filter indicator */}
            {libSources.some((s) => s.selected) && (
              <span
                className="text-[9px] px-2 py-0.5 rounded-full shrink-0 font-semibold"
                style={{
                  background: "rgba(251,146,60,0.10)",
                  border:     "1px solid rgba(251,146,60,0.25)",
                  color:      "#fb923c",
                }}
              >
                🔍 {libSources.filter((s) => s.selected).length} source
                {libSources.filter((s) => s.selected).length !== 1 ? "s" : ""} filtered
              </span>
            )}
          </div>

          <button
            onClick={() => { setRightOpen((v) => !v); setViewingSource(null); }}
            className="text-[11px] px-2.5 py-1.5 rounded-lg transition hover:bg-white/5"
            style={{ color: "var(--text-secondary)", border: "1px solid var(--border-mid)" }}
          >
            {rightOpen ? "Hide Sources" : "Show Sources"}
          </button>
        </header>

        {/* Toast */}
        {toast && (
          <div
            className="mx-auto mt-3 text-xs px-4 py-2 rounded-xl shadow animate-fade-up"
            style={{
              background: "var(--bg-elevated)",
              border:     "1px solid var(--border-mid)",
              color:      "var(--text-primary)",
            }}
          >
            {toast}
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-5">
          <div className="max-w-3xl mx-auto flex flex-col gap-5">

            {/* Empty state */}
            {session.messages.length === 0 && !loading && (
              <div className="flex flex-col items-center justify-center min-h-[60vh]
                              gap-6 text-center animate-fade-up">
                <div
                  className="w-20 h-20 rounded-3xl flex items-center justify-center text-4xl"
                  style={{ background: "var(--accent-dim)", border: "1px solid var(--accent-border)" }}
                >
                  🔬
                </div>
                <div>
                  <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
                    AI Research Assistant
                  </h1>
                  <p className="mt-2 text-sm" style={{ color: "var(--text-secondary)" }}>
                    Ask anything — I search your documents and the web.
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full max-w-lg">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      className="p-3 rounded-xl text-left text-xs leading-relaxed transition-all
                                 hover:scale-[1.02] active:scale-[0.98]"
                      style={{
                        background: "var(--bg-elevated)",
                        border:     "1px solid var(--border-mid)",
                        color:      "var(--text-secondary)",
                      }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Message list */}
            {session.messages.map((m) => (
              <Message
                key={m.id}
                message={m}
                onViewSource={(src) => {
                  setViewingSource(src);
                  setRightOpen(true);
                }}
              />
            ))}

            {/* Loading indicator */}
            {loading && (
              <div className="flex flex-col gap-3 animate-fade-up">
                <AgentProgress activeNode={activeNode} completedNodes={completedNodes} nodeOutputs={nodeOutputs} />
                <div className="flex gap-1.5 pl-11">
                  <div className="w-2 h-2 rounded-full animate-dot-1" style={{ background: "var(--accent)" }} />
                  <div className="w-2 h-2 rounded-full animate-dot-2" style={{ background: "var(--accent)" }} />
                  <div className="w-2 h-2 rounded-full animate-dot-3" style={{ background: "var(--accent)" }} />
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>
        </div>

        <InputBox onSend={send} disabled={loading} />
      </div>

      {/* ── Right sidebar ─────────────────────────────── */}
      {rightOpen && (
        <SourcePanel
          sources={session.sources}
          stats={session.stats}
          agentLog={session.agentLog}
          onClose={() => setRightOpen(false)}
          viewingSource={viewingSource}
          onCloseViewer={() => setViewingSource(null)}
        />
      )}
    </div>
  );
}
