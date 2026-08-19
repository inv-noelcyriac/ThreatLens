# ingestion/services/ai_verifier.py

import logging
from .ai_provider import SecondaryJudgeClient

logger = logging.getLogger("ingestion_logger")


class AIEnrichmentVerifier:
    """
    Dual-Stage Verification Engine for AI-generated vulnerability data.
    Runs basic structural and sanity checks (Stage 1) before delegating
    all factual and grounding checks to Model B (Mistral LLM-as-a-Judge).
    """

    def __init__(self):
        self.judge_client = SecondaryJudgeClient()

    def run_deterministic_checks(self, candidates: dict) -> tuple[bool, str]:
        """
        Stage 1: Pure structural & sanity validation.
        """
        if not candidates or not isinstance(candidates, dict):
            return False, "Candidate payload is empty or invalid JSON structure."

        for field, value in candidates.items():
            if not isinstance(value, str) or not value.strip():
                return False, f"Field '{field}' is empty or not a valid string."

            val_str = value.strip()

            # Sanity check for description
            if field == "description":
                if len(val_str) < 20 or len(val_str) > 2000:
                    return False, f"Description length ({len(val_str)}) outside allowed bounds (20-2000 chars)."

            # Sanity check for tech_name
            elif field == "tech_name":
                if len(val_str) > 100 or val_str.lower() in {"unknown", "n/a", "none", "null"}:
                    return False, f"Invalid or generic tech_name string: '{val_str}'."

            # Structural sanity check for ecosystem
            elif field == "ecosystem":
                # Convert spaces to hyphens and normalize to lowercase slug format
                eco_slug = val_str.lower().strip().replace(" ", "-")
                cleaned_eco = eco_slug.replace("-", "").replace("_", "").replace("/", "").replace("+", "").replace("#", "").replace(".", "")
                if len(eco_slug) > 50 or not cleaned_eco.isalnum():
                    return False, f"Ecosystem string '{val_str}' is structurally invalid."
                # Store normalized slug back into candidates dictionary
                candidates["ecosystem"] = eco_slug

        return True, "Structural sanity checks passed."

    def verify(self, raw_context: str, candidates: dict) -> tuple[bool, dict]:
        """
        Runs full verification flow: Stage 1 (Structural) -> Stage 2 (LLM Judge).
        """
        # Stage 1: Structural & Sanity Check
        passed_stage1, reason = self.run_deterministic_checks(candidates)
        if not passed_stage1:
            logger.warning(f"[AI Verifier Stage 1 Failed] {reason}")
            return False, {"reasoning": reason, "stage": 1}

        # Stage 2: All factual verification handed off to Mistral LLM-as-a-Judge
        judge_res = self.judge_client.verify_grounding(raw_context, candidates)
        is_grounded = judge_res.get("is_grounded", False)
        confidence = judge_res.get("confidence", 0.0)

        if is_grounded and confidence >= 0.7:
            return True, judge_res

        logger.warning(f"[AI Verifier Stage 2 Failed] Reasoning: {judge_res.get('reasoning')}")
        return False, judge_res