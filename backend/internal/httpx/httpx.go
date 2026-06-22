// Package httpx provides small JSON request/response helpers shared by services.
package httpx

import (
	"encoding/json"
	"net/http"
)

// JSON writes v as a JSON response with the given status code.
func JSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if v != nil {
		_ = json.NewEncoder(w).Encode(v)
	}
}

// Error writes a uniform error envelope: {"error": {"message": "..."}}.
func Error(w http.ResponseWriter, status int, message string) {
	JSON(w, status, map[string]any{"error": map[string]string{"message": message}})
}

// Decode reads and validates a JSON request body into dst.
// Returns false (and writes a 400) if the body cannot be decoded.
func Decode(w http.ResponseWriter, r *http.Request, dst any) bool {
	if err := json.NewDecoder(r.Body).Decode(dst); err != nil {
		Error(w, http.StatusBadRequest, "invalid JSON body: "+err.Error())
		return false
	}
	return true
}

// Health returns a simple liveness handler for GET /healthz.
func Health(service string) http.HandlerFunc {
	return func(w http.ResponseWriter, _ *http.Request) {
		JSON(w, http.StatusOK, map[string]string{"status": "ok", "service": service})
	}
}
