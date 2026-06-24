// Command recipe runs the recipe microservice: time-aware, ingredient-matched
// suggestions backed by a swappable recipe provider (default: TheMealDB).
package main

import (
	"log"

	"github.com/go-chi/chi/v5"
	"github.com/pantrytoplate/backend/internal/config"
	"github.com/pantrytoplate/backend/internal/httpx"
	"github.com/pantrytoplate/backend/internal/middleware"
	"github.com/pantrytoplate/backend/internal/recipe"
	"github.com/pantrytoplate/backend/internal/recipeprovider"
)

func main() {
	cfg := config.Load()

	// Select the recipe provider. Add cases here to support more sources.
	var provider recipeprovider.Provider
	switch cfg.RecipeProvider {
	case "themealdb", "":
		provider = recipeprovider.NewTheMealDB(cfg.MealDBBaseURL)
	default:
		log.Fatalf("unknown RECIPE_PROVIDER: %s", cfg.RecipeProvider)
	}

	handler := recipe.NewHandler(recipe.NewService(provider))

	r := chi.NewRouter()
	r.Use(middleware.Recover, middleware.Logger, middleware.UserContext(nil))
	r.Get("/healthz", httpx.Health("recipe"))
	r.Route("/", handler.Routes)

	httpx.Serve(cfg.RecipeAddr, r)
}
