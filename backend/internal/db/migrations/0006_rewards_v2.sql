-- Update reward point thresholds to reflect the new points schedule.
-- ~20 pts/cook + 5 pts/day pantry + 30 pts hitting goal
-- Week 1: ~200 pts possible realistically
UPDATE gamification.rewards SET points_needed = 50  WHERE id = 'beginner';
UPDATE gamification.rewards SET points_needed = 150 WHERE id = 'momentum';
UPDATE gamification.rewards SET points_needed = 300 WHERE id = 'consistent';
UPDATE gamification.rewards SET points_needed = 600 WHERE id = 'resilient';
UPDATE gamification.rewards SET points_needed = 1000 WHERE id = 'champion';
