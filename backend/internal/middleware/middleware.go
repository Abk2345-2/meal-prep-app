// Package middleware holds cross-cutting HTTP middleware: request logging,
// panic recovery, and reading the injected user identity into context.
package middleware

import (
	"context"
	"log"
	"net/http"
	"time"

	"github.com/pantrytoplate/backend/internal/config"
)

// UserIDHeader is the header the gateway injects on every proxied request.
const UserIDHeader = "X-User-Id"

type ctxKey string

const userIDKey ctxKey = "userID"

// UserContext reads X-User-Id into the request context. If absent (e.g. a
// service is called directly during development), it falls back to the dev user
// so endpoints always have an identity to work with.
func UserContext(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		uid := r.Header.Get(UserIDHeader)
		if uid == "" {
			uid = config.DevUserID
		}
		ctx := context.WithValue(r.Context(), userIDKey, uid)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// UserID extracts the identity placed by UserContext.
func UserID(ctx context.Context) string {
	if v, ok := ctx.Value(userIDKey).(string); ok && v != "" {
		return v
	}
	return config.DevUserID
}

// statusRecorder captures the response status for logging.
type statusRecorder struct {
	http.ResponseWriter
	status int
}

func (s *statusRecorder) WriteHeader(code int) {
	s.status = code
	s.ResponseWriter.WriteHeader(code)
}

// Logger logs method, path, status and duration for each request.
func Logger(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		rec := &statusRecorder{ResponseWriter: w, status: http.StatusOK}
		next.ServeHTTP(rec, r)
		log.Printf("%s %s %d %s", r.Method, r.URL.Path, rec.status, time.Since(start))
	})
}

// Recover converts panics into a 500 response instead of crashing the service.
func Recover(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if rec := recover(); rec != nil {
				log.Printf("panic: %v", rec)
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusInternalServerError)
				_, _ = w.Write([]byte(`{"error":{"message":"internal server error"}}`))
			}
		}()
		next.ServeHTTP(w, r)
	})
}
