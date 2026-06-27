package social

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/pantrytoplate/backend/internal/httpx"
	"github.com/pantrytoplate/backend/internal/middleware"
	"github.com/pantrytoplate/backend/internal/recipeprovider"
)

// RecipeFinder is the function signature the handler needs to look up recipes by title.
// Injected from cmd/server to avoid a package import cycle.
type RecipeFinder func(ctx context.Context, query string) ([]recipeprovider.Recipe, error)

type Handler struct {
	store       *Store
	findRecipes RecipeFinder
}

func NewHandler(store *Store, findRecipes RecipeFinder) *Handler {
	return &Handler{store: store, findRecipes: findRecipes}
}

func (h *Handler) Routes(r chi.Router) {
	r.Post("/favorites", h.addFavorite)
	r.Delete("/favorites/{recipe_id}", h.removeFavorite)
	r.Get("/favorites", h.listFavorites)

	r.Post("/shopping", h.addShoppingItems)
	r.Get("/shopping", h.listShopping)
	r.Patch("/shopping/{id}/toggle", h.toggleItem)
	r.Delete("/shopping/checked", h.clearChecked)
	r.Delete("/shopping/{id}", h.deleteItem)

	r.Post("/reels/import", h.importReel)
	r.Get("/reels", h.listReels)
	r.Delete("/reels/{id}", h.deleteReel)

	r.Post("/share", h.createShare)
}

// GetSharePublic is mounted outside the auth group for public access.
func (h *Handler) GetSharePublic(w http.ResponseWriter, r *http.Request) {
	token := chi.URLParam(r, "token")
	share, err := h.store.GetShare(r.Context(), token)
	if err != nil {
		httpx.Error(w, http.StatusNotFound, "share not found or expired")
		return
	}
	httpx.JSON(w, http.StatusOK, share)
}

type addFavoriteRequest struct {
	RecipeID   string          `json:"recipe_id"`
	RecipeData json.RawMessage `json:"recipe_data"`
}

func (h *Handler) addFavorite(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserID(r.Context())
	var req addFavoriteRequest
	if !httpx.Decode(w, r, &req) {
		return
	}
	if req.RecipeID == "" {
		httpx.Error(w, http.StatusBadRequest, "recipe_id is required")
		return
	}
	if len(req.RecipeData) == 0 {
		req.RecipeData = json.RawMessage("{}")
	}
	fav, err := h.store.AddFavorite(r.Context(), userID, req.RecipeID, req.RecipeData)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	httpx.JSON(w, http.StatusCreated, fav)
}

func (h *Handler) removeFavorite(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserID(r.Context())
	recipeID := chi.URLParam(r, "recipe_id")
	if err := h.store.RemoveFavorite(r.Context(), userID, recipeID); err != nil {
		httpx.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	httpx.JSON(w, http.StatusNoContent, nil)
}

func (h *Handler) listFavorites(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserID(r.Context())
	favs, err := h.store.ListFavorites(r.Context(), userID)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"favorites": favs})
}

type addShoppingRequest struct {
	Items []ShoppingItem `json:"items"`
}

func (h *Handler) addShoppingItems(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserID(r.Context())
	var req addShoppingRequest
	if !httpx.Decode(w, r, &req) {
		return
	}
	if len(req.Items) == 0 {
		httpx.Error(w, http.StatusBadRequest, "items is required")
		return
	}
	inserted, err := h.store.AddShoppingItems(r.Context(), userID, req.Items)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	httpx.JSON(w, http.StatusCreated, map[string]any{"items": inserted})
}

func (h *Handler) listShopping(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserID(r.Context())
	items, err := h.store.ListShoppingItems(r.Context(), userID)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"items": items})
}

func (h *Handler) toggleItem(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserID(r.Context())
	id := chi.URLParam(r, "id")
	if err := h.store.ToggleShoppingItem(r.Context(), userID, id); err != nil {
		httpx.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	httpx.JSON(w, http.StatusNoContent, nil)
}

func (h *Handler) deleteItem(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserID(r.Context())
	id := chi.URLParam(r, "id")
	if err := h.store.DeleteShoppingItem(r.Context(), userID, id); err != nil {
		httpx.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	httpx.JSON(w, http.StatusNoContent, nil)
}

func (h *Handler) clearChecked(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserID(r.Context())
	if err := h.store.ClearCheckedItems(r.Context(), userID); err != nil {
		httpx.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	httpx.JSON(w, http.StatusNoContent, nil)
}

type importReelRequest struct {
	URL   string `json:"url"`
	Title string `json:"title"`
}

func (h *Handler) importReel(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserID(r.Context())
	var req importReelRequest
	if !httpx.Decode(w, r, &req) {
		return
	}
	if req.URL == "" && req.Title == "" {
		httpx.Error(w, http.StatusBadRequest, "url or title is required")
		return
	}

	platform := extractPlatform(req.URL)
	rawTitle := req.Title
	if rawTitle == "" {
		rawTitle = extractTitleFromURL(req.URL)
	}

	// Search the recipe DB by the extracted title to populate ingredients + instructions.
	title := rawTitle
	image := ""
	instructions := ""
	ingredientsJSON := json.RawMessage("[]")

	if h.findRecipes != nil && rawTitle != "" {
		if matches, err := h.findRecipes(r.Context(), rawTitle); err == nil && len(matches) > 0 {
			best := matches[0]
			title = best.Title
			image = best.Image
			instructions = best.Instructions
			// Marshal ingredients into JSON.
			if data, err := json.Marshal(best.Ingredients); err == nil {
				ingredientsJSON = json.RawMessage(data)
			}
		}
	}

	reel := SavedReel{
		UserID:       userID,
		SourceURL:    req.URL,
		Platform:     platform,
		RawTitle:     rawTitle,
		Title:        title,
		Image:        image,
		Ingredients:  ingredientsJSON,
		Instructions: instructions,
	}

	saved, err := h.store.SaveReel(r.Context(), userID, reel)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	httpx.JSON(w, http.StatusCreated, saved)
}

func (h *Handler) listReels(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserID(r.Context())
	reels, err := h.store.ListReels(r.Context(), userID)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"reels": reels})
}

func (h *Handler) deleteReel(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserID(r.Context())
	id := chi.URLParam(r, "id")
	if err := h.store.DeleteReel(r.Context(), userID, id); err != nil {
		httpx.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	httpx.JSON(w, http.StatusNoContent, nil)
}

type createShareRequest struct {
	RecipeID   string          `json:"recipe_id"`
	RecipeData json.RawMessage `json:"recipe_data"`
}

func (h *Handler) createShare(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserID(r.Context())
	var req createShareRequest
	if !httpx.Decode(w, r, &req) {
		return
	}
	if req.RecipeID == "" {
		httpx.Error(w, http.StatusBadRequest, "recipe_id is required")
		return
	}
	if len(req.RecipeData) == 0 {
		req.RecipeData = json.RawMessage("{}")
	}
	share, err := h.store.CreateShare(r.Context(), userID, req.RecipeID, req.RecipeData)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	httpx.JSON(w, http.StatusCreated, share)
}

func extractPlatform(u string) string {
	lower := strings.ToLower(u)
	switch {
	case strings.Contains(lower, "instagram.com"):
		return "instagram"
	case strings.Contains(lower, "youtube.com/shorts"), strings.Contains(lower, "youtu.be"):
		return "youtube"
	case strings.Contains(lower, "tiktok.com"):
		return "tiktok"
	default:
		return "unknown"
	}
}

func extractTitleFromURL(u string) string {
	// Strip query string and fragment.
	if i := strings.IndexByte(u, '?'); i != -1 {
		u = u[:i]
	}
	if i := strings.IndexByte(u, '#'); i != -1 {
		u = u[:i]
	}
	u = strings.TrimRight(u, "/")
	// Take the last path segment.
	if i := strings.LastIndexByte(u, '/'); i != -1 {
		u = u[i+1:]
	}
	// Replace hyphens and underscores with spaces.
	u = strings.ReplaceAll(u, "-", " ")
	u = strings.ReplaceAll(u, "_", " ")
	return u
}
