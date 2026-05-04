"""
load_llama.py — Phase 2 (Model Loading)
Loads the QLoRA fine-tuned LLaMA-3 adapter for inference.
Supports merged and unmerged (PEFT) loading modes.
"""

import logging
import os
from pathlib import Path
from typing import Optional, Tuple

import torch
from transformers import (
    AutoModelForCausalLM,
    AutoTokenizer,
    BitsAndBytesConfig,
)
from peft import PeftModel

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────
# Defaults
# ─────────────────────────────────────────────

DEFAULT_BASE_MODEL  = "meta-llama/Meta-Llama-3-8B"
DEFAULT_ADAPTER_DIR = "./models/finetuned/llama_adapter"
DEFAULT_DEVICE      = "cuda" if torch.cuda.is_available() else "cpu"


# ─────────────────────────────────────────────
# Loader
# ─────────────────────────────────────────────

class LLaMALoader:
    """
    Loads the fine-tuned LLaMA-3 model and tokenizer.

    Two loading modes:
    - **Unmerged (PEFT):** Loads base model + adapter separately.
      Faster to load, lower memory, slightly slower inference.
      Best for: Development, experimentation.
    - **Merged:** Merges adapter weights into base model and saves.
      Faster inference, higher memory, one-time merge cost.
      Best for: Production deployment.
    """

    def __init__(
        self,
        base_model_name: str = DEFAULT_BASE_MODEL,
        adapter_path: str    = DEFAULT_ADAPTER_DIR,
        use_4bit: bool       = True,
        device: str          = DEFAULT_DEVICE,
        merge_weights: bool  = False,
    ):
        self.base_model_name = base_model_name
        self.adapter_path    = Path(adapter_path)
        self.use_4bit        = use_4bit
        self.device          = device
        self.merge_weights   = merge_weights

        self.model     = None
        self.tokenizer = None

    # ── Public API ────────────────────────────

    def load(self) -> Tuple:
        """
        Load and return (model, tokenizer).

        Returns:
            Tuple of (model, tokenizer).
        """
        self._validate_adapter_path()
        self.tokenizer = self._load_tokenizer()

        if self.merge_weights:
            self.model = self._load_merged()
        else:
            self.model = self._load_peft()

        self.model.eval()
        logger.info("Model ready for inference ✓")
        return self.model, self.tokenizer

    # ── Private ───────────────────────────────

    def _load_tokenizer(self):
        """Load tokenizer from adapter path (includes any special tokens)."""
        tokenizer = AutoTokenizer.from_pretrained(
            str(self.adapter_path),
            trust_remote_code=True,
        )
        if tokenizer.pad_token is None:
            tokenizer.pad_token = tokenizer.eos_token
        tokenizer.padding_side = "left"  # Left-pad for batch generation
        logger.info(f"Tokenizer loaded from {self.adapter_path}")
        return tokenizer

    def _load_peft(self):
        """Load base model + PEFT adapter (unmerged)."""
        logger.info(f"Loading base model: {self.base_model_name}")
        bnb_config = self._bnb_config() if self.use_4bit else None

        base = AutoModelForCausalLM.from_pretrained(
            self.base_model_name,
            quantization_config = bnb_config,
            device_map          = "auto",
            trust_remote_code   = True,
            torch_dtype         = torch.bfloat16,
        )

        logger.info(f"Applying LoRA adapter from {self.adapter_path}")
        model = PeftModel.from_pretrained(base, str(self.adapter_path))
        return model

    def _load_merged(self):
        """Merge adapter into base model for faster inference."""
        merged_path = self.adapter_path / "merged"

        if merged_path.exists():
            logger.info(f"Loading pre-merged model from {merged_path}")
            return AutoModelForCausalLM.from_pretrained(
                str(merged_path),
                device_map  = "auto",
                torch_dtype = torch.bfloat16,
            )

        # Merge and save
        logger.info("Merging adapter weights into base model (one-time operation)…")
        model = self._load_peft()

        # Merge requires fp16/32 — can't merge 4-bit
        if self.use_4bit:
            logger.warning("Cannot merge 4-bit quantized model. Reloading in fp16 for merge.")
            model = self._load_peft_fp16()

        merged = model.merge_and_unload()
        merged.save_pretrained(str(merged_path))
        self.tokenizer.save_pretrained(str(merged_path))
        logger.info(f"Merged model saved to {merged_path}")
        return merged

    def _load_peft_fp16(self):
        """Load PEFT model in fp16 (for merging)."""
        base = AutoModelForCausalLM.from_pretrained(
            self.base_model_name,
            device_map  = "auto",
            torch_dtype = torch.float16,
        )
        return PeftModel.from_pretrained(base, str(self.adapter_path))

    @staticmethod
    def _bnb_config() -> BitsAndBytesConfig:
        return BitsAndBytesConfig(
            load_in_4bit              = True,
            bnb_4bit_quant_type       = "nf4",
            bnb_4bit_compute_dtype    = torch.bfloat16,
            bnb_4bit_use_double_quant = True,
        )

    def _validate_adapter_path(self):
        if not self.adapter_path.exists():
            raise FileNotFoundError(
                f"Adapter not found at '{self.adapter_path}'. "
                f"Run the Colab notebook and download the adapter first."
            )
        required = ["adapter_config.json"]
        for f in required:
            if not (self.adapter_path / f).exists():
                raise FileNotFoundError(
                    f"'{f}' missing from adapter directory. "
                    "Ensure the full adapter was downloaded correctly."
                )


# ─────────────────────────────────────────────
# Convenience function
# ─────────────────────────────────────────────

def load_finetuned_llama(
    adapter_path: str = DEFAULT_ADAPTER_DIR,
    use_4bit: bool = True,
    merge_weights: bool = False,
) -> Tuple:
    """
    Quick loader — returns (model, tokenizer) ready for inference.

    Args:
        adapter_path:  Path to the downloaded LoRA adapter directory.
        use_4bit:      Load base model in 4-bit NF4 (recommended).
        merge_weights: Merge adapter into base model (faster inference, more RAM).

    Returns:
        (model, tokenizer) tuple.
    """
    loader = LLaMALoader(
        adapter_path  = adapter_path,
        use_4bit      = use_4bit,
        merge_weights = merge_weights,
    )
    return loader.load()
