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

// Create upserts a pantry item. If an item with the same normalized_name
// already exists for the user, its quantity is increased (units are unified
// to grams when both sides are weight units; otherwise the incoming unit wins).
func (s *Store) Create(ctx context.Context, userID string, p ParsedItem) (Item, error) {
	var expires *time.Time
	if p.ExpiresAt != nil {
		if t, err := time.Parse(time.RFC3339, *p.ExpiresAt); err == nil {
			expires = &t
		}
	}

	// Check for an existing entry with the same normalized name.
	var existingID string
	var existingQty float64
	var existingUnit string
	err := s.pool.QueryRow(ctx,
		`SELECT id, quantity, unit FROM pantry.items
		 WHERE user_id=$1 AND normalized_name=$2
		 LIMIT 1`,
		userID, p.NormalizedName,
	).Scan(&existingID, &existingQty, &existingUnit)

	if err == nil {
		// Merge: add quantities. If units differ, keep existing unit and convert
		// only for the common weight pair g↔kg.
		newQty := existingQty + convertQty(p.Quantity, p.Unit, existingUnit)
		_, err = s.pool.Exec(ctx,
			`UPDATE pantry.items
			 SET quantity=$1, raw_text=$2, added_at=now()
			 WHERE id=$3`,
			newQty, p.RawText, existingID)
		if err != nil {
			return Item{}, err
		}
		return s.Get(ctx, userID, existingID)
	}

	// No existing entry — insert fresh.
	id := uuid.NewString()
	_, err = s.pool.Exec(ctx, `
		INSERT INTO pantry.items
			(id, user_id, raw_text, name, normalized_name, quantity, unit, category, expires_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
		id, userID, p.RawText, p.Name, p.NormalizedName, p.Quantity, p.Unit, p.Category, expires)
	if err != nil {
		return Item{}, err
	}
	return s.Get(ctx, userID, id)
}

// convertQty converts qty in fromUnit to toUnit for the g↔kg pair.
// All other unit combinations are returned as-is (caller uses fromUnit qty).
func convertQty(qty float64, fromUnit, toUnit string) float64 {
	if fromUnit == toUnit {
		return qty
	}
	if fromUnit == "kg" && toUnit == "g" {
		return qty * 1000
	}
	if fromUnit == "g" && toUnit == "kg" {
		return qty / 1000
	}
	// Incompatible units — just add the number (e.g. "1 unit + 1 unit").
	return qty
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

// Recategorize re-runs categoryFor on every item the user owns and persists
// the new category. Returns the number of rows actually changed.
func (s *Store) Recategorize(ctx context.Context, userID string) (int, error) {
	rows, err := s.pool.Query(ctx,
		`SELECT id, normalized_name FROM pantry.items WHERE user_id=$1`, userID)
	if err != nil {
		return 0, err
	}
	defer rows.Close()

	type row struct {
		id   string
		name string
	}
	var items []row
	for rows.Next() {
		var r row
		if err := rows.Scan(&r.id, &r.name); err != nil {
			return 0, err
		}
		items = append(items, r)
	}
	if err := rows.Err(); err != nil {
		return 0, err
	}

	updated := 0
	for _, it := range items {
		newCat := categoryFor(it.name)
		tag, err := s.pool.Exec(ctx,
			`UPDATE pantry.items SET category=$1 WHERE id=$2 AND category != $1`,
			newCat, it.id)
		if err != nil {
			return updated, err
		}
		updated += int(tag.RowsAffected())
	}
	return updated, nil
}

// Delete removes an item.
func (s *Store) Delete(ctx context.Context, userID, id string) error {
	_, err := s.pool.Exec(ctx, `DELETE FROM pantry.items WHERE id=$1 AND user_id=$2`, id, userID)
	return err
}
