// Command nutrition runs the nutrition microservice: daily goal + meal logging.
package main

import (
	"context"
	"log"

	"github.com/go-chi/chi/v5"
	"github.com/pantrytoplate/backend/internal/config"
	"github.com/pantrytoplate/backend/internal/db"
	"github.com/pantrytoplate/backend/internal/httpx"
	"github.com/pantrytoplate/backend/internal/middleware"
	"github.com/pantrytoplate/backend/internal/nutrition"
)

func main() {
	cfg := config.Load()
	ctx := context.Background()

	pool, err := db.Open(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("db: %v", err)
	}
	defer pool.Close()
	if err := db.Migrate(ctx, pool); err != nil {
		log.Fatalf("migrate: %v", err)
	}

	handler := nutrition.NewHandler(nutrition.NewStore(pool))

	r := chi.NewRouter()
	r.Use(middleware.Recover, middleware.Logger, middleware.UserContext(nil))
	r.Get("/healthz", httpx.Health("nutrition"))
	r.Route("/", handler.Routes)

	httpx.Serve(cfg.NutritionAddr, r)
}
