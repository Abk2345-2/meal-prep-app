package recipeprovider

import (
	"context"
	_ "embed"
	"encoding/json"
	"fmt"
	"strings"
)

//go:embed recipes.json
var recipesJSON []byte

// localRecipe mirrors the scraped JSON shape from mealdb-scraper.
// TimeMinutes is populated by enrich_time.go (Groq LLM); zero means use estimate.
type localRecipe struct {
	ID           string       `json:"id"`
	Title        string       `json:"title"`
	Category     string       `json:"category"`
	Area         string       `json:"area"`
	Instructions string       `json:"instructions"`
	Image        string       `json:"image"`
	Tags         []string     `json:"tags"`
	SourceURL    string       `json:"source_url"`
	YoutubeURL   string       `json:"youtube_url"`
	Ingredients  []Ingredient `json:"ingredients"`
	TimeMinutes  int          `json:"time_minutes"`
}

func (l localRecipe) toRecipe() Recipe {
	r := Recipe{
		ID:           l.ID,
		Title:        l.Title,
		Category:     l.Category,
		Area:         l.Area,
		Instructions: l.Instructions,
		Image:        l.Image,
		SourceURL:    l.SourceURL,
		YoutubeURL:   l.YoutubeURL,
		Ingredients:  l.Ingredients,
	}
	if l.TimeMinutes > 0 {
		r.TimeMinutes = l.TimeMinutes
	} else {
		r.TimeMinutes = estimateTime(r)
	}
	r.Calories, r.Protein, r.Carbs, r.Fat = estimateNutrition(r)
	return r
}

// LocalProvider serves recipes from the embedded recipes.json — zero network
// calls, zero quota, works offline.
type LocalProvider struct {
	byID  map[string]Recipe
	all   []Recipe
	// inverted index: normalised ingredient word → recipe IDs
	index map[string][]string
}

func NewLocalProvider() (*LocalProvider, error) {
	var raw []localRecipe
	if err := json.Unmarshal(recipesJSON, &raw); err != nil {
		return nil, fmt.Errorf("parse recipes.json: %w", err)
	}
	p := &LocalProvider{
		byID:  make(map[string]Recipe, len(raw)),
		all:   make([]Recipe, 0, len(raw)),
		index: make(map[string][]string),
	}
	for _, lr := range raw {
		r := lr.toRecipe()
		p.byID[r.ID] = r
		p.all = append(p.all, r)
		for _, ing := range r.Ingredients {
			for _, word := range tokenise(ing.Name) {
				p.index[word] = append(p.index[word], r.ID)
			}
		}
	}
	return p, nil
}

// SearchByIngredients finds recipes whose ingredient list overlaps with the
// given ingredients using the inverted index — no network call.
func (p *LocalProvider) SearchByIngredients(_ context.Context, ingredients []string) ([]Recipe, error) {
	hits := map[string]int{} // recipeID → matched word count
	for _, ing := range ingredients {
		for _, word := range tokenise(ing) {
			for _, id := range p.index[word] {
				hits[id]++
			}
		}
	}
	out := make([]Recipe, 0, len(hits))
	for id := range hits {
		if r, ok := p.byID[id]; ok {
			out = append(out, r)
		}
	}
	return out, nil
}

// All returns every recipe — used by the service Search method.
func (p *LocalProvider) All() []Recipe { return p.all }

// GetByID returns full recipe detail from the in-memory map — no network call.
func (p *LocalProvider) GetByID(_ context.Context, id string) (Recipe, error) {
	r, ok := p.byID[id]
	if !ok {
		return Recipe{}, fmt.Errorf("recipe %s not found", id)
	}
	return r, nil
}

// tokenise lowercases and splits on non-alpha chars, dropping short/stop words.
func tokenise(s string) []string {
	s = strings.ToLower(s)
	var words []string
	current := strings.Builder{}
	flush := func() {
		w := current.String()
		current.Reset()
		if len(w) > 2 && !stopWord(w) {
			words = append(words, w)
		}
	}
	for _, r := range s {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') {
			current.WriteRune(r)
		} else {
			flush()
		}
	}
	flush()
	return words
}

var stopWords = map[string]bool{
	"the": true, "and": true, "for": true, "with": true,
	"fresh": true, "dried": true, "large": true, "small": true,
	"cup": true, "cups": true, "tsp": true, "tbsp": true,
}

func stopWord(w string) bool { return stopWords[w] }
