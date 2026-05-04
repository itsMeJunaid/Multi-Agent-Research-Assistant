# Multi Agent Research Assistant — Agentic RAG + Web Search

A production-grade AI research assistant built with **FastAPI**, **LangGraph**, **Qdrant**, and **Next.js**.
Upload PDFs or URLs, ask questions, and get AI-generated answers with citations — powered by a multi-agent pipeline.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [File Structure — Every File Explained](#file-structure--every-file-explained)
3. [Qdrant Modes: Memory / Local / Cloud](#qdrant-modes-memory--local--cloud)
4. [LLM Modes: OpenRouter / Claude / Ollama](#llm-modes-openrouter--claude--ollama)
5. [LangGraph Agent Flow](#langgraph-agent-flow)
6. [LangGraph Monitoring with LangSmith](#langgraph-monitoring-with-langsmith)
7. [Setup Guide — Local Development](#setup-guide--local-development)
8. [Setup Guide — Docker (Full Stack)](#setup-guide--docker-full-stack)
9. [API Reference](#api-reference)
10. [Environment Variables Reference](#environment-variables-reference)
11. [Test Flow](#test-flow)

---

## Architecture Overview

```
Browser (Next.js)
    │
    │  HTTP / SSE (streaming)
    ▼
FastAPI (port 8000)
    │
    ├── POST /api/chat/stream  ──► LangGraph Agent
    │                                  │
    │                    ┌─────────────┼─────────────┐
    │                    ▼             ▼             ▼
    │               Planner      Researcher      Reasoning
    │                                  │
    │                         ┌────────┴────────┐
    │                         ▼                 ▼
    │                      RAG Tool         Web Search
    │                      (Qdrant)         (Tavily)
    │                         │
    │                    Generator (LLM)
    │                         │
    │                    Answer + Sources
    │
    └── POST /api/upload/pdf  ──► PDF Loader → Chunker → Embedder → Qdrant
        POST /api/ingest/url  ──► URL Loader → Chunker → Embedder → Qdrant
```

---

## File Structure — Every File Explained

```
ai-research-assistant/
│
├── backend/                        ← FastAPI backend
│   └── app/
│       ├── main.py                 ← App entry point: FastAPI init, CORS, lifespan, routers
│       ├── core/
│       │   ├── config.py           ← All settings from .env via pydantic-settings
│       │   └── logging.py          ← Structured logging (structlog), dev/prod mode
│       ├── models/
│       │   └── schemas.py          ← Pydantic models: ChatRequest, ChatResponse, Source, etc.
│       ├── api/
│       │   ├── chat.py             ← Routes: POST /chat (non-stream) + POST /chat/stream (SSE)
│       │   └── upload.py           ← Routes: POST /upload/pdf + POST /ingest/url
│       └── services/
│           ├── agent_service.py    ← Calls LangGraph, maps result to ChatResponse
│           └── chat_service.py     ← Wraps agent into SSE generator for streaming
│
├── agents/                         ← LangGraph multi-agent system
│   ├── graph.py                    ← Builds & compiles the StateGraph (Planner→Researcher→Reasoning→Generator)
│   ├── nodes/
│   │   ├── planner_node.py         ← Decides strategy: needs RAG? needs web search? sets plan
│   │   ├── researcher_node.py      ← Calls rag_tool and/or web_search based on plan
│   │   ├── reasoning_node.py       ← Merges RAG + web context, deduplicates, builds source list
│   │   └── generator_node.py       ← Calls LLM (OpenRouter/Claude/Ollama), produces final answer
│   └── tools/
│       ├── rag_tool.py             ← LangChain tool: embed query → Qdrant search → return context
│       ├── web_search.py           ← LangChain tool: Tavily or Serper web search
│       └── url_fetch.py            ← LangChain tool: fetch & extract text from any URL
│
├── rag/                            ← RAG ingestion + retrieval pipeline
│   ├── ingestion/
│   │   ├── pdf_loader.py           ← Load PDF pages with pypdf, return [{text, metadata}]
│   │   ├── url_loader.py           ← Fetch URL with httpx, extract text with BeautifulSoup
│   │   └── chunking.py             ← Split docs with RecursiveCharacterTextSplitter (512 tokens, 64 overlap)
│   ├── embeddings/
│   │   └── embedder.py             ← Sentence-transformers: all-MiniLM-L6-v2, singleton model, 384-dim vectors
│   ├── vectorstore/
│   │   └── qdrant_client.py        ← Qdrant wrapper: memory/local/cloud mode, upsert + cosine search
│   └── pipeline/
│       └── rag_pipeline.py         ← retrieve(query) → embed → search → return top-k chunks
│
├── frontend/                       ← Next.js 14 App Router frontend
│   └── src/
│       ├── app/
│       │   ├── layout.tsx          ← Root layout: dark mode, metadata, global CSS
│       │   ├── page.tsx            ← Home page: renders <ChatBox />
│       │   └── globals.css         ← Tailwind base + custom scrollbar
│       ├── components/
│       │   ├── ChatBox.tsx         ← Main chat UI: message list, input, SSE streaming, agent progress
│       │   ├── Message.tsx         ← Individual message bubble with markdown + source badges
│       │   ├── AgentProgress.tsx   ← Real-time node execution tracker (Planner→Researcher→Reasoning→Generator)
│       │   ├── FileUpload.tsx      ← PDF upload + URL ingest UI with loading states
│       │   └── CitationPanel.tsx   ← Right sidebar: all sources from all messages
│       └── lib/
│           └── api.ts              ← Fetch helpers: streamChat (SSE), uploadPdf, ingestUrl
│
├── data/
│   └── raw/                        ← Uploaded PDFs stored here before ingestion
│
├── scripts/
│   └── ingest_pdf.py               ← CLI tool: python -m scripts.ingest_pdf file.pdf
│
├── infra/
│   └── docker/
│       ├── backend.Dockerfile      ← Python 3.11-slim, installs requirements, runs uvicorn
│       └── frontend.Dockerfile     ← Node 20 multi-stage build: deps → build → runner
│
├── tests/
│   ├── test_health.py              ← Tests /health endpoint with ASGI test client
│   └── test_chunking.py            ← Tests chunking logic (chunk count, size, metadata)
│
├── requirements.txt                ← All Python dependencies with pinned versions
├── docker-compose.yml              ← Orchestrates: qdrant + backend + frontend
├── .env.example                    ← Template for all environment variables
└── README.md                       ← This file
```

---

## Qdrant Modes: Memory / Local / Cloud

Set `QDRANT_MODE` in your `.env` to switch between modes.

### Mode 1: `memory` — Zero Setup, No Persistence

```env
QDRANT_MODE=memory
```

**What it does:** Qdrant runs entirely in-process (RAM). All vectors are lost when the server restarts.

**When to use:** Local development, testing, CI/CD pipelines, demos.

**How it works internally:**
```python
client = QdrantClient(":memory:")  # qdrant_client.py line ~28
```

**Pros:** Instant start, no Docker, no config.
**Cons:** Data lost on restart.

---

### Mode 2: `local` — Persistent Local Server

```env
QDRANT_MODE=local
QDRANT_URL=http://localhost:6333
```

**What it does:** Connects to a Qdrant server running locally (Docker or native binary). Data persists to disk.

**Start Qdrant with Docker:**
```bash
docker run -p 6333:6333 -v $(pwd)/qdrant_data:/qdrant/storage qdrant/qdrant
```

**Or via docker-compose** (already configured):
```bash
docker-compose up qdrant
```

**Dashboard:** http://localhost:6333/dashboard

**Pros:** Persistent data, fast, free, full Qdrant features.
**Cons:** Requires Docker or binary install.

---

### Mode 3: `cloud` — Qdrant Cloud Cluster

```env
QDRANT_MODE=cloud
QDRANT_CLOUD_URL=https://your-cluster.qdrant.io
QDRANT_API_KEY=your-qdrant-api-key
```

**What it does:** Connects to a managed Qdrant cluster at https://cloud.qdrant.io

**Setup:**
1. Go to https://cloud.qdrant.io → Create free cluster
2. Copy the cluster URL and API key
3. Paste into `.env`

**Pros:** No local infra, scales automatically, production-ready.
**Cons:** Requires account, latency higher than local.

---

## LLM Modes: OpenRouter / Claude / Ollama

Set `LLM_MODE` in `.env`.

### Mode 1: `openrouter` — Cloud, Many Models

```env
LLM_MODE=openrouter
OPENROUTER_API_KEY=sk-or-...
OPENROUTER_MODEL=mistralai/mistral-7b-instruct
```

**Other popular models:**
- `meta-llama/llama-3.1-8b-instruct` (free tier available)
- `anthropic/claude-3-haiku`
- `google/gemini-flash-1.5`

**Get key:** https://openrouter.ai/keys

---

### Mode 2: `claude` — Anthropic Claude (Direct)

```env
LLM_MODE=claude
ANTHROPIC_API_KEY=sk-ant-...
CLAUDE_MODEL=claude-sonnet-4-6
```

**Available models:** `claude-opus-4-7`, `claude-sonnet-4-6`, `claude-haiku-4-5-20251001`

**Get key:** https://console.anthropic.com

**Best for:** Highest quality answers, research tasks requiring deep reasoning.

---

### Mode 3: `ollama` — Local, Free, Private

```env
LLM_MODE=ollama
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3
```

**Setup Ollama:**
```bash
# Install
curl -fsSL https://ollama.ai/install.sh | sh

# Pull a model
ollama pull llama3
ollama pull mistral
ollama pull phi3

# Start server (auto-starts on install)
ollama serve
```

**Best for:** Privacy, no API costs, offline use.

---

## LangGraph Agent Flow

The agent is a directed graph compiled by LangGraph:

```
┌─────────┐    ┌────────────┐    ┌──────────┐    ┌──────────┐
│ Planner │───►│ Researcher │───►│ Reasoning│───►│Generator │───► END
└─────────┘    └────────────┘    └──────────┘    └──────────┘
```

### Node 1: Planner (`agents/nodes/planner_node.py`)
- Reads the query
- Detects keywords: "latest", "2025", "recent", "news" → activates web search
- Always activates RAG search
- Writes a human-readable plan into state

### Node 2: Researcher (`agents/nodes/researcher_node.py`)
- Reads the plan
- Calls `rag_tool` → searches Qdrant with embedded query
- Calls `web_search` → queries Tavily/Serper if web needed
- Stores results in `state.rag_context` and `state.web_context`

### Node 3: Reasoning (`agents/nodes/reasoning_node.py`)
- Merges RAG + web context into a single block
- Deduplicates and labels each section
- Builds the `sources` list
- Writes to `state.reasoning`

### Node 4: Generator (`agents/nodes/generator_node.py`)
- Formats the system prompt + context + query
- Calls the configured LLM (OpenRouter/Claude/Ollama)
- Writes final answer to `state.answer`

### State Schema (`AgentState` TypedDict)
```python
{
  "query":       str,   # user question
  "plan":        str,   # planner output
  "rag_context": str,   # from Qdrant
  "web_context": str,   # from Tavily/Serper
  "reasoning":   str,   # merged context
  "answer":      str,   # final LLM output
  "sources":     list,  # citation list
}
```

---

## LangGraph Monitoring with LangSmith

LangSmith provides full trace visibility into every agent run.

### Setup

```env
LANGCHAIN_TRACING_V2=true
LANGCHAIN_API_KEY=ls__...
LANGCHAIN_PROJECT=ai-research-assistant
```

**Get key:** https://smith.langchain.com → Settings → API Keys

### What you see in LangSmith
- Full trace of each graph run
- Input/output of every node
- Token usage per node
- Latency per node
- Tool call traces (rag_tool, web_search, url_fetch)
- Error traces with full stack

### Dashboard
After sending a chat message, go to https://smith.langchain.com → your project → Traces.

---

## Setup Guide — Local Development

### Prerequisites
- Python 3.11+
- Node.js 20+
- Docker (for Qdrant in local mode) — optional

### Step 1: Clone and configure

```bash
cd full-stack-ai-research-assistant
cp .env
# Edit .env with your API keys
```

### Step 2: Python environment

```bash
uv init
uv venv
source venv/bin/activate        # Linux/Mac
# venv\Scripts\activate         # Windows

uv add -r requirements.txt
```

### Step 3: Start Qdrant (if using local mode)

```bash
docker run -d -p 6333:6333 -v $(pwd)/qdrant_data:/qdrant/storage qdrant/qdrant
```

Or set `QDRANT_MODE=memory` in `.env` to skip this step.

### Step 4: Start the backend

```bash
uvicorn backend.app.main:app --reload --port 8000
```

Verify: http://localhost:8000/health

### Step 5: Start the frontend

```bash
cd frontend
npm install
npm run dev
```

Open: http://localhost:3000

### Step 6: Ingest a PDF (optional)

```bash
# Via CLI
python -m scripts.ingest_pdf data/raw/your-paper.pdf

# Or drag-and-drop in the UI
```

### Step 7: Run tests

```bash
pytest tests/ -v
```

---

## Setup Guide — Docker (Full Stack)

Starts **Qdrant + Backend + Frontend** with one command.

### Step 1: Configure

```bash
cp .env.example .env
# Set your API keys in .env
```

### Step 2: Build and run

```bash
docker-compose up --build
```

### Step 3: Access

| Service  | URL                          |
|----------|------------------------------|
| Frontend | http://localhost:3000        |
| Backend  | http://localhost:8000        |
| API Docs | http://localhost:8000/docs   |
| Qdrant   | http://localhost:6333/dashboard |

### Step 4: Stop

```bash
docker-compose down
# To also remove volumes (reset vector data):
docker-compose down -v
```

### Rebuild after code changes

```bash
docker-compose up --build backend
```

---

## API Reference

### `GET /health`
Returns system status.
```json
{"status": "ok", "version": "1.0.0", "qdrant_mode": "local", "llm_mode": "openrouter"}
```

### `POST /api/chat`
Non-streaming chat.
```json
// Request
{"message": "What is RAG?"}

// Response
{
  "answer": "RAG stands for...",
  "sources": [
    {"title": "Document Store", "snippet": "...", "source_type": "pdf"}
  ]
}
```

### `POST /api/chat/stream`
Server-Sent Events streaming. Events:
```
event: status
data: {"node": "planner", "status": "running"}

event: status
data: {"node": "researcher", "status": "done"}

event: answer
data: {"text": "RAG stands for...", "sources": [...]}

event: done
data: {}
```

### `POST /api/upload/pdf`
Upload a PDF file (multipart/form-data, field name: `file`).
```json
{"status": "ingesting", "filename": "paper.pdf", "chunks": 0}
```

### `POST /api/ingest/url`
Ingest a URL.
```json
// Request
{"url": "https://example.com/article"}

// Response
{"status": "ingesting", "filename": "https://example.com/article", "chunks": 0}
```

---

## Environment Variables Reference

| Variable | Default | Description |
|---|---|---|
| `LLM_MODE` | `openrouter` | LLM backend: `openrouter`, `claude`, `ollama` |
| `OPENROUTER_API_KEY` | — | OpenRouter API key |
| `OPENROUTER_MODEL` | `mistralai/mistral-7b-instruct` | Model to use on OpenRouter |
| `ANTHROPIC_API_KEY` | — | Anthropic API key (Claude mode) |
| `CLAUDE_MODEL` | `claude-sonnet-4-6` | Claude model ID |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Ollama server URL |
| `OLLAMA_MODEL` | `llama3` | Ollama model name |
| `QDRANT_MODE` | `local` | Qdrant backend: `memory`, `local`, `cloud` |
| `QDRANT_URL` | `http://localhost:6333` | Local Qdrant URL |
| `QDRANT_CLOUD_URL` | — | Qdrant Cloud cluster URL |
| `QDRANT_API_KEY` | — | Qdrant Cloud API key |
| `QDRANT_COLLECTION` | `research_docs` | Collection name |
| `TAVILY_API_KEY` | — | Tavily search API key |
| `SERPER_API_KEY` | — | Serper.dev API key (fallback) |
| `LANGCHAIN_TRACING_V2` | `false` | Enable LangSmith tracing |
| `LANGCHAIN_API_KEY` | — | LangSmith API key |
| `LANGCHAIN_PROJECT` | `ai-research-assistant` | LangSmith project name |
| `CORS_ORIGINS` | `http://localhost:3000` | Allowed CORS origins |

---

## Test Flow

### 1. Upload a PDF
- Drag your PDF into the sidebar → "Upload PDF"
- The backend loads, chunks (512 tokens), embeds (all-MiniLM-L6-v2), and stores in Qdrant

### 2. Ask a question about it
```
What are the main contributions of this paper?
```

### 3. Watch the agent run
The `AgentProgress` bar shows:
```
Planning ✓ → Researching ✓ → Reasoning ✓ → Generating...
```

### 4. Get answer + citations
The answer appears with `[PDF]` badges for document sources.
The right panel shows all source cards.

### 5. Ask a real-time question
```
What are the latest RAG improvements in 2025?
```
The planner detects "2025" → activates web search → Tavily returns live results → merged with local docs.

---

