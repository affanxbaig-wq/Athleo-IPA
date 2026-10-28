"""Nutrition knowledge module for the AI coach.

This module contains a curated in-memory database of foods, macros, per-100g
calorie estimates, simple dietary restriction rules, condition-based
recommendations, and a small meal planner. The goal is to provide
deterministic, explainable recommendations offline without external API
calls. It's deliberately opinionated but conservative: when safety matters the
coach suggests consulting a qualified nutritionist.
"""
from typing import Dict, List, Tuple, Optional
from .utils import clamp, round_one


# Minimal food database. Each entry: (calories_per_100g, protein_g, carbs_g, fat_g)
FOOD_DB: Dict[str, Tuple[int, float, float, float]] = {
    "chicken_breast": (165, 31.0, 0.0, 3.6),
    "salmon": (208, 20.0, 0.0, 13.0),
    "egg_whole": (155, 13.0, 1.1, 11.0),
    "brown_rice": (111, 2.6, 23.0, 0.9),
    "quinoa": (120, 4.4, 21.3, 1.9),
    "broccoli": (34, 2.8, 6.6, 0.4),
    "spinach": (23, 2.9, 3.6, 0.4),
    "oats": (389, 16.9, 66.3, 6.9),
    "apple": (52, 0.3, 14.0, 0.2),
    "banana": (89, 1.1, 23.0, 0.3),
    "almonds": (579, 21.1, 21.6, 49.9),
    "greek_yogurt": (59, 10.0, 3.6, 0.4),
    "olive_oil": (884, 0.0, 0.0, 100.0),
    "sweet_potato": (86, 1.6, 20.1, 0.1),
}


DIETARY_TAGS: Dict[str, List[str]] = {
    "chicken_breast": ["meat", "poultry", "high_protein"],
    "salmon": ["fish", "omega3", "high_protein"],
    "egg_whole": ["animal", "high_protein"],
    "brown_rice": ["grain", "vegan"],
    "quinoa": ["grain", "vegan", "complete_protein"],
    "broccoli": ["vegan", "green"],
    "spinach": ["vegan", "green"],
    "oats": ["grain", "vegan", "slow_carbs"],
    "apple": ["fruit"],
    "banana": ["fruit", "fast_carbs"],
    "almonds": ["nuts", "high_fat", "vegan"],
    "greek_yogurt": ["dairy", "protein"],
    "olive_oil": ["fat", "vegan"],
    "sweet_potato": ["vegan", "complex_carbs"],
}


CONTRAINDICATIONS: Dict[str, List[str]] = {
    # condition -> tags to avoid (simplified guidance)
    "high_blood_pressure": ["high_sodium", "processed", "excess_caffeine"],
    "high_cholesterol": ["high_sat_fat", "processed_meat"],
    "diabetes": ["fast_carbs", "sugary_drinks", "high_glycemic"],
    "kidney_disease": ["high_protein", "high_potassium"],
}


def lookup_food(name: str):
    key = name.strip().lower().replace(" ", "_")
    return FOOD_DB.get(key)


def food_tags(name: str) -> List[str]:
    key = name.strip().lower().replace(" ", "_")
    return DIETARY_TAGS.get(key, [])


def kcal_for_food(name: str, grams: float) -> Optional[float]:
    entry = lookup_food(name)
    if not entry:
        return None
    cal100 = entry[0]
    return (cal100 / 100.0) * grams


def macros_for_food(name: str, grams: float):
    entry = lookup_food(name)
    if not entry:
        return None
    cals, protein, carbs, fat = entry
    factor = grams / 100.0
    return {
        "calories": round_one(cals * factor),
        "protein_g": round_one(protein * factor),
        "carbs_g": round_one(carbs * factor),
        "fat_g": round_one(fat * factor),
    }


def safe_foods_for_condition(condition: str) -> List[str]:
    # Very conservative: exclude foods with matching tags in CONTRAINDICATIONS
    bad = set(CONTRAINDICATIONS.get(condition, []))
    safe = []
    for food, tags in DIETARY_TAGS.items():
        if bad & set(tags):
            continue
        safe.append(food)
    return safe


def recommend_meal_for_goal(goal: str, calorie_target: int = 500) -> Dict[str, any]:
    # Simple greedy meal builder: prioritize protein and whole-food carbs
    goal = goal.lower()
    components = []
    remaining = calorie_target

    # protein-first
    for protein_food in ("chicken_breast", "salmon", "greek_yogurt", "quinoa", "egg_whole"):
        info = FOOD_DB.get(protein_food)
        if not info:
            continue
        cal100 = info[0]
        # take 150g chunks for animal protein (approx 30-40g protein)
        grams = 150 if protein_food in ("chicken_breast", "salmon") else 120
        kcal = (cal100 / 100.0) * grams
        if kcal <= remaining:
            components.append((protein_food, grams))
            remaining -= kcal

    # carbs
    for carb_food in ("brown_rice", "sweet_potato", "oats", "banana"):
        if remaining <= 100:
            break
        info = FOOD_DB.get(carb_food)
        if not info:
            continue
        grams = 100
        kcal = (info[0] / 100.0) * grams
        if kcal <= remaining:
            components.append((carb_food, grams))
            remaining -= kcal

    # veg / greens
    for veg in ("broccoli", "spinach"):
        components.append((veg, 80))

    total_cal = sum((FOOD_DB[f][0] / 100.0) * g for f, g in components)
    return {
        "goal": goal,
        "components": components,
        "calories": round_one(total_cal),
    }


def quick_advice_for_condition(condition: str) -> str:
    cond = condition.lower()
    if cond == "diabetes":
        return (
            "Focus on consistent carbs, prefer whole grains and vegetables, limit sugary drinks, "
            "and prioritize protein with meals. Discuss medication timing with your clinician."
        )
    if cond in ("high_blood_pressure", "hypertension"):
        return (
            "Reduce salt, avoid processed foods and excess sodium, increase vegetables and potassium-rich foods "
            "(unless your clinician advised against it). Maintain healthy weight and follow your doctor's guidance."
        )
    if cond == "high_cholesterol":
        return (
            "Limit saturated and trans fats, prefer fish, nuts, and olive oil, increase soluble fiber from oats, "
            "and speak with your clinician about lipid management."
        )
    return (
        "I can help craft a balanced meal plan: tell me your goal (lose weight, gain muscle, maintain), "
        "approx daily calories, and any foods you dislike or must avoid."
    )
