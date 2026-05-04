"""
model_router.py — Phase 2/3 (Model Routing)
Routes inference requests to the fine-tuned LLaMA adapter (local)
or OpenRouter API (cloud) based on query type, availability, and cost budget.
"""

import logging
import os
from enum import Enum
from typing import Iterator, Optional

import requests

from models.loaders.load_llama import load_finetuned_llama
from models.inference.generate import LLaMAGenerator, GenerationConfig, GenerationResult

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────
# Enums
# ─────────────────────────────────────────────

class ModelBackend(str, Enum):
    LOCAL_LLAMA    = "local_llama"       # Fine-tuned LLaMA adapter
    OPENROUTER     = "openrouter"        # Cloud API


class QueryType(str, Enum):
    ACADEMIC       = "academic"          # → fine-tuned LLaMA
    GENERAL        = "general"           # → OpenRouter
    CODE           = "code"             # → OpenRouter (code models)
    UNKNOWN        = "unknown"           # → fallback to OpenRouter


# ─────────────────────────────────────────────
# Model Router
# ─────────────────────────────────────────────

class ModelRouter:
    """
    Routes generation requests to the appropriate backend:

    Routing Logic:
    ┌───────────────────────────────┬──────────────────────┐
    │ Query Type                    │ Backend              │
    ├───────────────────────────────┼──────────────────────┤
    │ Academic / Research / RAG     │ Local Fine-Tuned LLaMA│
    │ General knowledge             │ OpenRouter (free)    │
    │ Code generation               │ OpenRouter (code)    │
    │ LLaMA unavailable             │ OpenRouter (fallback)│
    └───────────────────────────────┴──────────────────────┘
    """

    # Keywords that trigger academic routing
    ACADEMIC_KEYWORDS = [
        "research", "paper", "study", "methodology", "literature",
        "hypothesis", "experiment", "dataset", "model", "neural",
        "transformer", "embedding", "retrieval", "rag", "fine-tun",
        "citation", "academic", "journal", "abstract", "evaluation",
        "benchmark", "training", "inference", "gradient", "loss",
    ]

    # OpenRouter free model options (":free" suffix = no credits required)
    OPENROUTER_MODELS = {
        "general" : "meta-llama/llama-3.1-8b-instruct:free",
        "academic": "meta-llama/llama-3.1-8b-instruct:free",
        "code"    : "mistralai/mistral-7b-instruct:free",
        "fallback": "meta-llama/llama-3.1-8b-instruct:free",
    }

    def __init__(
        self,
        adapter_path: str          = "./models/finetuned/llama_adapter",
        openrouter_api_key: str    = "",
        prefer_local: bool         = True,
        auto_load_llama: bool      = True,
    ):
        """
        Args:
            adapter_path:       Path to downloaded LoRA adapter.
            openrouter_api_key: OpenRouter API key (from env or passed directly).
            prefer_local:       If True, always prefer fine-tuned model for academic queries.
            auto_load_llama:    Auto-load LLaMA on init (set False to load lazily).
        """
        self.adapter_path    = adapter_path
        self.api_key         = openrouter_api_key or os.getenv("OPENROUTER_API_KEY", "")
        self.prefer_local    = prefer_local
        self._llama_gen: Optional[LLaMAGenerator] = None
        self._llama_loaded   = False

        if auto_load_llama:
            self._try_load_llama()

    # ── Public API ────────────────────────────

    def route(
        self,
        instruction: str,
        context: str = "",
        query_type: Optional[QueryType] = None,
        stream: bool = False,
    ):
        """
        Route a generation request.

        Args:
            instruction: The user's question/task.
            context:     Retrieved RAG context.
            query_type:  Force a specific backend (or None = auto-detect).
            stream:      If True, return an iterator for streaming.

        Returns:
            GenerationResult (non-stream) or Iterator[str] (stream).
        """
        detected_type = query_type or self._classify_query(instruction)
        backend       = self._select_backend(detected_type)

        logger.info(f"Routing: type={detected_type.value}, backend={backend.value}")

        if backend == ModelBackend.LOCAL_LLAMA and self._llama_gen:
            return self._generate_local(instruction, context, stream)
        else:
            return self._generate_openrouter(instruction, context, detected_type, stream)

    def backend_status(self) -> dict:
        """Return availability status of both backends."""
        return {
            "local_llama": {
                "available": self._llama_loaded,
                "adapter_path": self.adapter_path,
            },
            "openrouter": {
                "available": bool(self.api_key),
                "models": self.OPENROUTER_MODELS,
            },
        }

    # ── Private ───────────────────────────────

    def _try_load_llama(self) -> None:
        """Attempt to load the local LLaMA model."""
        try:
            model, tokenizer = load_finetuned_llama(
                adapter_path=self.adapter_path, use_4bit=True
            )
            self._llama_gen   = LLaMAGenerator(model, tokenizer)
            self._llama_loaded = True
            logger.info("✅ Local LLaMA model loaded")
        except (FileNotFoundError, Exception) as exc:
            logger.warning(f"Local LLaMA not available: {exc}")
            logger.info("  → Falling back to OpenRouter for all queries")

    def _classify_query(self, instruction: str) -> QueryType:
        """Keyword-based query type classification."""
        lower = instruction.lower()
        if any(kw in lower for kw in self.ACADEMIC_KEYWORDS):
            return QueryType.ACADEMIC
        if any(kw in lower for kw in ["code", "python", "implement", "function", "class"]):
            return QueryType.CODE
        return QueryType.GENERAL

    def _select_backend(self, query_type: QueryType) -> ModelBackend:
        """Select backend based on query type and availability."""
        if query_type == QueryType.ACADEMIC and self._llama_loaded and self.prefer_local:
            return ModelBackend.LOCAL_LLAMA
        if self.api_key:
            return ModelBackend.OPENROUTER
        if self._llama_loaded:
            logger.warning("No OpenRouter key — falling back to local LLaMA")
            return ModelBackend.LOCAL_LLAMA
        raise RuntimeError("No inference backend available. Load LLaMA or set OPENROUTER_API_KEY.")

    def _generate_local(self, instruction: str, context: str, stream: bool):
        """Generate using local fine-tuned LLaMA."""
        if stream:
            return self._llama_gen.stream(instruction, context)
        return self._llama_gen.generate(instruction, context)

    def _generate_openrouter(
        self,
        instruction: str,
        context: str,
        query_type: QueryType,
        stream: bool,
    ):
        """Generate via OpenRouter API."""
        model_id = self.OPENROUTER_MODELS.get(query_type.value, self.OPENROUTER_MODELS["fallback"])

        messages = []
        if context:
            messages.append({
                "role": "system",
                "content": f"You are an academic research assistant. Use the following context to answer:\n\n{context}"
            })
        messages.append({"role": "user", "content": instruction})

        payload = {
            "model"  : model_id,
            "messages": messages,
            "stream" : stream,
            "max_tokens": 1500,
            "temperature": 0.4,
        }

        headers = {
            "Authorization" : f"Bearer {self.api_key}",
            "Content-Type"  : "application/json",
            "HTTP-Referer"  : "https://github.com/ai-research-assistant",
        }

        resp = requests.post(
            "https://openrouter.ai/api/v1/chat/completions",
            json=payload, headers=headers, stream=stream, timeout=60,
        )
        resp.raise_for_status()

        if stream:
            return self._stream_openrouter(resp)

        data = resp.json()
        text = data["choices"][0]["message"]["content"]
        return GenerationResult(
            text          = text,
            prompt_tokens = data["usage"]["prompt_tokens"],
            output_tokens = data["usage"]["completion_tokens"],
            latency_ms    = 0,
            model_source  = f"openrouter/{model_id}",
        )

    @staticmethod
    def _stream_openrouter(resp) -> Iterator[str]:
        """Yield tokens from OpenRouter SSE stream."""
        import json
        for line in resp.iter_lines():
            if line and line.startswith(b"data: "):
                data_str = line[6:].decode()
                if data_str == "[DONE]":
                    break
                try:
                    chunk = json.loads(data_str)
                    delta = chunk["choices"][0].get("delta", {})
                    if "content" in delta:
                        yield delta["content"]
                except (json.JSONDecodeError, KeyError):
                    continue
