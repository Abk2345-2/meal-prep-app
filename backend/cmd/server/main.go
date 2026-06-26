// Command server is the single backend binary. It exposes all service routes
// under their stable /pantry, /recipes, /nutrition, /gamification paths on one
// port (default :8080), eliminating the need for a separate gateway process.
package main

import (
	"context"
	"log"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/cors"
	"github.com/pantrytoplate/backend/internal/auth"
	"github.com/pantrytoplate/backend/internal/config"
	"github.com/pantrytoplate/backend/internal/db"
	"github.com/pantrytoplate/backend/internal/gamification"
	"github.com/pantrytoplate/backend/internal/httpx"
	"github.com/pantrytoplate/backend/internal/middleware"
	"github.com/pantrytoplate/backend/internal/nutrition"
	"github.com/pantrytoplate/backend/internal/pantry"
	"github.com/pantrytoplate/backend/internal/recipe"
	"github.com/pantrytoplate/backend/internal/recipeprovider"
)

func main() {
	cfg := config.Load()
	ctx := context.Background()

	pool, err := db.Open(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("db: %v", err)
	}
	defer pool.Close()
	if !cfg.SkipMigrations {
		if err := db.Migrate(ctx, pool); err != nil {
			log.Fatalf("migrate: %v", err)
		}
	}

	var provider recipeprovider.Provider
	switch cfg.RecipeProvider {
	case "spoonacular":
		if cfg.SpoonacularAPIKey == "" {
			log.Fatal("SPOONACULAR_API_KEY is required when RECIPE_PROVIDER=spoonacular")
		}
		spoon := recipeprovider.NewSpoonacular(cfg.SpoonacularAPIKey, cfg.SpoonacularBaseURL)
		local, err := recipeprovider.NewLocalProvider()
		if err != nil {
			log.Fatalf("local provider: %v", err)
		}
		// Spoonacular first; fall back to local JSON on quota/auth errors.
		// Cache results for 1 hour to preserve daily quota.
		provider = recipeprovider.NewCachedProvider(
			recipeprovider.NewFallbackProvider(spoon, local),
			time.Hour,
		)
	case "themealdb":
		provider = recipeprovider.NewTheMealDB(cfg.MealDBBaseURL)
	case "local", "":
		local, err := recipeprovider.NewLocalProvider()
		if err != nil {
			log.Fatalf("local provider: %v", err)
		}
		provider = local
	default:
		log.Fatalf("unknown RECIPE_PROVIDER: %s", cfg.RecipeProvider)
	}

	jwtSecret := []byte(cfg.JWTSecret)

	pantryH := pantry.NewHandler(pantry.NewStore(pool))
	recipeH := recipe.NewHandler(recipe.NewService(provider))
	translateH := recipe.NewTranslateHandler(pool, cfg.GoogleTranslateAPIKey)
	nutritionH := nutrition.NewHandler(nutrition.NewStore(pool))
	gamificationH := gamification.NewHandler(gamification.NewStore(pool))
	authH := auth.NewHandler(auth.NewStore(pool), jwtSecret,
		cfg.GoogleClientID, cfg.GoogleClientSecret, cfg.GoogleCallbackURL, cfg.FrontendURL)

	r := chi.NewRouter()
	r.Use(middleware.Recover, middleware.Logger)
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   splitOrigins(cfg.CORSAllowedOrigins),
		AllowedMethods:   []string{"GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Content-Type", "Authorization", middleware.UserIDHeader},
		AllowCredentials: false,
		MaxAge:           300,
	}))

	r.Get("/healthz", httpx.Health("server"))

	// Auth routes don't require an existing session.
	r.Route("/api/auth", func(r chi.Router) {
		authH.Routes(r)
	})

	// All other /api/* routes resolve the caller's identity from a JWT or header.
	r.Route("/api", func(r chi.Router) {
		r.Use(middleware.UserContext(jwtSecret))
		r.Mount("/pantry", pantryRouter(pantryH))
		r.Mount("/recipes", recipeRouter(recipeH, translateH))
		r.Mount("/nutrition", nutritionRouter(nutritionH))
		r.Mount("/gamification", gamificationRouter(gamificationH))
	})

	httpx.Serve(cfg.ServerAddr, r)
}

func pantryRouter(h *pantry.Handler) chi.Router {
	r := chi.NewRouter()
	h.Routes(r)
	return r
}

func recipeRouter(h *recipe.Handler, th *recipe.TranslateHandler) chi.Router {
	r := chi.NewRouter()
	h.Routes(r)
	th.Register(r)
	return r
}

func nutritionRouter(h *nutrition.Handler) chi.Router {
	r := chi.NewRouter()
	h.Routes(r)
	return r
}

func gamificationRouter(h *gamification.Handler) chi.Router {
	r := chi.NewRouter()
	h.Routes(r)
	return r
}

func splitOrigins(s string) []string {
	if s == "" || s == "*" {
		return []string{"*"}
	}
	var out []string
	start := 0
	for i := 0; i <= len(s); i++ {
		if i == len(s) || s[i] == ',' {
			part := trim(s[start:i])
			if part != "" {
				out = append(out, part)
			}
			start = i + 1
		}
	}
	if len(out) == 0 {
		return []string{"*"}
	}
	return out
}

func trim(s string) string {
	for len(s) > 0 && (s[0] == ' ' || s[0] == '\t') {
		s = s[1:]
	}
	for len(s) > 0 && (s[len(s)-1] == ' ' || s[len(s)-1] == '\t') {
		s = s[:len(s)-1]
	}
	return s
}
