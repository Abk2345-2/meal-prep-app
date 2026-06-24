#!/usr/bin/env python3
"""
Convert recipes.json -> supabase/seed_recipes.sql
Run: python3 supabase/seed_recipes.py
Then load via: psql <connection-url> -f supabase/seed_recipes.sql
"""
import json
import os

SRC = os.path.join(os.path.dirname(__file__),
                   "../backend/internal/recipeprovider/recipes.json")
DST = os.path.join(os.path.dirname(__file__), "seed_recipes.sql")

def esc(s):
    """Escape a string value for SQL."""
    if s is None:
        return "NULL"
    return "'" + str(s).replace("'", "''") + "'"

with open(SRC) as f:
    recipes = json.load(f)

CHUNK = 500  # rows per INSERT statement

with open(DST, "w") as out:
    out.write("-- Auto-generated recipe seed data\n")
    out.write("-- DO NOT EDIT — regenerate with seed_recipes.py\n\n")

    # --- recipe.recipes ---
    out.write("-- recipe.recipes (" + str(len(recipes)) + " rows)\n")
    for i in range(0, len(recipes), CHUNK):
        chunk = recipes[i:i + CHUNK]
        out.write("INSERT INTO recipe.recipes "
                  "(id, title, category, area, instructions, image, "
                  "source_url, youtube_url, time_minutes, "
                  "calories, protein_g, carbs_g, fat_g) VALUES\n")
        rows = []
        for r in chunk:
            rows.append(
                f"  ({esc(r.get('id'))}, {esc(r.get('title'))}, "
                f"{esc(r.get('category',''))}, {esc(r.get('area',''))}, "
                f"{esc(r.get('instructions',''))}, {esc(r.get('image',''))}, "
                f"{esc(r.get('source_url',''))}, {esc(r.get('youtube_url',''))}, "
                f"{int(r.get('time_minutes') or 0)}, "
                f"{int(r.get('calories') or 0)}, "
                f"{int(r.get('protein_g') or 0)}, "
                f"{int(r.get('carbs_g') or 0)}, "
                f"{int(r.get('fat_g') or 0)})"
            )
        out.write(",\n".join(rows))
        out.write("\nON CONFLICT (id) DO NOTHING;\n\n")

    # --- recipe.ingredients ---
    all_ingredients = []
    for r in recipes:
        rid = r.get("id")
        for ing in (r.get("ingredients") or []):
            all_ingredients.append((rid, ing.get("name", ""), ing.get("measure", "")))

    out.write("-- recipe.ingredients (" + str(len(all_ingredients)) + " rows)\n")
    for i in range(0, len(all_ingredients), CHUNK):
        chunk = all_ingredients[i:i + CHUNK]
        out.write("INSERT INTO recipe.ingredients (recipe_id, name, measure) VALUES\n")
        rows = [
            f"  ({esc(rid)}, {esc(name)}, {esc(measure)})"
            for rid, name, measure in chunk
        ]
        out.write(",\n".join(rows))
        out.write(";\n\n")

print(f"Written {DST}")
print(f"  {len(recipes)} recipes")
print(f"  {len(all_ingredients)} ingredients")
