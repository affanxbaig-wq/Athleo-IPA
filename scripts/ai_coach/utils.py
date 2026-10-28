"""Utility helpers for the AI coach package.

Contains small helpers, validation functions, and simple NLP utilities used
by the coach modules. Kept intentionally lightweight and dependency-free for
offline usage.
"""
from typing import Any, Dict, List, Optional, Tuple
import re
import math


def clamp(v: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, v))


def parse_int(s: str, default: int = 0) -> int:
    try:
        return int(float(s))
    except Exception:
        return default


def safe_get(d: Dict[str, Any], *keys: str, default=None):
    cur = d
    for k in keys:
        if not isinstance(cur, dict):
            return default
        cur = cur.get(k, default)
        if cur is default:
            return default
    return cur


def words(text: str) -> List[str]:
    return re.findall(r"[\w'-]+", text.lower())


def contains_any(text: str, tokens: List[str]) -> bool:
    tks = set(words(text))
    for tk in tokens:
        if tk.lower() in tks:
            return True
    return False


def pretty_list(items: List[str], max_items: int = 6) -> str:
    if not items:
        return ""
    if len(items) <= max_items:
        return ", ".join(items)
    return ", ".join(items[:max_items]) + ", and more"


def estimate_calories_for_activity(minutes: float, met: float, weight_kg: float) -> float:
    # MET-based calories burned estimate: kcal = MET * weight_kg * hours
    hours = minutes / 60.0
    return met * weight_kg * hours


def bmi_from_height_weight(height_cm: float, weight_kg: float) -> Optional[float]:
    try:
        h = height_cm / 100.0
        if h <= 0:
            return None
        return weight_kg / (h * h)
    except Exception:
        return None


def categorize_bmi(bmi: Optional[float]) -> str:
    if bmi is None:
        return "unknown"
    if bmi < 18.5:
        return "underweight"
    if bmi < 25.0:
        return "healthy"
    if bmi < 30.0:
        return "overweight"
    return "obese"


def round_one(x: float) -> float:
    return round(x, 1)


def yes_no(text: str) -> Optional[bool]:
    t = text.strip().lower()
    if not t:
        return None
    yes = {"yes", "y", "haan", "han", "ha", "sure", "ok", "okay"}
    no = {"no", "n", "nah", "nahi", "na"}
    if t in yes:
        return True
    if t in no:
        return False
    return None
