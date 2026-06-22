package nutrition

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/pantrytoplate/backend/internal/httpx"
	"github.com/pantrytoplate/backend/internal/middleware"
)

type Handler struct{ store *Store }

func NewHandler(store *Store) *Handler { return &Handler{store: store} }

func (h *Handler) Routes(r chi.Router) {
	r.Get("/goal", h.getGoal)
	r.Put("/goal", h.setGoal)
	r.Post("/log", h.log)
	r.Get("/today", h.today)
}

func (h *Handler) getGoal(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserID(r.Context())
	g, err := h.store.GetGoal(r.Context(), userID)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	httpx.JSON(w, http.StatusOK, g)
}

type goalRequest struct {
	DailyCalories int `json:"daily_calories"`
	ProteinG      int `json:"protein_g"`
	CarbsG        int `json:"carbs_g"`
	FatG          int `json:"fat_g"`
}

func (h *Handler) setGoal(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserID(r.Context())
	var req goalRequest
	if !httpx.Decode(w, r, &req) {
		return
	}
	g, err := h.store.SetGoal(r.Context(), Goal{
		UserID:        userID,
		DailyCalories: req.DailyCalories,
		ProteinG:      req.ProteinG,
		CarbsG:        req.CarbsG,
		FatG:          req.FatG,
	})
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	httpx.JSON(w, http.StatusOK, g)
}

type logRequest struct {
	Source   string `json:"source"`
	Calories int    `json:"calories"`
	ProteinG int    `json:"protein_g"`
	CarbsG   int    `json:"carbs_g"`
	FatG     int    `json:"fat_g"`
}

func (h *Handler) log(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserID(r.Context())
	var req logRequest
	if !httpx.Decode(w, r, &req) {
		return
	}
	if req.Source == "" {
		req.Source = "meal"
	}
	m, err := h.store.Log(r.Context(), MealLog{
		UserID:   userID,
		Source:   req.Source,
		Calories: req.Calories,
		ProteinG: req.ProteinG,
		CarbsG:   req.CarbsG,
		FatG:     req.FatG,
	})
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	// Return the logged meal plus refreshed daily totals so the UI updates in one round-trip.
	totals, _, _ := h.store.TodayTotals(r.Context(), userID)
	httpx.JSON(w, http.StatusCreated, map[string]any{"meal": m, "today": totals})
}

func (h *Handler) today(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserID(r.Context())
	totals, logs, err := h.store.TodayTotals(r.Context(), userID)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	goal, _ := h.store.GetGoal(r.Context(), userID)
	remaining := goal.DailyCalories - totals.Calories
	httpx.JSON(w, http.StatusOK, map[string]any{
		"goal":               goal,
		"totals":             totals,
		"calories_remaining": remaining,
		"meals":              logs,
	})
}
