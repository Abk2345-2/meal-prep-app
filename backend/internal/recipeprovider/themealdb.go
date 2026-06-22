package recipeprovider

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"
)

// TheMealDB implements Provider against https://www.themealdb.com (free, no key).
// The free API does not provide cook time or nutrition, so we derive reasonable
// estimates from the ingredient list (see estimate*).
type TheMealDB struct {
	baseURL string
	client  *http.Client
}

func NewTheMealDB(baseURL string) *TheMealDB {
	return &TheMealDB{
		baseURL: strings.TrimRight(baseURL, "/"),
		client:  &http.Client{Timeout: 8 * time.Second},
	}
}

// mealDBResponse models both the filter and lookup endpoints.
type mealDBResponse struct {
	Meals []map[string]any `json:"meals"`
}

// SearchByIngredient uses /search.php?s=<ingredient> which is more reliable than
// the /filter.php?i= endpoint (that endpoint has CDN issues on the free tier).
// The search endpoint returns full meal objects so we map them immediately.
func (t *TheMealDB) SearchByIngredient(ctx context.Context, ingredient string) ([]Recipe, error) {
	u := fmt.Sprintf("%s/search.php?s=%s", t.baseURL, url(ingredient))
	var resp mealDBResponse
	if err := t.getJSON(ctx, u, &resp); err != nil {
		return nil, err
	}
	// The API returns {"meals": null} when nothing is found.
	recipes := make([]Recipe, 0, len(resp.Meals))
	for _, m := range resp.Meals {
		recipes = append(recipes, Recipe{
			ID:    str(m["idMeal"]),
			Title: str(m["strMeal"]),
			Image: str(m["strMealThumb"]),
		})
	}
	return recipes, nil
}

// GetByID calls /lookup.php?i=<id> and maps the full meal record.
func (t *TheMealDB) GetByID(ctx context.Context, id string) (Recipe, error) {
	u := fmt.Sprintf("%s/lookup.php?i=%s", t.baseURL, url(id))
	var resp mealDBResponse
	if err := t.getJSON(ctx, u, &resp); err != nil {
		return Recipe{}, err
	}
	if len(resp.Meals) == 0 {
		return Recipe{}, fmt.Errorf("recipe %s not found", id)
	}
	return mapMeal(resp.Meals[0]), nil
}

func (t *TheMealDB) getJSON(ctx context.Context, url string, dst any) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return err
	}
	res, err := t.client.Do(req)
	if err != nil {
		return err
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK {
		return fmt.Errorf("provider returned %d", res.StatusCode)
	}
	return json.NewDecoder(res.Body).Decode(dst)
}

// mapMeal converts a raw TheMealDB meal object into our Recipe shape, pulling the
// strIngredient1..20 / strMeasure1..20 fields and deriving time + nutrition.
func mapMeal(m map[string]any) Recipe {
	r := Recipe{
		ID:           str(m["idMeal"]),
		Title:        str(m["strMeal"]),
		Image:        str(m["strMealThumb"]),
		Category:     str(m["strCategory"]),
		Area:         str(m["strArea"]),
		Instructions: str(m["strInstructions"]),
		SourceURL:    str(m["strSource"]),
	}
	for i := 1; i <= 20; i++ {
		name := strings.TrimSpace(str(m["strIngredient"+strconv.Itoa(i)]))
		if name == "" {
			continue
		}
		r.Ingredients = append(r.Ingredients, Ingredient{
			Name:    name,
			Measure: strings.TrimSpace(str(m["strMeasure"+strconv.Itoa(i)])),
		})
	}
	r.TimeMinutes = estimateTime(r)
	r.Calories, r.Protein, r.Carbs, r.Fat = estimateNutrition(r)
	return r
}

// estimateTime approximates cook time from instruction length + ingredient count,
// since the free API omits it. Clamped to a 10–90 minute range.
func estimateTime(r Recipe) int {
	steps := strings.Count(r.Instructions, ".") + strings.Count(r.Instructions, "\n")
	est := 10 + len(r.Ingredients)*2 + steps
	if est < 10 {
		est = 10
	}
	if est > 90 {
		est = 90
	}
	// Round to the nearest 5 for a cleaner UI.
	return (est / 5) * 5
}

// estimateNutrition gives a rough per-serving estimate (~120 kcal per ingredient)
// with a simple macro split. Replace with a nutrition provider for accuracy.
func estimateNutrition(r Recipe) (cal, protein, carbs, fat int) {
	cal = 150 + len(r.Ingredients)*110
	if cal > 1200 {
		cal = 1200
	}
	protein = cal * 25 / 100 / 4 // 25% of calories from protein, 4 kcal/g
	carbs = cal * 45 / 100 / 4   // 45% carbs
	fat = cal * 30 / 100 / 9     // 30% fat, 9 kcal/g
	return
}

func str(v any) string {
	if s, ok := v.(string); ok {
		return s
	}
	return ""
}

// url is a tiny query escaper (avoids importing net/url just for QueryEscape).
func url(s string) string {
	return strings.ReplaceAll(strings.TrimSpace(s), " ", "%20")
}
