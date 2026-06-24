// Package config loads service configuration from environment variables.
// Every value has a sensible local-dev default so the stack runs with zero setup.
package config

import (
	"os"
)

// DevUserID is the fixed user identity injected by the gateway while real auth
// is not yet implemented. It is also seeded into the database (see migrations).
const DevUserID = "00000000-0000-0000-0000-000000000001"

// Config holds everything a service needs to boot.
type Config struct {
	// DatabaseURL makes the database fully swappable — point it at any
	// Postgres-compatible instance. Example:
	//   postgres://user:pass@localhost:5432/pantrytoplate?sslmode=disable
	DatabaseURL string

	// ServerAddr is the single-binary listen address (cmd/server).
	ServerAddr string

	// Per-service listen addresses (used by each cmd/* binary).
	GatewayAddr      string
	PantryAddr       string
	RecipeAddr       string
	NutritionAddr    string
	GamificationAddr string

	// Upstream URLs the gateway proxies to.
	PantryURL       string
	RecipeURL       string
	NutritionURL    string
	GamificationURL string

	// Recipe provider selection + config. Provider is swappable via env.
	// Set RECIPE_PROVIDER=spoonacular and SPOONACULAR_API_KEY to switch.
	RecipeProvider      string // "themealdb" (default) | "spoonacular"
	MealDBBaseURL       string
	SpoonacularAPIKey   string
	SpoonacularBaseURL  string

	// GroqAPIKey is used by the pantry transcription endpoint.
	GroqAPIKey string

	// Google OAuth 2.0 credentials (from Google Cloud Console).
	GoogleClientID     string
	GoogleClientSecret string
	// GoogleCallbackURL must match the redirect URI registered in Google Cloud Console.
	// Example: http://localhost:8080/api/auth/callback
	GoogleCallbackURL string
	// FrontendURL is the web app origin used to redirect after OAuth login.
	// Example: http://localhost:3000
	FrontendURL string

	// JWTSecret is the HMAC-SHA256 signing key for issued tokens.
	// Must be at least 32 bytes of random data in production.
	JWTSecret string

	// CORS allow-list for the browser frontend.
	CORSAllowedOrigins string
}

// Load reads configuration from the environment, applying defaults.
func Load() Config {
	return Config{
		DatabaseURL: env("DATABASE_URL", "postgres://pantry:pantry@localhost:5432/pantrytoplate?sslmode=disable"),

		ServerAddr: env("SERVER_ADDR", ":8080"),

		GatewayAddr:      env("GATEWAY_ADDR", ":8080"),
		PantryAddr:       env("PANTRY_ADDR", ":8081"),
		RecipeAddr:       env("RECIPE_ADDR", ":8082"),
		NutritionAddr:    env("NUTRITION_ADDR", ":8083"),
		GamificationAddr: env("GAMIFICATION_ADDR", ":8084"),

		PantryURL:       env("PANTRY_URL", "http://localhost:8081"),
		RecipeURL:       env("RECIPE_URL", "http://localhost:8082"),
		NutritionURL:    env("NUTRITION_URL", "http://localhost:8083"),
		GamificationURL: env("GAMIFICATION_URL", "http://localhost:8084"),

		RecipeProvider:     env("RECIPE_PROVIDER", "local"),
		MealDBBaseURL:      env("MEALDB_BASE_URL", "https://www.themealdb.com/api/json/v1/1"),
		SpoonacularAPIKey:  env("SPOONACULAR_API_KEY", ""),
		SpoonacularBaseURL: env("SPOONACULAR_BASE_URL", "https://api.spoonacular.com"),

		GroqAPIKey: env("GROQ_API_KEY", ""),

		GoogleClientID:     env("GOOGLE_CLIENT_ID", ""),
		GoogleClientSecret: env("GOOGLE_CLIENT_SECRET", ""),
		GoogleCallbackURL:  env("GOOGLE_CALLBACK_URL", "http://localhost:8080/api/auth/callback"),
		FrontendURL:        env("FRONTEND_URL", "http://localhost:3000"),
		JWTSecret:          env("JWT_SECRET", "dev-secret-change-in-production"),

		CORSAllowedOrigins: env("CORS_ALLOWED_ORIGINS", "*"),
	}
}

func env(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
