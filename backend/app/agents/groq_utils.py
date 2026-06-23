"""Shared Groq call helper with retry + exponential backoff."""
import logging
import time

logger = logging.getLogger(__name__)

_RETRY_DELAYS = (5, 15)   # seconds: first retry after 5s, second after 15s


def invoke_with_backoff(llm, messages):
    """Invoke a LangChain LLM, retrying up to 2 times on 429 rate-limit errors."""
    for attempt in range(3):
        try:
            return llm.invoke(messages).content.strip()
        except Exception as exc:
            is_rate_limit = "429" in str(exc) or "rate_limit" in str(exc).lower()
            if is_rate_limit and attempt < 2:
                wait = _RETRY_DELAYS[attempt]
                logger.warning(
                    "Groq rate limit — waiting %ds before retry %d/2", wait, attempt + 1
                )
                time.sleep(wait)
            else:
                raise
