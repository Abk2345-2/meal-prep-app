-- Redesigned rewards with tangible value for Indian users.
-- Points economy:
--   log_pantry:  5 pts/day  → ~35/week
--   cook_meal:  20 pts each → ~140/week (7 meals)
--   hit_goal:   30 pts/day  → ~210/week
--   avoid_waste: 50 pts     → occasional bonus
--   streak_7:   50 pts      → milestone
--   streak_30: 200 pts      → milestone
-- Realistic weekly earn: ~200-400 pts

DELETE FROM gamification.rewards;

INSERT INTO gamification.rewards (id, title, description, points_needed, sort_order) VALUES
  ('starter',      'Kitchen Starter',      'Unlock the Smart Pantry tips — seasonal buying guide for Indian vegetables & grains',                    50,   1),
  ('meal_planner', 'Weekly Meal Planner',  'Unlock the 7-day Indian meal plan templates (breakfast, lunch, dinner) — reduces waste by 40%',          150,  2),
  ('recipe_book',  'Regional Recipe Book', 'Unlock 50 regional Indian recipes curated by state (Bengali, Rajasthani, South Indian, Punjabi…)',        300,  3),
  ('diet_pro',     'Diet Pro Badge',       'Unlock detailed macro breakdown + personalised calorie targets based on your activity level',             500,  4),
  ('waste_hero',   'Zero Waste Hero',      'Unlock fermentation & pickle recipes to use up expiring pantry items — nothing goes to waste',            800,  5),
  ('champion',     'PantryPilot Champion', 'Unlock all premium features + get a personalised Indian meal plan emailed to you every Monday',          1200,  6)
ON CONFLICT (id) DO UPDATE
  SET title        = EXCLUDED.title,
      description  = EXCLUDED.description,
      points_needed = EXCLUDED.points_needed,
      sort_order   = EXCLUDED.sort_order;
