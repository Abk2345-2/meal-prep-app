package gamification

import (
	"fmt"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/pantrytoplate/backend/internal/httpx"
	"github.com/pantrytoplate/backend/internal/middleware"
)

type Handler struct{ store *Store }

func NewHandler(store *Store) *Handler { return &Handler{store: store} }

func (h *Handler) Routes(r chi.Router) {
	r.Get("/summary", h.summary)
	r.Post("/event", h.event)
	r.Get("/rewards", h.rewards)
	r.Get("/story", h.story)
}

// summary returns streak + total points + reward progress for the header UI.
func (h *Handler) summary(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserID(r.Context())
	streak, err := h.store.GetStreak(r.Context(), userID)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	points, _ := h.store.TotalPoints(r.Context(), userID)
	rewards, _ := h.store.Rewards(r.Context(), userID)

	// Find the next reward the user is working toward.
	var next *Reward
	for i := range rewards {
		if !rewards[i].Unlocked {
			next = &rewards[i]
			break
		}
	}
	httpx.JSON(w, http.StatusOK, map[string]any{
		"streak":       streak,
		"total_points": points,
		"next_reward":  next,
	})
}

type eventRequest struct {
	Action string `json:"action"` // log_pantry, cook_meal, hit_goal, avoid_waste, share, refer
}

// event awards points for a user action and returns the updated totals.
func (h *Handler) event(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserID(r.Context())
	var req eventRequest
	if !httpx.Decode(w, r, &req) {
		return
	}
	if req.Action == "" {
		httpx.Error(w, http.StatusBadRequest, "action is required")
		return
	}
	awarded, err := h.store.Award(r.Context(), userID, req.Action)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	points, _ := h.store.TotalPoints(r.Context(), userID)
	streak, _ := h.store.GetStreak(r.Context(), userID)
	httpx.JSON(w, http.StatusOK, map[string]any{
		"points_awarded": awarded,
		"total_points":   points,
		"streak":         streak,
	})
}

func (h *Handler) rewards(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserID(r.Context())
	rewards, err := h.store.Rewards(r.Context(), userID)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"rewards": rewards})
}

// story builds a shareable, pride-worthy summary of recent activity.
func (h *Handler) story(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserID(r.Context())
	cooked, _ := h.store.WeeklyCookCount(r.Context(), userID)
	streak, _ := h.store.GetStreak(r.Context(), userID)
	points, _ := h.store.TotalPoints(r.Context(), userID)

	text := fmt.Sprintf("This week I cooked %d meals from my pantry 🍳 — %d-day streak! 🔥 #PantryToPlate",
		cooked, streak.Current)
	if cooked == 0 {
		text = fmt.Sprintf("Building my cooking habit on PantryToPlate — %d-day streak! 🔥 #PantryToPlate",
			streak.Current)
	}
	httpx.JSON(w, http.StatusOK, map[string]any{
		"share_text":    text,
		"meals_cooked":  cooked,
		"current_streak": streak.Current,
		"total_points":  points,
	})
}
