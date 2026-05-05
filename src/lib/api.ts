const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export interface Source {
  title:       string;
  url?:        string;
  snippet:     string;
  source_type: "pdf" | "web";
}

export interface AgentEvent {
  type:     "status" | "answer" | "done" | "node_output";
  node?:    string;
  status?:  string;
  text?:    string;
  sources?: Source[];
  detail?:  string;   // node transparency text
  plan?:    Record<string, unknown>;
  full?:    string;   // full synthesis for reasoning step
}

export interface SourceItem {
  name:        string;
  source_type: string;
  url?:        string;
  count:       number;
}

export interface SourceChunk {
  text:   string;
  page?:  number;
  chunk:  number;
}

export async function* streamChat(
  message:      string,
  sourceFilter: string[] = [],
): AsyncGenerator<AgentEvent> {
  const resp = await fetch(`${API}/api/chat/stream`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ message, source_filter: sourceFilter }),
  });

  if (!resp.ok) throw new Error(`API error ${resp.status}`);
  const reader  = resp.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const blocks = buffer.split("\n\n");
    buffer = blocks.pop() ?? "";

    for (const block of blocks) {
      const eventLine = block.split("\n").find((l) => l.startsWith("event:"));
      const dataLine  = block.split("\n").find((l) => l.startsWith("data:"));
      if (!eventLine || !dataLine) continue;

      const eventType = eventLine.replace("event:", "").trim() as AgentEvent["type"];
      const data      = JSON.parse(dataLine.replace("data:", "").trim());
      yield { type: eventType, ...data };
    }
  }
}

export async function uploadPdf(file: File): Promise<{ status: string; filename: string }> {
  const form = new FormData();
  form.append("file", file);
  const resp = await fetch(`${API}/api/upload/pdf`, { method: "POST", body: form });
  if (!resp.ok) throw new Error("Upload failed");
  return resp.json();
}

export async function ingestUrl(url: string): Promise<{ status: string; filename: string }> {
  const resp = await fetch(`${API}/api/ingest/url`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ url }),
  });
  if (!resp.ok) throw new Error("URL ingest failed");
  return resp.json();
}

export async function listSources(): Promise<SourceItem[]> {
  const resp = await fetch(`${API}/api/sources`);
  if (!resp.ok) throw new Error("Failed to list sources");
  return resp.json();
}

export async function fetchSourceChunks(sourceName: string): Promise<SourceChunk[]> {
  const resp = await fetch(`${API}/api/sources/${encodeURIComponent(sourceName)}/chunks`);
  if (!resp.ok) throw new Error("Failed to fetch chunks");
  return resp.json();
}

/** Direct URL to serve the raw file (PDF, docx, txt) for the iframe viewer. */
export function getFileUrl(filename: string): string {
  return `${API}/api/files/${encodeURIComponent(filename)}`;
}
