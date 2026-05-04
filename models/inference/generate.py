"""
generate.py — Phase 2 (Model Inference)
Streaming and batch generation using the fine-tuned LLaMA-3 adapter.
Designed to plug into the Phase 3 agent system via model_router.py.
"""

import logging
import time
from dataclasses import dataclass, field
from typing import Iterator, List, Optional

import torch
from transformers import TextIteratorStreamer
from threading import Thread

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────
# Generation Config
# ─────────────────────────────────────────────

@dataclass
class GenerationConfig:
    max_new_tokens:      int   = 512
    temperature:         float = 0.4
    top_p:               float = 0.9
    top_k:               int   = 50
    repetition_penalty:  float = 1.15
    do_sample:           bool  = True
    stream:              bool  = False


# ─────────────────────────────────────────────
# Response object
# ─────────────────────────────────────────────

@dataclass
class GenerationResult:
    text:          str
    prompt_tokens: int
    output_tokens: int
    latency_ms:    float
    model_source:  str = "llama_finetuned"


# ─────────────────────────────────────────────
# Generator
# ─────────────────────────────────────────────

class LLaMAGenerator:
    """
    Wraps the fine-tuned LLaMA model for academic-style generation.

    Supports:
    - Standard (non-streaming) generation → GenerationResult
    - Streaming generation → Iterator[str] (for FastAPI StreamingResponse)
    - Batch generation for evaluation
    """

    ALPACA_TEMPLATE = (
        "### Instruction:\n{instruction}\n\n"
        "### Input:\n{context}\n\n"
        "### Response:"
    )

    ALPACA_NO_INPUT = (
        "### Instruction:\n{instruction}\n\n"
        "### Response:"
    )

    def __init__(self, model, tokenizer, config: Optional[GenerationConfig] = None):
        self.model     = model
        self.tokenizer = tokenizer
        self.config    = config or GenerationConfig()
        self.device    = next(model.parameters()).device

    # ── Public API ────────────────────────────

    def generate(
        self,
        instruction: str,
        context: str = "",
        config: Optional[GenerationConfig] = None,
    ) -> GenerationResult:
        """
        Generate a response to an instruction.

        Args:
            instruction: The research question or task.
            context:     Retrieved RAG context (optional).
            config:      Override generation config.

        Returns:
            GenerationResult with text, token counts, latency.
        """
        cfg = config or self.config
        prompt = self._build_prompt(instruction, context)
        inputs = self._tokenize(prompt)

        t0 = time.time()
        with torch.no_grad():
            output_ids = self.model.generate(
                **inputs,
                max_new_tokens     = cfg.max_new_tokens,
                temperature        = cfg.temperature,
                top_p              = cfg.top_p,
                top_k              = cfg.top_k,
                repetition_penalty = cfg.repetition_penalty,
                do_sample          = cfg.do_sample,
                pad_token_id       = self.tokenizer.eos_token_id,
                eos_token_id       = self.tokenizer.eos_token_id,
            )
        latency_ms = (time.time() - t0) * 1000

        prompt_len = inputs["input_ids"].shape[-1]
        new_ids    = output_ids[0][prompt_len:]
        text       = self.tokenizer.decode(new_ids, skip_special_tokens=True).strip()

        return GenerationResult(
            text          = text,
            prompt_tokens = prompt_len,
            output_tokens = len(new_ids),
            latency_ms    = latency_ms,
        )

    def stream(
        self,
        instruction: str,
        context: str = "",
        config: Optional[GenerationConfig] = None,
    ) -> Iterator[str]:
        """
        Stream generated tokens one-by-one.

        Yields:
            Decoded token strings as they are generated.

        Usage with FastAPI:
            return StreamingResponse(generator.stream(instruction), media_type="text/plain")
        """
        cfg = config or self.config
        prompt = self._build_prompt(instruction, context)
        inputs = self._tokenize(prompt)

        streamer = TextIteratorStreamer(
            self.tokenizer,
            skip_prompt      = True,
            skip_special_tokens = True,
        )

        gen_kwargs = {
            **inputs,
            "streamer"          : streamer,
            "max_new_tokens"    : cfg.max_new_tokens,
            "temperature"       : cfg.temperature,
            "top_p"             : cfg.top_p,
            "repetition_penalty": cfg.repetition_penalty,
            "do_sample"         : cfg.do_sample,
            "pad_token_id"      : self.tokenizer.eos_token_id,
        }

        # Run generation in a background thread
        thread = Thread(target=self.model.generate, kwargs=gen_kwargs)
        thread.start()

        for token_text in streamer:
            yield token_text

        thread.join()

    def batch_generate(
        self,
        instructions: List[str],
        config: Optional[GenerationConfig] = None,
    ) -> List[GenerationResult]:
        """Generate responses for a list of instructions (evaluation mode)."""
        return [self.generate(inst, config=config) for inst in instructions]

    # ── Private ───────────────────────────────

    def _build_prompt(self, instruction: str, context: str) -> str:
        """Format prompt using Alpaca template."""
        if context.strip():
            return self.ALPACA_TEMPLATE.format(
                instruction=instruction,
                context=context,
            )
        return self.ALPACA_NO_INPUT.format(instruction=instruction)

    def _tokenize(self, prompt: str) -> dict:
        """Tokenize prompt and move to model device."""
        inputs = self.tokenizer(
            prompt,
            return_tensors = "pt",
            truncation     = True,
            max_length     = 1024,
        )
        return {k: v.to(self.device) for k, v in inputs.items()}
