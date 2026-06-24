// Package recipeprovider defines a swappable interface for recipe data sources.
package recipeprovider

import "context"

// Recipe is the provider-agnostic recipe shape used throughout the app.
type Recipe struct {
	ID           string       `json:"id"`
	Title        string       `json:"title"`
	Image        string       `json:"image"`
	Category     string       `json:"category"`
	Area         string       `json:"area"`
	Instructions string       `json:"instructions"`
	Ingredients  []Ingredient `json:"ingredients"`
	TimeMinutes  int          `json:"time_minutes"`
	Calories     int          `json:"calories"`
	Protein      int          `json:"protein_g"`
	Carbs        int          `json:"carbs_g"`
	Fat          int          `json:"fat_g"`
	SourceURL    string       `json:"source_url,omitempty"`
	YoutubeURL   string       `json:"youtube_url,omitempty"`

	// PreScored is set by providers (e.g. Spoonacular) that already know the
	// match breakdown from the search response. When true the service layer
	// skips re-scoring and only calls GetByID on the final kept results.
	PreScored           bool     `json:"-"`
	PreMatchScore       float64  `json:"-"`
	PreMatching         []string `json:"-"`
	PreMissing          []string `json:"-"`
}

// Ingredient pairs a name with an optional human-readable measure.
type Ingredient struct {
	Name    string `json:"name"`
	Measure string `json:"measure,omitempty"`
}

// Provider is the interface every recipe source must satisfy.
type Provider interface {
	// SearchByIngredients returns recipes that use the given ingredients.
	// Providers that support multi-ingredient queries in one call should do so;
	// single-ingredient providers loop externally in the service layer.
	SearchByIngredients(ctx context.Context, ingredients []string) ([]Recipe, error)
	// GetByID returns full detail for one recipe.
	GetByID(ctx context.Context, id string) (Recipe, error)
}
