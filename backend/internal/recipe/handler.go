package recipe

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/pantrytoplate/backend/internal/httpx"
)

// Handler exposes recipe HTTP endpoints.
type Handler struct {
	svc *Service
}

func NewHandler(svc *Service) *Handler { return &Handler{svc: svc} }

func (h *Handler) Routes(r chi.Router) {
	r.Post("/suggest", h.suggest)
	r.Get("/{id}", h.get)
}

type suggestRequest struct {
	Ingredients []string `json:"ingredients"`
	MaxTime     int      `json:"max_time"`
	MinMatch    float64  `json:"min_match"`
	Limit       int      `json:"limit"`
}

func (h *Handler) suggest(w http.ResponseWriter, r *http.Request) {
	var req suggestRequest
	if !httpx.Decode(w, r, &req) {
		return
	}
	if len(req.Ingredients) == 0 {
		httpx.Error(w, http.StatusBadRequest, "provide at least one ingredient")
		return
	}
	out, err := h.svc.Suggest(r.Context(), SuggestParams{
		Ingredients: req.Ingredients,
		MaxTime:     req.MaxTime,
		MinMatch:    req.MinMatch,
		Limit:       req.Limit,
	})
	if err != nil {
		httpx.Error(w, http.StatusBadGateway, err.Error())
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"recipes": out})
}

func (h *Handler) get(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	rec, err := h.svc.GetByID(r.Context(), id)
	if err != nil {
		httpx.Error(w, http.StatusNotFound, err.Error())
		return
	}
	httpx.JSON(w, http.StatusOK, rec)
}
