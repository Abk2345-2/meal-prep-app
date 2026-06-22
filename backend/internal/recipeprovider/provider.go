// Package recipeprovider defines a swappable interface for recipe data sources.
// The default implementation is TheMealDB (free, no API key). To switch providers
// (e.g. Spoonacular, Edamam), add a new implementation and select it via the
// RECIPE_PROVIDER env var — no other code changes.
package recipeprovider

import "context"

// Recipe is the provider-agnostic recipe shape used throughout the app.
type Recipe struct {
	ID          string       `json:"id"`
	Title       string       `json:"title"`
	Image       string       `json:"image"`
	Category    string       `json:"category"`
	Area        string       `json:"area"`
	Instructions string      `json:"instructions"`
	Ingredients []Ingredient `json:"ingredients"`
	// TimeMinutes is an estimate; many free providers do not expose true cook time.
	TimeMinutes int `json:"time_minutes"`
	// Nutrition is an estimate per serving.
	Calories int `json:"calories"`
	Protein  int `json:"protein_g"`
	Carbs    int `json:"carbs_g"`
	Fat      int `json:"fat_g"`
	SourceURL string `json:"source_url,omitempty"`
}

// Ingredient pairs a name with an optional human-readable measure.
type Ingredient struct {
	Name    string `json:"name"`
	Measure string `json:"measure,omitempty"`
}

// Provider is the interface every recipe source must satisfy.
type Provider interface {
	// SearchByIngredient returns recipes that feature the given ingredient.
	SearchByIngredient(ctx context.Context, ingredient string) ([]Recipe, error)
	// GetByID returns full detail for one recipe.
	GetByID(ctx context.Context, id string) (Recipe, error)
}
