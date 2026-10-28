#!/usr/bin/env python3
"""AI Fitness Coach chatbot (role-driven).

Usage:
  - Run locally without Gemini: `python scripts/ai_coach/coach.py --demo`
  - If you set `GEMINI_API_KEY`, the script will attempt to call Google's Gemini API.

This file implements the coaching rules described by the user and provides a
simple rule-based fallback so the coach works offline.
"""
import os
import argparse
import re
from pathlib import Path
from typing import Dict, Optional

try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).parent / ".env")
except Exception:
    # dotenv is optional; env vars may already be set in the environment
    pass

try:
    from langdetect import detect
except Exception:
    detect = None

PROMPT_TEMPLATE_PATH = os.path.join(os.path.dirname(__file__), "prompt_template.txt")


class AICoach:
    def __init__(self, coach_name: str = "Coach", app_name: str = "App", focus_area: str = "fitness"):
        self.coach_name = coach_name
        self.app_name = app_name
        self.focus_area = focus_area
        self.gemini = None
        try:
            from google import genai
            self.gemini = genai
        except Exception:
            self.gemini = None

    def build_system_prompt(self, context: Dict[str, str]) -> str:
        # Load template and substitute placeholders that exist in context
        try:
            with open(PROMPT_TEMPLATE_PATH, "r", encoding="utf8") as f:
                tpl = f.read()
        except Exception:
            tpl = "You are {coach_name}, the personal coach inside {app_name}. You help people with {focus_area}."
        # Basic placeholder mapping
        mapping = {**context}
        mapping.setdefault("coach_name", self.coach_name)
        mapping.setdefault("app_name", self.app_name)
        mapping.setdefault("focus_area", self.focus_area)
        mapping.setdefault("today", "")
        mapping.setdefault("user_name", "")
        mapping.setdefault("user_goals", "")
        mapping.setdefault("recent_activity", "")
        mapping.setdefault("past_notes", "")
        mapping.setdefault("language", context.get("language", ""))
        return tpl.format(**mapping)

    def call_llm(self, system_prompt: str, user_message: str) -> Optional[str]:
        gemini_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
        if gemini_key and self.gemini:
            return self.call_gemini(system_prompt, user_message, gemini_key)
        return None

    def call_gemini(self, system_prompt: str, user_message: str, api_key: str) -> Optional[str]:
        if not self.gemini:
            return None
        try:
            client = self.gemini.Client(api_key=api_key)
            model_names = []

            try:
                available = client.models.list()
                for model in available:
                    name = getattr(model, "name", None) or str(model)
                    normalized = name.split("/")[-1] if "/" in name else name
                    if "gemini" in normalized.lower():
                        model_names.append(normalized)
            except Exception:
                pass

            fallback_names = [
                "gemini-2.5-flash-lite",
                "gemini-2.5-flash",
                "gemini-1.5-flash",
                "gemini-1.5-pro",
                "gemini-2.0-flash",
                "gemini-3.8-flash",
            ]

            for model_name in list(dict.fromkeys(model_names + fallback_names)):
                try:
                    response = client.models.generate_content(
                        model=model_name,
                        contents=user_message,
                        config={"system_instruction": system_prompt},
                    )
                    text = getattr(response, "text", None)
                    if text:
                        return text.strip()

                    candidates = getattr(response, "candidates", None)
                    if candidates:
                        first = candidates[0]
                        if hasattr(first, "content") and hasattr(first.content, "parts"):
                            parts = []
                            for part in first.content.parts:
                                if hasattr(part, "text"):
                                    parts.append(part.text)
                            combined = "".join(parts).strip()
                            if combined:
                                return combined
                except Exception:
                    continue
            return None
        except Exception:
            return None

    def fallback_response(self, system_prompt: str, user_message: str) -> str:
        # Simple heuristic-driven coach response following the specified role rules.
        # 1) Reflect in one short sentence
        user_message = user_message.strip()
        lower = user_message.lower()

        # Quick subscription/plan FAQ handling
        subs_terms = ("subscription", "plan", "pricing", "price", "upgrade", "membership", "subscribe")
        if any(k in lower for k in subs_terms):
            # Provide a concise, customizable subscription summary
            return (
                f"{self.app_name} subscription plans:\n"
                "- Free: basic tips, community features, and the offline coach fallback.\n"
                "- Pro: personalized training plans, meal planners, richer analytics, and priority support.\n"
                "To manage your subscription open the app > Account > Subscription or visit the pricing page. "
                "Contact support if you need billing help."
            )
        if not user_message:
            reflection = "Tell me what's on your mind about your training or routine."
            return reflection

        # Create a one-sentence reflection: echo the core phrase (first 12 words)
        words = user_message.split()
        core = " ".join(words[:12])
        reflection = f"I hear you — {core}{('...' if len(words) > 12 else '')}."

        # Choose one open question to follow
        question = "What's one tiny step you could try in the next 24 hours?"

        # Keep it short (2-4 sentences) and warm
        reply = f"{reflection} {question}"
        # If the system prompt included a language hint, preserve it in the fallback
        m = re.search(r"language: (\w+)", system_prompt)
        if m:
            lang = m.group(1)
            if lang and lang != "en":
                reply = f"{reply} (please answer in {lang})"
        return reply

    def detect_language(self, text: str) -> str:
        if not text:
            return "en"
        # If contains Arabic/Urdu script, assume Urdu
        if re.search(r"[\u0600-\u06FF]", text):
            return "ur"
        # Try langdetect if available
        if detect:
            try:
                lang = detect(text)
                if lang == "ur":
                    return "ur"
                if lang.startswith("en"):
                    # still check for roman-urdu tokens
                    pass
            except Exception:
                pass
        # Simple Roman Urdu token check
        roman_tokens = {"hai", "nahi", "kya", "kuch", "kal", "ab", "acha", "sahi", "nazar", "kar"}
        words = set(w.lower().strip(".,!?") for w in text.split())
        if words & roman_tokens:
            return "roman-ur"
        return "en"

    def respond(self, context: Dict[str, str], user_message: str) -> str:
        # detect language and put into context so system prompt can use it
        lang = self.detect_language(user_message or context.get("recent_activity", ""))
        context = dict(context)
        context["language"] = lang
        system_prompt = self.build_system_prompt(context)
        llm_reply = self.call_llm(system_prompt, user_message)
        if llm_reply:
            return llm_reply
        return self.fallback_response(system_prompt, user_message)


def demo():
    coach = AICoach(coach_name="Aman Coach", app_name="Athleo", focus_area="fitness and habit building")
    context = {
        "today": "2026-10-06",
        "user_name": "Rohit",
        "user_goals": "Build consistent morning workouts and improve stamina",
        "recent_activity": "Two short runs and one skipped strength session",
        "past_notes": "Prefers 20–30 minute sessions and dislikes long warmups",
    }
    print("Coach system prompt:\n")
    print(coach.build_system_prompt(context))
    print("\n---- Demo conversation ----\n")
    samples = [
        "I keep skipping my strength workouts, I feel tired after work.",
        "I managed two runs this week but didn't improve my pace.",
        "I don't know how to fit a 30 minute workout into mornings.",
    ]
    for msg in samples:
        print(f"You: {msg}")
        resp = coach.respond(context, msg)
        print(f"{coach.coach_name}: {resp}\n")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--demo", action="store_true", help="Run a short demo conversation")
    args = parser.parse_args()
    if args.demo:
        demo()
    else:
        # Interactive loop
        coach = AICoach(coach_name="Coach", app_name="App")
        print("Starting interactive coach. Type 'quit' to exit.")
        # Minimal context collection
        ctx = {}
        ctx["today"] = input("Date (YYYY-MM-DD) or leave blank: ").strip()
        ctx["user_name"] = input("User name (optional): ").strip()
        ctx["user_goals"] = input("User goals (optional): ").strip()
        print("\nYou can start messaging your coach now.\n")
        while True:
            try:
                msg = input("You: ").strip()
            except EOFError:
                break
            if not msg or msg.lower() in ("quit", "exit"):
                break
            print("Coach:")
            print(coach.respond(ctx, msg))


if __name__ == "__main__":
    main()
