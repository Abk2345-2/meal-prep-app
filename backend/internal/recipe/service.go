// Package recipe implements time-aware, ingredient-matched recipe suggestions on
// top of a swappable recipeprovider.Provider.
package recipe

import (
	"context"
	"regexp"
	"sort"
	"strings"

	"github.com/pantrytoplate/backend/internal/recipeprovider"
)

// wordMatch returns true when the filter string appears as a whole word (or word
// prefix) inside the field. "indian" matches "Indian", "North Indian Recipes" but
// NOT "Indian" inside "Italian Recipes" if spelled differently.
// We use \b word boundaries to avoid partial-word collisions.
func wordMatch(field, filter string) bool {
	if filter == "" {
		return true
	}
	// Fast path: exact word match
	re := regexp.MustCompile(`(?i)\b` + regexp.QuoteMeta(filter) + `\b`)
	return re.MatchString(field)
}

// Service ranks provider recipes against a user's available ingredients.
type Service struct {
	provider recipeprovider.Provider
}

func NewService(p recipeprovider.Provider) *Service { return &Service{provider: p} }

// Suggestion is a recipe annotated with how well it matches the pantry.
type Suggestion struct {
	recipeprovider.Recipe
	MatchScore         float64  `json:"match_score"`          // 0..1
	MatchingIngredients []string `json:"matching_ingredients"`
	MissingIngredients  []string `json:"missing_ingredients"`
}

// SuggestParams controls a suggestion query.
type SuggestParams struct {
	Ingredients []string // normalized pantry ingredient names
	MinTime     int      // minutes lower bound (exclusive); 0 = no lower bound
	MaxTime     int      // minutes upper bound (inclusive); 0 = no limit
	Area        string   // filter by cuisine/area substring, case-insensitive; "" = all
	Category    string   // filter by course/category substring, e.g. "breakfast", "dessert"
	MinMatch    float64  // minimum match score, default 0.2
	Limit       int      // max results, default 8
	Dietary     string   // dietary filter: "vegetarian", "vegan", "high-protein", "low-carb"; "" = all
}

// SearchParams controls the freetext search endpoint.
type SearchParams struct {
	Query    string // free-text: matched against title, area, category
	Area     string // cuisine filter (substring)
	Category string // course filter (substring)
	MaxTime  int    // 0 = no limit
	MinTime  int    // 0 = no lower bound
	Limit    int    // default 20
	Offset   int    // for pagination
	Dietary  string // dietary filter: "vegetarian", "vegan", "high-protein", "low-carb"; "" = all
}

// Suggest fetches candidate recipes (seeded by the user's ingredients), scores
// each by ingredient overlap, filters by cook time + min match, and returns the
// top N. Mirrors the spec's suggest_recipes pseudocode.
func (s *Service) Suggest(ctx context.Context, p SuggestParams) ([]Suggestion, error) {
	if p.MinMatch == 0 {
		p.MinMatch = 0.2
	}
	if p.Limit == 0 {
		p.Limit = 8
	}

	// 1. Gather candidates via multi-ingredient search.
	found, err := s.provider.SearchByIngredients(ctx, p.Ingredients)
	if err != nil {
		return nil, err
	}
	seen := map[string]bool{}
	candidates := make([]recipeprovider.Recipe, 0, len(found))
	for _, r := range found {
		if !seen[r.ID] {
			seen[r.ID] = true
			candidates = append(candidates, r)
		}
	}

	// 2. Score candidates.
	// For pre-scored providers (Spoonacular) this is free — no extra API call.
	// For others, scoring requires the full ingredient list from GetByID, so
	// we hydrate eagerly (MealDB has no per-call cost).
	owned := toSet(p.Ingredients)

	type scored struct {
		stub recipeprovider.Recipe
		sg   Suggestion
	}
	var ranked []scored

	areaFilter     := strings.ToLower(strings.TrimSpace(p.Area))
	categoryFilter := strings.ToLower(strings.TrimSpace(p.Category))

	for _, c := range candidates {
		if c.PreScored {
			// Use the match data from the search response; skip GetByID for now.
			if c.PreMatchScore < p.MinMatch {
				continue
			}
			// Area filter on stub (LocalProvider always populates Area on the stub)
			if areaFilter != "" && !wordMatch(c.Area, areaFilter) {
				continue
			}
			if categoryFilter != "" && !wordMatch(c.Category, categoryFilter) {
				continue
			}
			if !matchesDietary(c, p.Dietary) {
				continue
			}
			ranked = append(ranked, scored{
				stub: c,
				sg: Suggestion{
					Recipe:              c,
					MatchScore:          round2(c.PreMatchScore),
					MatchingIngredients: c.PreMatching,
					MissingIngredients:  c.PreMissing,
				},
			})
		} else {
			// Provider doesn't pre-score: hydrate now and score locally.
			full, err := s.provider.GetByID(ctx, c.ID)
			if err != nil {
				continue
			}
			if p.MaxTime > 0 && full.TimeMinutes > p.MaxTime {
				continue
			}
			if p.MinTime > 0 && full.TimeMinutes <= p.MinTime {
				continue
			}
			if areaFilter != "" && !wordMatch(full.Area, areaFilter) {
				continue
			}
			if categoryFilter != "" && !wordMatch(full.Category, categoryFilter) {
				continue
			}
			if !matchesDietary(full, p.Dietary) {
				continue
			}
			sg := score(full, owned)
			if sg.MatchScore < p.MinMatch {
				continue
			}
			ranked = append(ranked, scored{stub: full, sg: sg})
		}
	}

	// 3. Sort by best match, then title (stable; time unknown until hydrated).
	sort.Slice(ranked, func(i, j int) bool {
		if ranked[i].sg.MatchScore != ranked[j].sg.MatchScore {
			return ranked[i].sg.MatchScore > ranked[j].sg.MatchScore
		}
		return ranked[i].sg.Title < ranked[j].sg.Title
	})

	if len(ranked) > p.Limit {
		ranked = ranked[:p.Limit]
	}

	// 4. Hydrate only the final kept pre-scored results.
	suggestions := make([]Suggestion, 0, len(ranked))
	for _, r := range ranked {
		if r.stub.PreScored {
			full, err := s.provider.GetByID(ctx, r.stub.ID)
			if err != nil {
				// Keep the stub rather than dropping the result entirely.
				full = r.stub
			}
			if p.MaxTime > 0 && full.TimeMinutes > p.MaxTime {
				continue
			}
			if p.MinTime > 0 && full.TimeMinutes <= p.MinTime {
				continue
			}
			sg := r.sg
			sg.Recipe = full
			if !matchesDietary(full, p.Dietary) {
				continue
			}
			suggestions = append(suggestions, sg)
		} else {
			suggestions = append(suggestions, r.sg)
		}
	}

	return suggestions, nil
}

// GetByID returns full recipe detail.
func (s *Service) GetByID(ctx context.Context, id string) (recipeprovider.Recipe, error) {
	return s.provider.GetByID(ctx, id)
}

// Search performs freetext + filter search directly on the local recipe index.
// Works only with LocalProvider; returns empty for other providers.
// SearchResult wraps Recipe with the same suggestion fields (zeroed) so the
// frontend can use a single RecipeCard component for both suggest and search.
type SearchResult struct {
	recipeprovider.Recipe
	MatchScore          float64  `json:"match_score"`
	MatchingIngredients []string `json:"matching_ingredients"`
	MissingIngredients  []string `json:"missing_ingredients"`
}

func (s *Service) Search(ctx context.Context, p SearchParams) ([]SearchResult, error) {
	if p.Limit == 0 {
		p.Limit = 20
	}

	lp, ok := s.provider.(interface {
		All() []recipeprovider.Recipe
	})
	if !ok {
		return nil, nil // not a local provider
	}

	query    := strings.ToLower(strings.TrimSpace(p.Query))
	area     := strings.ToLower(strings.TrimSpace(p.Area))
	category := strings.ToLower(strings.TrimSpace(p.Category))

	var results []SearchResult
	for _, r := range lp.All() {
		// Time filter
		if p.MaxTime > 0 && r.TimeMinutes > p.MaxTime {
			continue
		}
		if p.MinTime > 0 && r.TimeMinutes <= p.MinTime {
			continue
		}
		// Area filter
		if area != "" && !wordMatch(r.Area, area) {
			continue
		}
		// Category filter
		if category != "" && !wordMatch(r.Category, category) {
			continue
		}
		// Full-text: match title, area, or category
		if query != "" {
			titleMatch    := strings.Contains(strings.ToLower(r.Title), query)
			areaMatch     := strings.Contains(strings.ToLower(r.Area), query)
			categoryMatch := strings.Contains(strings.ToLower(r.Category), query)
			if !titleMatch && !areaMatch && !categoryMatch {
				continue
			}
		}
		if !matchesDietary(r, p.Dietary) {
			continue
		}
		results = append(results, SearchResult{
			Recipe:              r,
			MatchScore:          0,
			MatchingIngredients: []string{},
			MissingIngredients:  []string{},
		})
		if len(results) >= p.Offset+p.Limit {
			break
		}
	}
	if p.Offset >= len(results) {
		return []SearchResult{}, nil
	}
	return results[p.Offset:], nil
}

// score computes ingredient overlap between a recipe and the owned set.
func score(r recipeprovider.Recipe, owned map[string]bool) Suggestion {
	matching := make([]string, 0)
	missing := make([]string, 0)
	for _, ing := range r.Ingredients {
		norm := strings.ToLower(strings.TrimSpace(ing.Name))
		if ownsIngredient(owned, norm) {
			matching = append(matching, ing.Name)
		} else {
			missing = append(missing, ing.Name)
		}
	}
	total := len(r.Ingredients)
	var sc float64
	if total > 0 {
		sc = float64(len(matching)) / float64(total)
	}
	return Suggestion{
		Recipe:              r,
		MatchScore:          round2(sc),
		MatchingIngredients: matching,
		MissingIngredients:  missing,
	}
}

// ownsIngredient does a fuzzy contains-match so "chicken" owns "chicken breast".
func ownsIngredient(owned map[string]bool, recipeIngredient string) bool {
	if owned[recipeIngredient] {
		return true
	}
	for have := range owned {
		if have == "" {
			continue
		}
		if strings.Contains(recipeIngredient, have) || strings.Contains(have, recipeIngredient) {
			return true
		}
	}
	return false
}

var meatKeywords = []string{"chicken", "beef", "pork", "fish", "lamb", "shrimp", "prawn", "mutton"}
var dairyKeywords = []string{"milk", "butter", "ghee", "cheese", "paneer", "curd", "egg", "cream"}

func matchesDietary(r recipeprovider.Recipe, dietary string) bool {
	if dietary == "" {
		return true
	}
	switch dietary {
	case "vegetarian":
		for _, ing := range r.Ingredients {
			name := strings.ToLower(ing.Name)
			for _, kw := range meatKeywords {
				if strings.Contains(name, kw) {
					return false
				}
			}
		}
	case "vegan":
		exclude := append(meatKeywords, dairyKeywords...)
		for _, ing := range r.Ingredients {
			name := strings.ToLower(ing.Name)
			for _, kw := range exclude {
				if strings.Contains(name, kw) {
					return false
				}
			}
		}
	case "high-protein":
		if r.Protein < 20 {
			return false
		}
	case "low-carb":
		if r.Carbs > 30 {
			return false
		}
	}
	return true
}

func toSet(items []string) map[string]bool {
	set := make(map[string]bool, len(items))
	for _, i := range items {
		set[strings.ToLower(strings.TrimSpace(i))] = true
	}
	return set
}

func round2(f float64) float64 {
	return float64(int(f*100+0.5)) / 100
}
