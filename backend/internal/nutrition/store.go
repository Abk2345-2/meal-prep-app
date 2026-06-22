// Package nutrition tracks the user's daily calorie/macro goal and logged meals.
package nutrition

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Goal is a user's daily nutrition target.
type Goal struct {
	UserID        string `json:"user_id"`
	DailyCalories int    `json:"daily_calories"`
	ProteinG      int    `json:"protein_g"`
	CarbsG        int    `json:"carbs_g"`
	FatG          int    `json:"fat_g"`
}

// MealLog is a single logged meal.
type MealLog struct {
	ID       string    `json:"id"`
	UserID   string    `json:"user_id"`
	Source   string    `json:"source"`
	Calories int       `json:"calories"`
	ProteinG int       `json:"protein_g"`
	CarbsG   int       `json:"carbs_g"`
	FatG     int       `json:"fat_g"`
	CookedAt time.Time `json:"cooked_at"`
}

type Store struct{ pool *pgxpool.Pool }

func NewStore(pool *pgxpool.Pool) *Store { return &Store{pool: pool} }

// GetGoal returns the user's goal, creating a default if none exists.
func (s *Store) GetGoal(ctx context.Context, userID string) (Goal, error) {
	var g Goal
	err := s.pool.QueryRow(ctx, `
		SELECT user_id, daily_calories, protein_g, carbs_g, fat_g
		FROM nutrition.goals WHERE user_id=$1`, userID).
		Scan(&g.UserID, &g.DailyCalories, &g.ProteinG, &g.CarbsG, &g.FatG)
	if err == pgx.ErrNoRows {
		g = Goal{UserID: userID, DailyCalories: 2000, ProteinG: 100, CarbsG: 250, FatG: 65}
		_, err = s.pool.Exec(ctx, `
			INSERT INTO nutrition.goals (user_id, daily_calories, protein_g, carbs_g, fat_g)
			VALUES ($1,$2,$3,$4,$5) ON CONFLICT (user_id) DO NOTHING`,
			g.UserID, g.DailyCalories, g.ProteinG, g.CarbsG, g.FatG)
		return g, err
	}
	return g, err
}

// SetGoal upserts the user's goal.
func (s *Store) SetGoal(ctx context.Context, g Goal) (Goal, error) {
	_, err := s.pool.Exec(ctx, `
		INSERT INTO nutrition.goals (user_id, daily_calories, protein_g, carbs_g, fat_g, updated_at)
		VALUES ($1,$2,$3,$4,$5, now())
		ON CONFLICT (user_id) DO UPDATE SET
			daily_calories=EXCLUDED.daily_calories, protein_g=EXCLUDED.protein_g,
			carbs_g=EXCLUDED.carbs_g, fat_g=EXCLUDED.fat_g, updated_at=now()`,
		g.UserID, g.DailyCalories, g.ProteinG, g.CarbsG, g.FatG)
	if err != nil {
		return Goal{}, err
	}
	return s.GetGoal(ctx, g.UserID)
}

// Log records a meal.
func (s *Store) Log(ctx context.Context, m MealLog) (MealLog, error) {
	m.ID = uuid.NewString()
	err := s.pool.QueryRow(ctx, `
		INSERT INTO nutrition.meal_logs (id, user_id, source, calories, protein_g, carbs_g, fat_g)
		VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING cooked_at`,
		m.ID, m.UserID, m.Source, m.Calories, m.ProteinG, m.CarbsG, m.FatG).
		Scan(&m.CookedAt)
	return m, err
}

// Totals sums macros logged on a given calendar day (server local time).
type Totals struct {
	Calories int `json:"calories"`
	ProteinG int `json:"protein_g"`
	CarbsG   int `json:"carbs_g"`
	FatG     int `json:"fat_g"`
	Meals    int `json:"meals"`
}

// TodayTotals returns the sum of meals logged since local midnight.
func (s *Store) TodayTotals(ctx context.Context, userID string) (Totals, []MealLog, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT id, user_id, source, calories, protein_g, carbs_g, fat_g, cooked_at
		FROM nutrition.meal_logs
		WHERE user_id=$1 AND cooked_at >= date_trunc('day', now())
		ORDER BY cooked_at DESC`, userID)
	if err != nil {
		return Totals{}, nil, err
	}
	defer rows.Close()

	var t Totals
	logs := make([]MealLog, 0)
	for rows.Next() {
		var m MealLog
		if err := rows.Scan(&m.ID, &m.UserID, &m.Source, &m.Calories,
			&m.ProteinG, &m.CarbsG, &m.FatG, &m.CookedAt); err != nil {
			return Totals{}, nil, err
		}
		t.Calories += m.Calories
		t.ProteinG += m.ProteinG
		t.CarbsG += m.CarbsG
		t.FatG += m.FatG
		t.Meals++
		logs = append(logs, m)
	}
	return t, logs, rows.Err()
}
