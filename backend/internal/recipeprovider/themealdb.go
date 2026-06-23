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

// SearchByIngredients queries /filter.php?i= once per ingredient (free tier
// limitation — multi-ingredient filter is premium only) and deduplicates.
func (t *TheMealDB) SearchByIngredients(ctx context.Context, ingredients []string) ([]Recipe, error) {
	seen := map[string]bool{}
	var out []Recipe
	for _, ing := range ingredients {
		key := firstWord(ing)
		if key == "" {
			continue
		}
		u := fmt.Sprintf("%s/filter.php?i=%s", t.baseURL, queryEscape(key))
		var resp mealDBResponse
		if err := t.getJSON(ctx, u, &resp); err != nil {
			continue // skip failing ingredient rather than aborting
		}
		for _, m := range resp.Meals {
			id := str(m["idMeal"])
			if seen[id] {
				continue
			}
			seen[id] = true
			out = append(out, Recipe{
				ID:    id,
				Title: str(m["strMeal"]),
				Image: str(m["strMealThumb"]),
			})
		}
	}
	return out, nil
}

func firstWord(s string) string {
	s = strings.TrimSpace(s)
	for i, r := range s {
		if r == ' ' || r == '\t' {
			return strings.ToLower(s[:i])
		}
	}
	return strings.ToLower(s)
}

// GetByID calls /lookup.php?i=<id> and maps the full meal record.
func (t *TheMealDB) GetByID(ctx context.Context, id string) (Recipe, error) {
	u := fmt.Sprintf("%s/lookup.php?i=%s", t.baseURL, queryEscape(id))
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

// estimateTime approximates cook time from paragraph count + ingredient count.
// Counting every "." was far too aggressive — MealDB instructions are verbose.
// Instead we count paragraph breaks (blank lines) as step boundaries, which
// is much closer to actual step count.
func estimateTime(r Recipe) int {
	// Each ingredient adds ~1.5 min (prep), each paragraph step adds ~4 min.
	paragraphs := len(strings.Split(strings.TrimSpace(r.Instructions), "\n\n"))
	// \r\n\r\n variant
	if p2 := len(strings.Split(strings.TrimSpace(r.Instructions), "\r\n\r\n")); p2 > paragraphs {
		paragraphs = p2
	}
	est := 5 + len(r.Ingredients) + paragraphs*4
	if est < 10 {
		est = 10
	}
	if est > 90 {
		est = 90
	}
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

func queryEscape(s string) string {
	return strings.ReplaceAll(strings.TrimSpace(s), " ", "%20")
}
