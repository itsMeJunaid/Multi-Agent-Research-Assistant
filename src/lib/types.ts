import type { Source } from "./api";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
  isError?: boolean;
}

export interface AgentLogEntry {
  node:   string;
  status: "running" | "done";
  time:   string;
}

export interface NodeOutput {
  node:    string;
  detail:  string;    // short summary for the inline transparency pill
  full?:   string;    // full text for reasoning step expand
  plan?:   Record<string, unknown>;
}

export interface SessionStats {
  tokens: number;
  chunks: number;
  latency: number;
  model: string;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  sources: Source[];
  agentLog: AgentLogEntry[];
  stats: SessionStats;
}

/** A document or URL that has been ingested into the knowledge base. */
export interface IngestionSource {
  id:        string;
  name:      string;
  type:      "pdf" | "url" | "document";
  filename?: string;   // for PDFs/docs — used to build /api/files/{filename} URL
  url?:      string;   // for URLs
  addedAt:   number;
  selected:  boolean;  // true = include in RAG filter; false = exclude
}
