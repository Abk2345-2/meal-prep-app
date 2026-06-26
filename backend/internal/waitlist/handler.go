package waitlist

import (
	"context"
	"net/http"
	"regexp"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/pantrytoplate/backend/internal/httpx"
)

var emailRE = regexp.MustCompile(`^[^\s@]+@[^\s@]+\.[^\s@]+$`)

type Handler struct{ pool *pgxpool.Pool }

func NewHandler(pool *pgxpool.Pool) *Handler { return &Handler{pool: pool} }

func (h *Handler) Join(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Email  string `json:"email"`
		Source string `json:"source"`
	}
	if !httpx.Decode(w, r, &req) {
		return
	}
	req.Email = strings.TrimSpace(strings.ToLower(req.Email))
	if !emailRE.MatchString(req.Email) {
		httpx.Error(w, http.StatusBadRequest, "invalid email address")
		return
	}
	if req.Source == "" {
		req.Source = "web"
	}

	_, err := h.pool.Exec(context.Background(),
		`INSERT INTO public.waitlist (email, source)
		 VALUES ($1, $2)
		 ON CONFLICT (email) DO NOTHING`,
		req.Email, req.Source)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "could not save email")
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]string{"status": "joined"})
}
