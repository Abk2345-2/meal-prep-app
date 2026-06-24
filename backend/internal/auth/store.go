// Package auth handles Google OAuth login and JWT issuance.
package auth

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

// User is the db row returned after upsert.
type User struct {
	ID          string
	DisplayName string
	Email       string
	AvatarURL   string
}

// Store wraps database operations for auth.
type Store struct {
	pool *pgxpool.Pool
}

// NewStore creates an auth Store.
func NewStore(pool *pgxpool.Pool) *Store {
	return &Store{pool: pool}
}

// UpsertGoogleUser creates a new user on first login or updates display info on
// subsequent logins.  Returns the resolved user row.
func (s *Store) UpsertGoogleUser(ctx context.Context, googleSub, email, displayName, avatarURL string) (User, error) {
	const q = `
		INSERT INTO core.users (id, display_name, email, google_sub, avatar_url, provider)
		VALUES ($1, $2, $3, $4, $5, 'google')
		ON CONFLICT (google_sub) DO UPDATE
			SET display_name = EXCLUDED.display_name,
			    email        = EXCLUDED.email,
			    avatar_url   = EXCLUDED.avatar_url
		RETURNING id, display_name, email, COALESCE(avatar_url, '')`

	id := uuid.New().String()
	var u User
	err := s.pool.QueryRow(ctx, q, id, displayName, email, googleSub, avatarURL).
		Scan(&u.ID, &u.DisplayName, &u.Email, &u.AvatarURL)
	if err != nil {
		return User{}, fmt.Errorf("upsert google user: %w", err)
	}
	return u, nil
}
