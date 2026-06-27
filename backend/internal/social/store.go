package social

import (
	"context"
	"encoding/json"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Ingredient struct {
	Name    string `json:"name"`
	Measure string `json:"measure"`
}

type Favorite struct {
	ID         string          `json:"id"`
	UserID     string          `json:"user_id"`
	RecipeID   string          `json:"recipe_id"`
	RecipeData json.RawMessage `json:"recipe_data"`
	CreatedAt  time.Time       `json:"created_at"`
}

type ShoppingItem struct {
	ID             string    `json:"id"`
	UserID         string    `json:"user_id"`
	IngredientName string    `json:"ingredient_name"`
	Quantity       string    `json:"quantity"`
	Checked        bool      `json:"checked"`
	FromRecipeID   *string   `json:"from_recipe_id,omitempty"`
	CreatedAt      time.Time `json:"created_at"`
}

type SavedReel struct {
	ID           string          `json:"id"`
	UserID       string          `json:"user_id"`
	SourceURL    string          `json:"source_url"`
	Platform     string          `json:"platform"`
	RawTitle     string          `json:"raw_title"`
	Title        string          `json:"title"`
	Image        string          `json:"image"`
	Ingredients  json.RawMessage `json:"ingredients"`
	Instructions string          `json:"instructions"`
	CreatedAt    time.Time       `json:"created_at"`
}

type SharedRecipe struct {
	ID         string          `json:"id"`
	UserID     string          `json:"user_id"`
	RecipeID   string          `json:"recipe_id"`
	RecipeData json.RawMessage `json:"recipe_data"`
	ShareToken string          `json:"share_token"`
	ExpiresAt  time.Time       `json:"expires_at"`
	CreatedAt  time.Time       `json:"created_at"`
}

type Store struct {
	pool *pgxpool.Pool
}

func NewStore(pool *pgxpool.Pool) *Store { return &Store{pool: pool} }

func (s *Store) AddFavorite(ctx context.Context, userID, recipeID string, recipeData json.RawMessage) (Favorite, error) {
	_, err := s.pool.Exec(ctx,
		`INSERT INTO social.favorites (id, user_id, recipe_id, recipe_data)
		 VALUES ($1, $2, $3, $4)
		 ON CONFLICT (user_id, recipe_id) DO NOTHING`,
		uuid.NewString(), userID, recipeID, []byte(recipeData),
	)
	if err != nil {
		return Favorite{}, err
	}
	var f Favorite
	err = s.pool.QueryRow(ctx,
		`SELECT id, user_id, recipe_id, recipe_data, created_at
		 FROM social.favorites WHERE user_id=$1 AND recipe_id=$2`,
		userID, recipeID,
	).Scan(&f.ID, &f.UserID, &f.RecipeID, &f.RecipeData, &f.CreatedAt)
	return f, err
}

func (s *Store) RemoveFavorite(ctx context.Context, userID, recipeID string) error {
	_, err := s.pool.Exec(ctx,
		`DELETE FROM social.favorites WHERE user_id=$1 AND recipe_id=$2`,
		userID, recipeID,
	)
	return err
}

func (s *Store) ListFavorites(ctx context.Context, userID string) ([]Favorite, error) {
	rows, err := s.pool.Query(ctx,
		`SELECT id, user_id, recipe_id, recipe_data, created_at
		 FROM social.favorites WHERE user_id=$1 ORDER BY created_at DESC`,
		userID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	favs := make([]Favorite, 0)
	for rows.Next() {
		var f Favorite
		if err := rows.Scan(&f.ID, &f.UserID, &f.RecipeID, &f.RecipeData, &f.CreatedAt); err != nil {
			return nil, err
		}
		favs = append(favs, f)
	}
	return favs, rows.Err()
}

func (s *Store) AddShoppingItems(ctx context.Context, userID string, items []ShoppingItem) ([]ShoppingItem, error) {
	out := make([]ShoppingItem, 0, len(items))
	for _, item := range items {
		id := uuid.NewString()
		var inserted ShoppingItem
		err := s.pool.QueryRow(ctx,
			`INSERT INTO social.shopping_list (id, user_id, ingredient_name, quantity, from_recipe_id)
			 VALUES ($1, $2, $3, $4, $5)
			 RETURNING id, user_id, ingredient_name, quantity, checked, from_recipe_id, created_at`,
			id, userID, item.IngredientName, item.Quantity, item.FromRecipeID,
		).Scan(&inserted.ID, &inserted.UserID, &inserted.IngredientName, &inserted.Quantity,
			&inserted.Checked, &inserted.FromRecipeID, &inserted.CreatedAt)
		if err != nil {
			return nil, err
		}
		out = append(out, inserted)
	}
	return out, nil
}

func (s *Store) ListShoppingItems(ctx context.Context, userID string) ([]ShoppingItem, error) {
	rows, err := s.pool.Query(ctx,
		`SELECT id, user_id, ingredient_name, quantity, checked, from_recipe_id, created_at
		 FROM social.shopping_list WHERE user_id=$1 ORDER BY created_at ASC`,
		userID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]ShoppingItem, 0)
	for rows.Next() {
		var it ShoppingItem
		if err := rows.Scan(&it.ID, &it.UserID, &it.IngredientName, &it.Quantity,
			&it.Checked, &it.FromRecipeID, &it.CreatedAt); err != nil {
			return nil, err
		}
		items = append(items, it)
	}
	return items, rows.Err()
}

func (s *Store) ToggleShoppingItem(ctx context.Context, userID, id string) error {
	_, err := s.pool.Exec(ctx,
		`UPDATE social.shopping_list SET checked = NOT checked WHERE id=$1 AND user_id=$2`,
		id, userID,
	)
	return err
}

func (s *Store) DeleteShoppingItem(ctx context.Context, userID, id string) error {
	_, err := s.pool.Exec(ctx,
		`DELETE FROM social.shopping_list WHERE id=$1 AND user_id=$2`,
		id, userID,
	)
	return err
}

func (s *Store) ClearCheckedItems(ctx context.Context, userID string) error {
	_, err := s.pool.Exec(ctx,
		`DELETE FROM social.shopping_list WHERE user_id=$1 AND checked=true`,
		userID,
	)
	return err
}

func (s *Store) SaveReel(ctx context.Context, userID string, reel SavedReel) (SavedReel, error) {
	id := uuid.NewString()
	var out SavedReel
	err := s.pool.QueryRow(ctx,
		`INSERT INTO social.saved_reels (id, user_id, source_url, platform, raw_title, title, image, ingredients, instructions)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		 RETURNING id, user_id, source_url, platform, raw_title, title, image, ingredients, instructions, created_at`,
		id, userID, reel.SourceURL, reel.Platform, reel.RawTitle, reel.Title,
		reel.Image, []byte(reel.Ingredients), reel.Instructions,
	).Scan(&out.ID, &out.UserID, &out.SourceURL, &out.Platform, &out.RawTitle, &out.Title,
		&out.Image, &out.Ingredients, &out.Instructions, &out.CreatedAt)
	return out, err
}

func (s *Store) ListReels(ctx context.Context, userID string) ([]SavedReel, error) {
	rows, err := s.pool.Query(ctx,
		`SELECT id, user_id, source_url, platform, raw_title, title, image, ingredients, instructions, created_at
		 FROM social.saved_reels WHERE user_id=$1 ORDER BY created_at DESC`,
		userID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	reels := make([]SavedReel, 0)
	for rows.Next() {
		var r SavedReel
		if err := rows.Scan(&r.ID, &r.UserID, &r.SourceURL, &r.Platform, &r.RawTitle, &r.Title,
			&r.Image, &r.Ingredients, &r.Instructions, &r.CreatedAt); err != nil {
			return nil, err
		}
		reels = append(reels, r)
	}
	return reels, rows.Err()
}

func (s *Store) DeleteReel(ctx context.Context, userID, id string) error {
	_, err := s.pool.Exec(ctx,
		`DELETE FROM social.saved_reels WHERE id=$1 AND user_id=$2`,
		id, userID,
	)
	return err
}

func (s *Store) CreateShare(ctx context.Context, userID, recipeID string, recipeData json.RawMessage) (SharedRecipe, error) {
	var out SharedRecipe
	err := s.pool.QueryRow(ctx,
		`INSERT INTO social.shared_recipes (id, user_id, recipe_id, recipe_data)
		 VALUES ($1, $2, $3, $4)
		 RETURNING id, user_id, recipe_id, recipe_data, share_token, expires_at, created_at`,
		uuid.NewString(), userID, recipeID, []byte(recipeData),
	).Scan(&out.ID, &out.UserID, &out.RecipeID, &out.RecipeData,
		&out.ShareToken, &out.ExpiresAt, &out.CreatedAt)
	return out, err
}

func (s *Store) GetShare(ctx context.Context, token string) (SharedRecipe, error) {
	var out SharedRecipe
	err := s.pool.QueryRow(ctx,
		`SELECT id, user_id, recipe_id, recipe_data, share_token, expires_at, created_at
		 FROM social.shared_recipes WHERE share_token=$1 AND expires_at > now()`,
		token,
	).Scan(&out.ID, &out.UserID, &out.RecipeID, &out.RecipeData,
		&out.ShareToken, &out.ExpiresAt, &out.CreatedAt)
	return out, err
}
