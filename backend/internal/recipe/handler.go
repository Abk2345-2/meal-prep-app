package recipe

import (
	"net/http"
	"strconv"

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
	r.Get("/search", h.search)
	r.Get("/{id}", h.get)
}

type suggestRequest struct {
	Ingredients []string `json:"ingredients"`
	MinTime     int      `json:"min_time"`
	MaxTime     int      `json:"max_time"`
	Area        string   `json:"area"`
	Category    string   `json:"category"`
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
		MinTime:     req.MinTime,
		MaxTime:     req.MaxTime,
		Area:        req.Area,
		Category:    req.Category,
		MinMatch:    req.MinMatch,
		Limit:       req.Limit,
	})
	if err != nil {
		httpx.Error(w, http.StatusBadGateway, err.Error())
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"recipes": out})
}

// search handles GET /api/recipes/search?q=&area=&category=&max_time=&min_time=&limit=&offset=
func (h *Handler) search(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	p := SearchParams{
		Query:    q.Get("q"),
		Area:     q.Get("area"),
		Category: q.Get("category"),
	}
	if v, err := strconv.Atoi(q.Get("max_time")); err == nil {
		p.MaxTime = v
	}
	if v, err := strconv.Atoi(q.Get("min_time")); err == nil {
		p.MinTime = v
	}
	if v, err := strconv.Atoi(q.Get("limit")); err == nil && v > 0 {
		p.Limit = v
	}
	if v, err := strconv.Atoi(q.Get("offset")); err == nil && v >= 0 {
		p.Offset = v
	}
	results, err := h.svc.Search(r.Context(), p)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"recipes": results, "total": len(results)})
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
