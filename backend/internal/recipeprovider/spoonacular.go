package recipeprovider

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"
)

// Spoonacular implements Provider using the Spoonacular food API.
// Sign up free at https://spoonacular.com/food-api/console (no credit card).
// Set SPOONACULAR_API_KEY in the environment.
type Spoonacular struct {
	apiKey  string
	baseURL string
	client  *http.Client
}

func NewSpoonacular(apiKey, baseURL string) *Spoonacular {
	if baseURL == "" {
		baseURL = "https://api.spoonacular.com"
	}
	return &Spoonacular{
		apiKey:  apiKey,
		baseURL: strings.TrimRight(baseURL, "/"),
		client:  &http.Client{Timeout: 10 * time.Second},
	}
}

// spoonFindResult is the shape returned by /recipes/findByIngredients.
type spoonFindResult struct {
	ID    int    `json:"id"`
	Title string `json:"title"`
	Image string `json:"image"`
	// UsedIngredientCount / MissedIngredientCount give match quality.
	UsedIngredientCount   int                  `json:"usedIngredientCount"`
	MissedIngredientCount int                  `json:"missedIngredientCount"`
	UsedIngredients       []spoonIngredientRef `json:"usedIngredients"`
	MissedIngredients     []spoonIngredientRef `json:"missedIngredients"`
}

type spoonIngredientRef struct {
	Name        string  `json:"name"`
	Amount      float64 `json:"amount"`
	Unit        string  `json:"unit"`
	OriginalName string `json:"originalName"`
}

// spoonDetailResult is the shape returned by /recipes/{id}/information.
type spoonDetailResult struct {
	ID               int                  `json:"id"`
	Title            string               `json:"title"`
	Image            string               `json:"image"`
	Cuisines         []string             `json:"cuisines"`
	DishTypes        []string             `json:"dishTypes"`
	Instructions     string               `json:"instructions"`
	ExtendedIngredients []spoonIngredient `json:"extendedIngredients"`
	ReadyInMinutes   int                  `json:"readyInMinutes"`
	SourceURL        string               `json:"sourceUrl"`
	Nutrition        *spoonNutrition      `json:"nutrition"`
}

type spoonIngredient struct {
	Name     string  `json:"name"`
	Amount   float64 `json:"amount"`
	Unit     string  `json:"unit"`
	Original string  `json:"original"`
}

type spoonNutrition struct {
	Nutrients []spoonNutrient `json:"nutrients"`
}

type spoonNutrient struct {
	Name   string  `json:"name"`
	Amount float64 `json:"amount"`
	Unit   string  `json:"unit"`
}

// SearchByIngredients calls findByIngredients with all ingredients in one request.
func (s *Spoonacular) SearchByIngredients(ctx context.Context, ingredients []string) ([]Recipe, error) {
	if len(ingredients) == 0 {
		return nil, nil
	}
	u := fmt.Sprintf("%s/recipes/findByIngredients?ingredients=%s&number=20&ranking=2&ignorePantry=true&apiKey=%s",
		s.baseURL,
		url.QueryEscape(strings.Join(ingredients, ",")),
		s.apiKey,
	)
	var results []spoonFindResult
	if err := s.getJSON(ctx, u, &results); err != nil {
		return nil, err
	}
	out := make([]Recipe, 0, len(results))
	for _, r := range results {
		total := r.UsedIngredientCount + r.MissedIngredientCount
		var matchScore float64
		if total > 0 {
			matchScore = float64(r.UsedIngredientCount) / float64(total)
		}
		matching := make([]string, 0, len(r.UsedIngredients))
		for _, ing := range r.UsedIngredients {
			matching = append(matching, ing.OriginalName)
		}
		missing := make([]string, 0, len(r.MissedIngredients))
		for _, ing := range r.MissedIngredients {
			missing = append(missing, ing.OriginalName)
		}
		out = append(out, Recipe{
			ID:            strconv.Itoa(r.ID),
			Title:         r.Title,
			Image:         r.Image,
			PreScored:     true,
			PreMatchScore: matchScore,
			PreMatching:   matching,
			PreMissing:    missing,
		})
	}
	return out, nil
}

// GetByID calls /recipes/{id}/information?includeNutrition=true.
func (s *Spoonacular) GetByID(ctx context.Context, id string) (Recipe, error) {
	u := fmt.Sprintf("%s/recipes/%s/information?includeNutrition=true&apiKey=%s",
		s.baseURL, id, s.apiKey)
	var d spoonDetailResult
	if err := s.getJSON(ctx, u, &d); err != nil {
		return Recipe{}, err
	}
	r := Recipe{
		ID:           strconv.Itoa(d.ID),
		Title:        d.Title,
		Image:        d.Image,
		Instructions: d.Instructions,
		TimeMinutes:  d.ReadyInMinutes,
		SourceURL:    d.SourceURL,
	}
	if len(d.Cuisines) > 0 {
		r.Area = d.Cuisines[0]
	}
	if len(d.DishTypes) > 0 {
		r.Category = d.DishTypes[0]
	}
	for _, ing := range d.ExtendedIngredients {
		measure := ""
		if ing.Amount > 0 {
			measure = fmt.Sprintf("%.4g %s", ing.Amount, ing.Unit)
		}
		r.Ingredients = append(r.Ingredients, Ingredient{
			Name:    ing.Name,
			Measure: strings.TrimSpace(measure),
		})
	}
	if d.Nutrition != nil {
		for _, n := range d.Nutrition.Nutrients {
			switch n.Name {
			case "Calories":
				r.Calories = int(n.Amount)
			case "Protein":
				r.Protein = int(n.Amount)
			case "Carbohydrates":
				r.Carbs = int(n.Amount)
			case "Fat":
				r.Fat = int(n.Amount)
			}
		}
	}
	// Fall back to estimate if nutrition data is absent.
	if r.Calories == 0 {
		r.Calories, r.Protein, r.Carbs, r.Fat = estimateNutrition(r)
	}
	if r.TimeMinutes == 0 {
		r.TimeMinutes = estimateTime(r)
	}
	return r, nil
}

func (s *Spoonacular) getJSON(ctx context.Context, rawURL string, dst any) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, rawURL, nil)
	if err != nil {
		return err
	}
	res, err := s.client.Do(req)
	if err != nil {
		return err
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK {
		return fmt.Errorf("spoonacular returned %d", res.StatusCode)
	}
	return json.NewDecoder(res.Body).Decode(dst)
}
