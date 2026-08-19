import os
import json
import time
import logging
import requests
from groq import Groq
from mistralai.client import Mistral

logger = logging.getLogger("ingestion_logger")


class PrimaryGeneratorClient:
    """
    Model A (Candidate Generator):
    Uses Groq Cloud API & Gemini Flash APIs to generate JSON payloads
    strictly for missing fields (description, tech_name, ecosystem).
    Implements Round-Robin load balancing and per-model smart rate-limit cooldown tracking.
    """

    def __init__(self):
        self.groq_api_key = os.environ.get("GROQ_API_KEY")
        self.gemini_key = os.environ.get("GEMINI_API_KEY")

        self.groq_client = Groq(api_key=self.groq_api_key) if self.groq_api_key else None

        # Pool of models (Provider, Model Identifier)
        self.model_pool = [
            ("groq", "qwen/qwen3.6-27b"),
            ("groq", "openai/gpt-oss-20b"),
            ("groq", "openai/gpt-oss-120b"),
            ("gemini", "gemini-3.6-flash"),
            ("gemini", "gemini-3.5-flash"),
            ("gemini", "gemini-flash-latest"),
        ]
        self._current_index = 0
        self._model_cooldowns = {}  # { "provider:model": expire_timestamp }

    def _is_cooling_down(self, provider_model_key: str) -> bool:
        """Returns True if the specified model is currently cooling down due to a rate limit."""
        expire_time = self._model_cooldowns.get(provider_model_key, 0)
        return time.time() < expire_time

    def _set_cooldown(self, provider_model_key: str, cooldown_seconds: int = 30):
        """Sets a cooldown window for a model that encountered rate limits."""
        self._model_cooldowns[provider_model_key] = time.time() + cooldown_seconds
        logger.info(f"[AI Cooldown Tracker] Model '{provider_model_key}' placed on {cooldown_seconds}s rate-limit cooldown.")

    def _execute_groq(self, model: str, prompt: str) -> dict:
        """Helper to send request to Groq provider."""
        if not self.groq_client:
            return {}
        response = self.groq_client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
            temperature=0.1,
            timeout=30,
        )
        raw_content = response.choices[0].message.content
        if raw_content:
            parsed = json.loads(raw_content)
            if isinstance(parsed, dict):
                return {k: v.strip() for k, v in parsed.items() if isinstance(v, str) and v.strip()}
        return {}

    def _execute_gemini(self, model: str, prompt: str) -> dict:
        """Helper to send request to Gemini provider."""
        if not self.gemini_key:
            return {}
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={self.gemini_key}"
        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {
                "response_mime_type": "application/json",
                "temperature": 0.1
            }
        }
        res = requests.post(url, json=payload, timeout=40)
        if res.status_code == 200:
            raw_text = res.json()["candidates"][0]["content"]["parts"][0]["text"].strip()
            if raw_text.startswith("```"):
                lines = raw_text.splitlines()
                if lines[0].startswith("```"):
                    lines = lines[1:]
                if lines and lines[-1].strip() == "```":
                    lines = lines[:-1]
                raw_text = "\n".join(lines).strip()
            parsed = json.loads(raw_text)
            if isinstance(parsed, dict):
                return {k: v.strip() for k, v in parsed.items() if isinstance(v, str) and v.strip()}
        else:
            raise Exception(f"Gemini HTTP {res.status_code}: {res.text}")
        return {}

    def generate_candidates(self, context_text: str, missing_fields: list) -> dict:
        """
        Generates candidate values using Round-Robin load balancing across 6 models.
        Rotates starting model index on every call, skipping models on rate-limit cooldown.
        """
        prompt = f"""
                    Analyze the provided vulnerability context and generate or extract values ONLY for these missing fields: {missing_fields}.

                    Raw Advisory Context:
                    {context_text}

                    Strict Operational Rules:
                    - Return ONLY a valid JSON object containing keys from: {missing_fields}.
                    - NEVER return generic filler strings like "No description available", "N/A", or "Unknown".
                    - REFERENCE URL & METADATA ANALYSIS: If no narrative description text is explicitly present, you MUST analyze the reference URLs, package names, GitHub repository paths, vendor advisories, and ecosystem identifiers included in the context.
                    - SYNTHESIS INSTRUCTION: Synthesize a concise 2-3 sentence technical description explaining what software component, repository, or library is affected based on the reference patterns and metadata.
                    - ECOSYSTEM & TECH INFERENCE: Infer `ecosystem` (e.g., PyPI, npm, Maven, Linux, Go, Cargo) and `tech_name` (e.g., Django, React, Linux Kernel) directly from package names, GitHub repo paths, or URL paths if not explicitly stated.
                    - Do NOT include keys in the JSON for fields not listed in {missing_fields}.
                    """

        num_models = len(self.model_pool)
        start_idx = self._current_index
        # Advance Round-Robin index for next request call
        self._current_index = (self._current_index + 1) % num_models

        last_error = None
        # Try each model starting from start_idx in Round-Robin order
        for offset in range(num_models):
            idx = (start_idx + offset) % num_models
            provider, model = self.model_pool[idx]
            model_key = f"{provider}:{model}"

            # Check if model is currently on rate-limit cooldown
            if self._is_cooling_down(model_key):
                remaining = int(self._model_cooldowns[model_key] - time.time())
                logger.info(f"[AI Generator] Skipping '{model_key}' (on cooldown for {remaining}s remaining)...")
                continue

            try:
                if provider == "groq":
                    res = self._execute_groq(model, prompt)
                elif provider == "gemini":
                    res = self._execute_gemini(model, prompt)
                else:
                    res = {}

                if res:
                    logger.info(f"[AI Generator] Successfully generated candidates using {model_key}")
                    return res
            except Exception as e:
                last_error = e
                err_str = str(e)
                # If error is a rate limit (HTTP 429 or Groq rate limit message), trigger 30s cooldown
                if "429" in err_str or "rate limit" in err_str.lower() or "quota" in err_str.lower():
                    self._set_cooldown(model_key, cooldown_seconds=30)

                logger.warning(f"[AI Generator] Model {model_key} failed: {e}. Trying next in round-robin...")
                continue

        logger.warning(
            f"[AI Generator Warning] Candidate generation failed across all 6 models. "
            f"Last error: {str(last_error)}. Pausing for 30s to allow API rate limit windows to reset..."
        )
        time.sleep(30)
        return {}


class SecondaryJudgeClient:
    """
    Model B (LLM-as-a-Judge Verifier):
    Uses Mistral API (mistral-small-latest) as an independent verifier
    to confirm factual grounding and prevent hallucinations.
    """

    def __init__(self):
        self.api_key = os.environ.get("MISTRAL_API_KEY")
        self.model = "mistral-small-latest"
        self.client = Mistral(api_key=self.api_key) if self.api_key else None

    def verify_grounding(self, raw_context: str, generated_candidates: dict) -> dict:
        """
        Evaluates Model A's candidates against original source text.
        Returns dict: {"is_grounded": bool, "confidence": float, "reasoning": str}
        """
        if not self.client:
            logger.warning("[AI Judge] MISTRAL_API_KEY missing. Returning unverified state.")
            return {"is_grounded": False, "confidence": 0.0, "reasoning": "Missing Mistral API key"}

        prompt = f"""
                    Original Advisory Context:
                    {raw_context}

                    AI-Generated Candidates to Verify:
                    {json.dumps(generated_candidates)}

                    Verification Rules:
                    1. Grounding Criteria: Evaluate if the candidates are logically derived from or supported by the advisory context (including reference URLs, package names, GitHub repository paths, CVE IDs, or vendor metadata).
                    2. Allowable Inferences: If the candidate description synthesizes a summary from reference URLs, repository names, or version paths, mark it as grounded (`is_grounded: true`). Do NOT reject it simply because the raw text lacked a formal description paragraph.
                    3. Rejection Criteria: Mark `is_grounded: false` ONLY if the candidate introduces facts that directly contradict the context (e.g., claiming a Java flaw when all URLs point to a Rust crate) or includes completely fabricated CVE details.

                    Return ONLY a JSON object formatted as follows:
                    {{
                        "is_grounded": <boolean - true if supported or logically inferred from context/URLs, false otherwise>,
                        "confidence": <float - between 0.0 and 1.0>,
                        "reasoning": "<short string justification of pass or failure>"
                    }}
                    """
        try:
            response = self.client.chat.complete(
                model=self.model,
                messages=[{"role": "user", "content": prompt}],
                response_format={"type": "json_object"},
            )
            raw_content = response.choices[0].message.content
            return json.loads(raw_content) if raw_content else {"is_grounded": False, "confidence": 0.0, "reasoning": "Empty judge response"}

        except Exception as e:
            logger.error(f"[AI Judge Error] Mistral API execution failed: {str(e)}")
            return {"is_grounded": False, "confidence": 0.0, "reasoning": str(e)}


# class FallbackJudgeClient:
#     """
#     Fallback Verifier:
#     Rotates to OpenRouter Free API (google/gemma-2-9b-it:free or qwen-2.5-72b:free)
#     if Mistral API encounters temporary rate limits or maintenance windows.
#     """

#     def __init__(self):
#         self.api_key = os.environ.get("OPENROUTER_API_KEY")
#         self.model = "google/gemma-2-9b-it:free"
#         self.url = "https://openrouter.ai/api/v1/chat/completions"

#     def verify_grounding(self, raw_context: str, generated_candidates: dict) -> dict:
#         if not self.api_key:
#             return {"is_grounded": False, "confidence": 0.0, "reasoning": "OPENROUTER_API_KEY missing"}

#         prompt = f"""
#         Original Context: {raw_context}
#         Candidates: {json.dumps(generated_candidates)}
        
#         Are candidates factually grounded in text without hallucinations? 
#         Return strictly JSON: {{"is_grounded": bool, "confidence": float, "reasoning": str}}
#         """

#         headers = {
#             "Authorization": f"Bearer {self.api_key}",
#             "Content-Type": "application/json"
#         }
#         payload = {
#             "model": self.model,
#             "messages": [{"role": "user", "content": prompt}],
#             "response_format": {"type": "json_object"}
#         }

#         try:
#             res = requests.post(self.url, headers=headers, json=payload, timeout=10)
#             res.raise_for_status()
#             content = res.json()["choices"][0]["message"]["content"]
#             return json.loads(content)
#         except Exception as e:
#             logger.error(f"[AI Fallback Judge Error] OpenRouter API call failed: {str(e)}")
#             return {"is_grounded": False, "confidence": 0.0, "reasoning": str(e)}