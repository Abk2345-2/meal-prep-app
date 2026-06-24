// Command gamification runs the engagement microservice: points, streaks,
// rewards and shareable stories.
package main

import (
	"context"
	"log"

	"github.com/go-chi/chi/v5"
	"github.com/pantrytoplate/backend/internal/config"
	"github.com/pantrytoplate/backend/internal/db"
	"github.com/pantrytoplate/backend/internal/gamification"
	"github.com/pantrytoplate/backend/internal/httpx"
	"github.com/pantrytoplate/backend/internal/middleware"
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

	handler := gamification.NewHandler(gamification.NewStore(pool))

	r := chi.NewRouter()
	r.Use(middleware.Recover, middleware.Logger, middleware.UserContext(nil))
	r.Get("/healthz", httpx.Health("gamification"))
	r.Route("/", handler.Routes)

	httpx.Serve(cfg.GamificationAddr, r)
}
