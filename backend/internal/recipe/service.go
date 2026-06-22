// Package recipe implements time-aware, ingredient-matched recipe suggestions on
// top of a swappable recipeprovider.Provider.
package recipe

import (
	"context"
	"sort"
	"strings"

	"github.com/pantrytoplate/backend/internal/recipeprovider"
)

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
	MaxTime     int      // minutes; 0 = no limit
	MinMatch    float64  // minimum match score, default 0.3
	Limit       int      // max results, default 8
}

// Suggest fetches candidate recipes (seeded by the user's ingredients), scores
// each by ingredient overlap, filters by cook time + min match, and returns the
// top N. Mirrors the spec's suggest_recipes pseudocode.
func (s *Service) Suggest(ctx context.Context, p SuggestParams) ([]Suggestion, error) {
	if p.MinMatch == 0 {
		p.MinMatch = 0.3
	}
	if p.Limit == 0 {
		p.Limit = 8
	}

	// 1. Gather candidates: search the provider per available ingredient and dedupe.
	seen := map[string]bool{}
	candidates := make([]recipeprovider.Recipe, 0)
	for _, ing := range p.Ingredients {
		key := firstWord(ing)
		if key == "" {
			continue
		}
		found, err := s.provider.SearchByIngredient(ctx, key)
		if err != nil {
			continue // skip a failing ingredient rather than failing the whole request
		}
		for _, r := range found {
			if !seen[r.ID] {
				seen[r.ID] = true
				candidates = append(candidates, r)
			}
		}
	}

	// 2. Hydrate + score each candidate.
	owned := toSet(p.Ingredients)
	suggestions := make([]Suggestion, 0, len(candidates))
	for _, c := range candidates {
		full, err := s.provider.GetByID(ctx, c.ID)
		if err != nil {
			continue
		}
		if p.MaxTime > 0 && full.TimeMinutes > p.MaxTime {
			continue
		}
		sg := score(full, owned)
		if sg.MatchScore >= p.MinMatch {
			suggestions = append(suggestions, sg)
		}
	}

	// 3. Sort by best match, then quickest.
	sort.Slice(suggestions, func(i, j int) bool {
		if suggestions[i].MatchScore != suggestions[j].MatchScore {
			return suggestions[i].MatchScore > suggestions[j].MatchScore
		}
		return suggestions[i].TimeMinutes < suggestions[j].TimeMinutes
	})

	if len(suggestions) > p.Limit {
		suggestions = suggestions[:p.Limit]
	}
	return suggestions, nil
}

// GetByID returns full recipe detail.
func (s *Service) GetByID(ctx context.Context, id string) (recipeprovider.Recipe, error) {
	return s.provider.GetByID(ctx, id)
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

func toSet(items []string) map[string]bool {
	set := make(map[string]bool, len(items))
	for _, i := range items {
		set[strings.ToLower(strings.TrimSpace(i))] = true
	}
	return set
}

func firstWord(s string) string {
	fields := strings.Fields(strings.ToLower(s))
	if len(fields) == 0 {
		return ""
	}
	return fields[0]
}

func round2(f float64) float64 {
	return float64(int(f*100+0.5)) / 100
}
