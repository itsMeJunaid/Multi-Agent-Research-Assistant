from pydantic_settings import BaseSettings
from typing import Literal


class Settings(BaseSettings):
    # ══════════════════════════════════════════════════════════
    # Multi-Provider Multi-Model Architecture
    # Every agent node uses its own specialist model via OpenRouter
    # ══════════════════════════════════════════════════════════

    # Shared OpenRouter endpoint & key
    OPENROUTER_BASE_URL: str = "https://openrouter.ai/api/v1"
    OPENROUTER_API_KEY:  str = ""

    # Planner — fast, structured JSON output
    PLANNER_MODEL:    str = "qwen/qwen3-next-80b-a3b-instruct:free"

    # Researcher — tool-capable, query optimization
    RESEARCHER_MODEL: str = "nvidia/nemotron-3-super-120b-a12b:free"

    # Reasoner — deep reasoning & synthesis
    REASONER_MODEL:   str = "openai/gpt-oss-120b:free"

    # Generator — best answer quality
    GENERATOR_MODEL:  str = "meta-llama/llama-3.3-70b-instruct:free"

    # Fallback — fast & reliable when a specialist fails
    FALLBACK_MODEL:   str = "meta-llama/llama-3.2-3b-instruct:free"

    # ── Optional single-model backends (legacy / alternative) ─
    LLM_MODE: Literal["multi", "openrouter", "claude", "gemini", "ollama"] = "multi"

    ANTHROPIC_API_KEY: str = ""
    CLAUDE_MODEL:      str = "claude-sonnet-4-6"

    GEMINI_API_KEY: str = ""
    GEMINI_MODEL:   str = "gemini-2.0-flash"

    OLLAMA_BASE_URL: str = "http://localhost:11434"
    OLLAMA_MODEL:    str = "llama3"

    # ── Qdrant vector store ────────────────────────────────────
    QDRANT_MODE:       Literal["memory", "local", "cloud"] = "memory"
    QDRANT_URL:        str = "http://localhost:6333"
    QDRANT_CLOUD_URL:  str = ""
    QDRANT_API_KEY:    str = ""
    QDRANT_COLLECTION: str = "research_docs"

    # ── Web search ─────────────────────────────────────────────
    TAVILY_API_KEY: str = ""
    SERPER_API_KEY: str = ""

    # ── App ────────────────────────────────────────────────────
    APP_ENV:      str = "development"
    LOG_LEVEL:    str = "INFO"
    CORS_ORIGINS: str = "http://localhost:3000"

    # ── LangSmith tracing (optional) ───────────────────────────
    LANGCHAIN_TRACING_V2: bool = False
    LANGCHAIN_API_KEY:    str  = ""
    LANGCHAIN_PROJECT:    str  = "ai-research-assistant"

    class Config:
        env_file = ".env"
        extra    = "ignore"


settings = Settings()
