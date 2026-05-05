"use client";
import { useState, useRef, useEffect } from "react";

interface Props {
  onSend: (message: string) => void;
  disabled?: boolean;
}

export default function InputBox({ onSend, disabled }: Props) {
  const [value, setValue] = useState("");
  const ref   = useRef<HTMLTextAreaElement>(null);

  /* Auto-resize textarea */
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
  }, [value]);

  function submit() {
    if (!value.trim() || disabled) return;
    onSend(value.trim());
    setValue("");
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  const focused = !!value;

  return (
    <div
      className="shrink-0 px-4 pb-4 pt-2 border-t"
      style={{ borderColor: "var(--border)", background: "var(--bg-surface)" }}
    >
      <div className="max-w-3xl mx-auto space-y-1.5">
        <div
          className="flex items-end gap-3 px-4 py-3 rounded-2xl border transition-all duration-200"
          style={{
            background:   "var(--bg-input)",
            borderColor:  focused ? "var(--accent)" : "var(--border-mid)",
            boxShadow:    focused ? "0 0 0 3px var(--accent-dim)" : "none",
          }}
        >
          <textarea
            ref={ref}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={onKey}
            disabled={disabled}
            placeholder="Ask anything about your research…"
            rows={1}
            className="flex-1 bg-transparent text-sm resize-none focus:outline-none leading-relaxed disabled:opacity-50"
            style={{ color: "var(--text-primary)", caretColor: "var(--accent)", maxHeight: "180px" }}
          />

          <div className="flex items-center gap-2 shrink-0 pb-0.5">
            <span
              className="hidden sm:block text-[10px] px-2 py-1 rounded-lg"
              style={{ background: "var(--border)", color: "var(--text-muted)" }}
            >
              Multi-Model · RAG + Web
            </span>

            <button
              onClick={submit}
              disabled={!value.trim() || disabled}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-white transition-all
                         hover:scale-105 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: "var(--accent)" }}
              aria-label="Send"
            >
              {disabled ? (
                /* Spinner */
                <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2.5">
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4
                           M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" strokeLinecap="round"/>
                </svg>
              ) : (
                /* Send arrow */
                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M2.01 21 23 12 2.01 3 2 10l15 2-15 2z"/>
                </svg>
              )}
            </button>
          </div>
        </div>

        <p className="text-center text-[10px]" style={{ color: "var(--text-muted)" }}>
          Enter to send · Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}
