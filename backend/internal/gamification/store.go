// Package gamification implements the engagement layer: a points ledger, daily
// streaks, a reward catalog with unlock tracking, and a shareable story payload.
package gamification

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// pointsForAction is the flat, simple point schedule from the product spec.
var pointsForAction = map[string]int{
	"log_pantry":  10,
	"cook_meal":   15,
	"hit_goal":    20,
	"avoid_waste": 25,
	"share":       10,
	"refer":       50,
}

// Reward is a catalog entry.
type Reward struct {
	ID           string `json:"id"`
	Title        string `json:"title"`
	Description  string `json:"description"`
	PointsNeeded int    `json:"points_needed"`
	SortOrder    int    `json:"sort_order"`
	Unlocked     bool   `json:"unlocked"`
}

// Streak holds a user's streak state.
type Streak struct {
	Current  int        `json:"current_streak"`
	Longest  int        `json:"longest_streak"`
	LastDate *time.Time `json:"last_active,omitempty"`
}

type Store struct{ pool *pgxpool.Pool }

func NewStore(pool *pgxpool.Pool) *Store { return &Store{pool: pool} }

// Award records points for an action and bumps the streak. Returns points added.
func (s *Store) Award(ctx context.Context, userID, action string) (int, error) {
	pts, ok := pointsForAction[action]
	if !ok {
		pts = 5 // unknown action still earns a little
	}
	_, err := s.pool.Exec(ctx, `
		INSERT INTO gamification.points_ledger (id, user_id, action, points)
		VALUES ($1,$2,$3,$4)`, uuid.NewString(), userID, action, pts)
	if err != nil {
		return 0, err
	}
	if err := s.touchStreak(ctx, userID); err != nil {
		return 0, err
	}
	return pts, nil
}

// touchStreak advances the streak if today is a new active day. A same-day action
// is a no-op; a one-day gap continues the streak; a larger gap resets it to 1.
func (s *Store) touchStreak(ctx context.Context, userID string) error {
	var st Streak
	err := s.pool.QueryRow(ctx,
		`SELECT current_streak, longest_streak, last_active
		 FROM gamification.streaks WHERE user_id=$1`, userID).
		Scan(&st.Current, &st.Longest, &st.LastDate)
	if err == pgx.ErrNoRows {
		_, err = s.pool.Exec(ctx,
			`INSERT INTO gamification.streaks (user_id, current_streak, longest_streak, last_active)
			 VALUES ($1, 1, 1, current_date)`, userID)
		return err
	}
	if err != nil {
		return err
	}

	today := truncDay(time.Now())
	if st.LastDate != nil {
		last := truncDay(*st.LastDate)
		switch daysBetween(last, today) {
		case 0:
			return nil // already counted today
		case 1:
			st.Current++
		default:
			st.Current = 1
		}
	} else {
		st.Current = 1
	}
	if st.Current > st.Longest {
		st.Longest = st.Current
	}
	_, err = s.pool.Exec(ctx,
		`UPDATE gamification.streaks
		 SET current_streak=$1, longest_streak=$2, last_active=current_date
		 WHERE user_id=$3`, st.Current, st.Longest, userID)
	return err
}

// TotalPoints returns the user's lifetime point total.
func (s *Store) TotalPoints(ctx context.Context, userID string) (int, error) {
	var total int
	err := s.pool.QueryRow(ctx,
		`SELECT COALESCE(SUM(points),0) FROM gamification.points_ledger WHERE user_id=$1`,
		userID).Scan(&total)
	return total, err
}

// GetStreak returns the user's current streak state.
func (s *Store) GetStreak(ctx context.Context, userID string) (Streak, error) {
	var st Streak
	err := s.pool.QueryRow(ctx,
		`SELECT current_streak, longest_streak, last_active
		 FROM gamification.streaks WHERE user_id=$1`, userID).
		Scan(&st.Current, &st.Longest, &st.LastDate)
	if err == pgx.ErrNoRows {
		return Streak{}, nil
	}
	return st, err
}

// Rewards returns the catalog annotated with whether each is unlocked at the
// user's current point total, and records newly-unlocked rewards.
func (s *Store) Rewards(ctx context.Context, userID string) ([]Reward, error) {
	total, err := s.TotalPoints(ctx, userID)
	if err != nil {
		return nil, err
	}
	rows, err := s.pool.Query(ctx,
		`SELECT id, title, description, points_needed, sort_order
		 FROM gamification.rewards ORDER BY sort_order`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	rewards := make([]Reward, 0)
	for rows.Next() {
		var rw Reward
		if err := rows.Scan(&rw.ID, &rw.Title, &rw.Description, &rw.PointsNeeded, &rw.SortOrder); err != nil {
			return nil, err
		}
		rw.Unlocked = total >= rw.PointsNeeded
		if rw.Unlocked {
			_, _ = s.pool.Exec(ctx,
				`INSERT INTO gamification.user_rewards (user_id, reward_id)
				 VALUES ($1,$2) ON CONFLICT DO NOTHING`, userID, rw.ID)
		}
		rewards = append(rewards, rw)
	}
	return rewards, rows.Err()
}

// WeeklyCookCount counts cook_meal actions in the trailing 7 days (for the story).
func (s *Store) WeeklyCookCount(ctx context.Context, userID string) (int, error) {
	var n int
	err := s.pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM gamification.points_ledger
		 WHERE user_id=$1 AND action='cook_meal' AND created_at >= now() - interval '7 days'`,
		userID).Scan(&n)
	return n, err
}

func truncDay(t time.Time) time.Time {
	return time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, t.Location())
}

func daysBetween(a, b time.Time) int {
	return int(b.Sub(a).Hours() / 24)
}
