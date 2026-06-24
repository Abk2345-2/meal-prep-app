// Package middleware holds cross-cutting HTTP middleware: request logging,
// panic recovery, and reading the injected user identity into context.
package middleware

import (
	"context"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/pantrytoplate/backend/internal/auth"
	"github.com/pantrytoplate/backend/internal/config"
)

// UserIDHeader is the header the gateway injects on every proxied request.
const UserIDHeader = "X-User-Id"

type ctxKey string

const userIDKey ctxKey = "userID"

// UserContext resolves the caller's identity using one of two mechanisms:
//  1. Bearer JWT in the Authorization header (production path)
//  2. X-User-Id header (legacy gateway / dev path — no JWT required)
//
// If neither is present it falls back to the fixed dev user so local
// development works without credentials.
func UserContext(jwtSecret []byte) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			uid := resolveUserID(r, jwtSecret)
			ctx := context.WithValue(r.Context(), userIDKey, uid)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func resolveUserID(r *http.Request, jwtSecret []byte) string {
	// Prefer a verified JWT when a Bearer token is present.
	if authHeader := r.Header.Get("Authorization"); strings.HasPrefix(authHeader, "Bearer ") {
		tokenStr := authHeader[7:]
		if claims, err := auth.VerifyToken(jwtSecret, tokenStr); err == nil {
			return claims.UserID
		}
		// Invalid / expired token — do NOT fall through to header or dev user.
		return ""
	}

	// Fallback: trust the X-User-Id header (set by the gateway or in dev).
	if uid := r.Header.Get(UserIDHeader); uid != "" {
		return uid
	}

	return config.DevUserID
}

// RequireAuth rejects requests whose user ID could not be resolved (empty
// string produced by resolveUserID when a bad JWT was presented).
func RequireAuth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if uid, _ := r.Context().Value(userIDKey).(string); uid == "" {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusUnauthorized)
			_, _ = w.Write([]byte(`{"error":{"message":"unauthorized"}}`))
			return
		}
		next.ServeHTTP(w, r)
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
