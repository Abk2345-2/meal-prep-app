package recipe

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/pantrytoplate/backend/internal/httpx"
)

// TranslateHandler serves GET /api/recipes/{id}/translate?lang=hi
// It checks the DB cache first, then calls Google Translate, then caches the result.
type TranslateHandler struct {
	pool   *pgxpool.Pool
	apiKey string // Google Translate API key (optional; uses free endpoint if empty)
}

func NewTranslateHandler(pool *pgxpool.Pool, apiKey string) *TranslateHandler {
	return &TranslateHandler{pool: pool, apiKey: apiKey}
}

func (h *TranslateHandler) Register(r chi.Router) {
	r.Get("/{id}/translate", h.translate)
}

func (h *TranslateHandler) translate(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	lang := r.URL.Query().Get("lang")
	if lang == "" || lang == "en" {
		httpx.Error(w, http.StatusBadRequest, "lang param required (e.g. ?lang=hi)")
		return
	}

	ctx := r.Context()

	// 1. Check cache
	var cached string
	err := h.pool.QueryRow(ctx,
		`SELECT instructions FROM recipe.translations WHERE recipe_id=$1 AND lang=$2`,
		id, lang).Scan(&cached)
	if err == nil {
		httpx.JSON(w, http.StatusOK, map[string]string{"instructions": cached, "lang": lang, "cached": "true"})
		return
	}

	// 2. Fetch original instructions
	var original string
	err = h.pool.QueryRow(ctx,
		`SELECT instructions FROM recipe.recipes WHERE id=$1`, id).Scan(&original)
	if err != nil {
		httpx.Error(w, http.StatusNotFound, "recipe not found")
		return
	}

	// 3. Translate
	translated, err := translateText(ctx, original, lang, h.apiKey)
	if err != nil {
		httpx.Error(w, http.StatusBadGateway, "translation failed: "+err.Error())
		return
	}

	// 4. Store in cache (fire-and-forget — don't block the response)
	go func() {
		_, _ = h.pool.Exec(context.Background(),
			`INSERT INTO recipe.translations (recipe_id, lang, instructions)
			 VALUES ($1, $2, $3)
			 ON CONFLICT (recipe_id, lang) DO UPDATE SET instructions = EXCLUDED.instructions, translated_at = now()`,
			id, lang, translated)
	}()

	httpx.JSON(w, http.StatusOK, map[string]string{"instructions": translated, "lang": lang, "cached": "false"})
}

// translateText calls either the paid Cloud Translation API or the free gtx endpoint.
func translateText(_ context.Context, text, targetLang, apiKey string) (string, error) {
	if apiKey != "" {
		return translateWithKey(text, targetLang, apiKey)
	}
	return translateFree(text, targetLang)
}

// translateWithKey uses the official Cloud Translation v2 API.
func translateWithKey(text, targetLang, apiKey string) (string, error) {
	endpoint := fmt.Sprintf("https://translation.googleapis.com/language/translate/v2?key=%s", apiKey)
	body, _ := json.Marshal(map[string]any{
		"q":      text,
		"target": targetLang,
		"format": "text",
	})
	resp, err := http.Post(endpoint, "application/json", strings.NewReader(string(body)))
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	var result struct {
		Data struct {
			Translations []struct {
				TranslatedText string `json:"translatedText"`
			} `json:"translations"`
		} `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", err
	}
	if len(result.Data.Translations) == 0 {
		return "", fmt.Errorf("empty translation response")
	}
	return result.Data.Translations[0].TranslatedText, nil
}

// translateFree uses the unofficial gtx endpoint (no API key, rate-limited).
// Good enough for occasional use; swap for the paid API for production.
func translateFree(text, targetLang string) (string, error) {
	endpoint := fmt.Sprintf(
		"https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=%s&dt=t&q=%s",
		url.QueryEscape(targetLang), url.QueryEscape(text),
	)
	resp, err := http.Get(endpoint)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	raw, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}
	// Response is a nested JSON array: [[["translated","original",...],...],...]
	var data [][][]any
	if err := json.Unmarshal(raw, &data); err != nil {
		return "", fmt.Errorf("parse gtx response: %w", err)
	}
	var sb strings.Builder
	if len(data) > 0 {
		for _, part := range data[0] {
			if len(part) > 0 {
				if s, ok := part[0].(string); ok {
					sb.WriteString(s)
				}
			}
		}
	}
	if sb.Len() == 0 {
		return "", fmt.Errorf("empty translation")
	}
	return sb.String(), nil
}
