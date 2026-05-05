"use client";
import type { Source } from "@/lib/api";

interface Props {
  sources: Source[];
}

export default function CitationPanel({ sources }: Props) {
  if (!sources.length) return null;

  return (
    <div className="w-72 shrink-0 bg-[#1c1c2e] border-l border-white/5 p-4 overflow-y-auto scrollbar-thin">
      <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
        Sources ({sources.length})
      </h2>
      <div className="flex flex-col gap-3">
        {sources.map((s, i) => (
          <div key={i} className="p-3 rounded-lg bg-white/5 border border-white/5">
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold
                ${s.source_type === "pdf"
                  ? "bg-orange-500/20 text-orange-300"
                  : "bg-blue-500/20 text-blue-300"}`}>
                {s.source_type.toUpperCase()}
              </span>
              <span className="text-xs font-medium text-gray-200 truncate">{s.title}</span>
            </div>
            {s.url && (
              <a href={s.url} target="_blank" rel="noreferrer"
                className="text-[10px] text-violet-400 hover:underline truncate block">
                {s.url}
              </a>
            )}
            <p className="text-[11px] text-gray-400 mt-1 line-clamp-3">{s.snippet}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
