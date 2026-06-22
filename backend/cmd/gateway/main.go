// Command gateway is the single public entrypoint for the frontends. It
// reverse-proxies /api/* to the backend microservices, handles CORS, and injects
// the dev-user identity header so downstream services stay auth-agnostic.
//
// When real authentication is added later, the identity-injection step here is
// replaced with JWT verification — services do not change.
package main

import (
	"log"
	"net/http"
	"net/http/httputil"
	"net/url"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/cors"
	"github.com/pantrytoplate/backend/internal/config"
	"github.com/pantrytoplate/backend/internal/httpx"
	"github.com/pantrytoplate/backend/internal/middleware"
)

func main() {
	cfg := config.Load()

	r := chi.NewRouter()
	r.Use(middleware.Recover, middleware.Logger)
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   splitOrigins(cfg.CORSAllowedOrigins),
		AllowedMethods:   []string{"GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Content-Type", "Authorization", middleware.UserIDHeader},
		AllowCredentials: false,
		MaxAge:           300,
	}))

	r.Get("/healthz", httpx.Health("gateway"))

	// Each microservice is mounted under a stable /api prefix. The path segment
	// after /api is stripped before forwarding so services see clean paths.
	r.Mount("/api/pantry", proxy(cfg.PantryURL, "/api/pantry"))
	r.Mount("/api/recipes", proxy(cfg.RecipeURL, "/api/recipes"))
	r.Mount("/api/nutrition", proxy(cfg.NutritionURL, "/api/nutrition"))
	r.Mount("/api/gamification", proxy(cfg.GamificationURL, "/api/gamification"))

	httpx.Serve(cfg.GatewayAddr, r)
}

// proxy builds a reverse proxy to target, stripping stripPrefix from the path
// and injecting the dev-user header on the way through.
func proxy(target, stripPrefix string) http.Handler {
	u, err := url.Parse(target)
	if err != nil {
		log.Fatalf("invalid upstream URL %q: %v", target, err)
	}
	rp := httputil.NewSingleHostReverseProxy(u)

	originalDirector := rp.Director
	rp.Director = func(req *http.Request) {
		originalDirector(req)
		req.URL.Path = strings.TrimPrefix(req.URL.Path, stripPrefix)
		if req.URL.Path == "" {
			req.URL.Path = "/"
		}
		req.Host = u.Host
		// Inject the fixed dev identity (placeholder for real auth).
		req.Header.Set(middleware.UserIDHeader, config.DevUserID)
	}

	rp.ErrorHandler = func(w http.ResponseWriter, _ *http.Request, err error) {
		httpx.Error(w, http.StatusBadGateway, "upstream unavailable: "+err.Error())
	}
	return rp
}

func splitOrigins(s string) []string {
	parts := strings.Split(s, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		if p = strings.TrimSpace(p); p != "" {
			out = append(out, p)
		}
	}
	if len(out) == 0 {
		return []string{"*"}
	}
	return out
}
