"use client";
import { useState, useRef, useCallback } from "react";
import { uploadPdf } from "@/lib/api";
import type { IngestionSource } from "@/lib/types";

interface Props {
  onDone?: (msg: string, source?: IngestionSource) => void;
}

const ALLOWED = ["pdf", "docx", "txt", "md"];

export default function FileUpload({ onDone }: Props) {
  const [loading,  setLoading]  = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    async (file: File) => {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
      if (!ALLOWED.includes(ext)) {
        onDone?.(`Only ${ALLOWED.join(", ")} files are accepted.`);
        return;
      }
      setLoading(true);
      try {
        const r = await uploadPdf(file);
        const source: IngestionSource = {
          id:       crypto.randomUUID(),
          name:     r.filename,
          type:     ext === "pdf" ? "pdf" : "document",
          filename: r.filename,
          addedAt:  Date.now(),
          selected: true,
        };
        onDone?.(`✓ ${r.filename} ingested`, source);
      } catch {
        onDone?.("Upload failed. Is the backend running?");
      } finally {
        setLoading(false);
        if (fileRef.current) fileRef.current.value = "";
      }
    },
    [onDone],
  );

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }

  return (
    <>
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => fileRef.current?.click()}
        className="flex flex-col items-center gap-1.5 p-3 rounded-xl cursor-pointer
                   transition-all duration-200 select-none"
        style={{
          border:     `1.5px dashed ${dragging ? "var(--accent)" : "var(--border-mid)"}`,
          background: dragging ? "var(--accent-dim)" : "var(--bg-base)",
        }}
      >
        {loading ? (
          <svg className="animate-spin" width="18" height="18" viewBox="0 0 24 24" fill="none"
            stroke="var(--accent)" strokeWidth="2.5">
            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4
                     M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" strokeLinecap="round"/>
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
            stroke={dragging ? "var(--accent)" : "var(--text-muted)"}
            strokeWidth="2" strokeLinecap="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>
          </svg>
        )}
        <p className="text-[11px] text-center" style={{ color: "var(--text-muted)" }}>
          {loading ? "Uploading…" : dragging ? "Drop file here" : "Drag & drop PDF / DOCX / TXT"}
        </p>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept=".pdf,.docx,.txt,.md"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
      />
    </>
  );
}
