"""
Shared async OpenRouter client used by all agent nodes.
"""
import asyncio
import json
import re
import httpx

from backend.app.core.config import settings

_RETRY_CODES   = {429, 503}
_DEFAULT_RETRY = 4   # chat() — used by reasoner/generator (answer-quality critical)
_JSON_RETRY    = 2   # chat_json() — planner/researcher; fail fast, use heuristic fallback
_MAX_BACKOFF   = 30  # seconds


def _backoff(attempt: int, retry_after: float | None) -> float:
    """Return seconds to wait before the next attempt."""
    if retry_after and retry_after > 0:
        return min(retry_after, _MAX_BACKOFF)
    return min(5 * (2 ** attempt), _MAX_BACKOFF)   # 5 → 10 → 20 → 30


async def chat(
    model: str,
    messages: list[dict],
    temperature: float = 0.3,
    max_tokens: int    = 2048,
    timeout: int       = 90,
    max_retries: int   = _DEFAULT_RETRY,
) -> str:
    """
    Send a chat-completion request to OpenRouter.
    Retries on 429/503 using the Retry-After header when present.
    Raises httpx.HTTPStatusError on non-retryable failures.
    """
    if not settings.OPENROUTER_API_KEY:
        raise ValueError("OPENROUTER_API_KEY is not set. Add it to your .env file.")

    headers = {
        "Authorization": f"Bearer {settings.OPENROUTER_API_KEY}",
        "HTTP-Referer":  "http://localhost:3000",
        "X-Title":       "AI Research Assistant",
        "Content-Type":  "application/json",
    }
    body = {
        "model":       model,
        "messages":    messages,
        "temperature": temperature,
        "max_tokens":  max_tokens,
    }

    last_exc: Exception | None = None

    for attempt in range(max_retries):
        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                resp = await client.post(
                    f"{settings.OPENROUTER_BASE_URL}/chat/completions",
                    headers=headers,
                    json=body,
                )
                resp.raise_for_status()
                content = resp.json()["choices"][0]["message"]["content"]
                return content or ""

        except httpx.HTTPStatusError as exc:
            status = exc.response.status_code
            if status in _RETRY_CODES and attempt < max_retries - 1:
                retry_after = _parse_retry_after(exc.response)
                wait = _backoff(attempt, retry_after)
                await asyncio.sleep(wait)
                last_exc = exc
            else:
                raise

        except (httpx.TimeoutException, httpx.ConnectError) as exc:
            if attempt < max_retries - 1:
                await asyncio.sleep(_backoff(attempt, None))
                last_exc = exc
            else:
                raise

    raise last_exc  # type: ignore[misc]


async def chat_json(
    model: str,
    messages: list[dict],
    fallback: dict | None = None,
    **kwargs,
) -> dict:
    """
    Call the model expecting a JSON response.
    Uses fewer retries than chat() — planner/researcher fail fast and
    fall back to keyword heuristics, preserving quota for the generator.
    Returns `fallback` (default: {}) on any failure or parse error.
    """
    kwargs.setdefault("max_retries", _JSON_RETRY)
    try:
        text = await chat(model, messages, **kwargs)
        return _extract_json(text)
    except Exception:
        return fallback or {}


def _parse_retry_after(response: httpx.Response) -> float | None:
    """Read the Retry-After header (seconds or HTTP-date)."""
    value = response.headers.get("retry-after") or response.headers.get("x-ratelimit-reset-requests")
    if value is None:
        return None
    try:
        return float(value)
    except (ValueError, TypeError):
        return None


def _extract_json(text: str) -> dict:
    """Extract the first JSON object from an LLM response."""
    fence = re.search(r"```(?:json)?\s*(.*?)\s*```", text, re.DOTALL)
    raw   = fence.group(1) if fence else text

    try:
        result = json.loads(raw.strip())
        if isinstance(result, dict):
            return result
    except json.JSONDecodeError:
        pass

    brace = re.search(r"\{.*\}", raw, re.DOTALL)
    if brace:
        try:
            result = json.loads(brace.group())
            if isinstance(result, dict):
                return result
        except json.JSONDecodeError:
            pass

    return {}


def strip_think_tags(text: str) -> str:
    """Remove <think>...</think> blocks produced by reasoning models."""
    cleaned = re.sub(r"<think>.*?</think>", "", text, flags=re.DOTALL).strip()
    return cleaned if cleaned else text.strip()
