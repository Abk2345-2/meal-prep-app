package pantry

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Item is a stored pantry record.
type Item struct {
	ID             string     `json:"id"`
	UserID         string     `json:"user_id"`
	RawText        string     `json:"raw_text"`
	Name           string     `json:"name"`
	NormalizedName string     `json:"normalized_name"`
	Quantity       float64    `json:"quantity"`
	Unit           string     `json:"unit"`
	Category       string     `json:"category"`
	AddedAt        time.Time  `json:"added_at"`
	ExpiresAt      *time.Time `json:"expires_at,omitempty"`
}

// Store is the pantry persistence layer.
type Store struct {
	pool *pgxpool.Pool
}

func NewStore(pool *pgxpool.Pool) *Store { return &Store{pool: pool} }

// Create inserts a parsed item for a user and returns the stored row.
func (s *Store) Create(ctx context.Context, userID string, p ParsedItem) (Item, error) {
	id := uuid.NewString()
	var expires *time.Time
	if p.ExpiresAt != nil {
		if t, err := time.Parse(time.RFC3339, *p.ExpiresAt); err == nil {
			expires = &t
		}
	}
	_, err := s.pool.Exec(ctx, `
		INSERT INTO pantry.items
			(id, user_id, raw_text, name, normalized_name, quantity, unit, category, expires_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
		id, userID, p.RawText, p.Name, p.NormalizedName, p.Quantity, p.Unit, p.Category, expires)
	if err != nil {
		return Item{}, err
	}
	return s.Get(ctx, userID, id)
}

// Get fetches one item belonging to a user.
func (s *Store) Get(ctx context.Context, userID, id string) (Item, error) {
	var it Item
	err := s.pool.QueryRow(ctx, `
		SELECT id, user_id, raw_text, name, normalized_name, quantity, unit, category, added_at, expires_at
		FROM pantry.items WHERE id=$1 AND user_id=$2`, id, userID).
		Scan(&it.ID, &it.UserID, &it.RawText, &it.Name, &it.NormalizedName,
			&it.Quantity, &it.Unit, &it.Category, &it.AddedAt, &it.ExpiresAt)
	return it, err
}

// List returns a user's items. If expiringWithin > 0, only items expiring within
// that many days (and not already expired) are returned.
func (s *Store) List(ctx context.Context, userID string, expiringWithin int) ([]Item, error) {
	query := `
		SELECT id, user_id, raw_text, name, normalized_name, quantity, unit, category, added_at, expires_at
		FROM pantry.items WHERE user_id=$1`
	args := []any{userID}
	if expiringWithin > 0 {
		query += ` AND expires_at IS NOT NULL AND expires_at <= now() + ($2 || ' days')::interval
		           AND expires_at >= now()`
		args = append(args, expiringWithin)
	}
	query += ` ORDER BY expires_at NULLS LAST, added_at DESC`

	rows, err := s.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]Item, 0)
	for rows.Next() {
		var it Item
		if err := rows.Scan(&it.ID, &it.UserID, &it.RawText, &it.Name, &it.NormalizedName,
			&it.Quantity, &it.Unit, &it.Category, &it.AddedAt, &it.ExpiresAt); err != nil {
			return nil, err
		}
		items = append(items, it)
	}
	return items, rows.Err()
}

// UpdateQuantity changes the quantity/unit of an item.
func (s *Store) UpdateQuantity(ctx context.Context, userID, id string, qty float64, unit string) (Item, error) {
	_, err := s.pool.Exec(ctx,
		`UPDATE pantry.items SET quantity=$1, unit=$2 WHERE id=$3 AND user_id=$4`,
		qty, unit, id, userID)
	if err != nil {
		return Item{}, err
	}
	return s.Get(ctx, userID, id)
}

// Delete removes an item.
func (s *Store) Delete(ctx context.Context, userID, id string) error {
	_, err := s.pool.Exec(ctx, `DELETE FROM pantry.items WHERE id=$1 AND user_id=$2`, id, userID)
	return err
}
