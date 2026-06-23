package recipeprovider

import (
	"context"
	"sort"
	"strings"
	"sync"
	"time"
)

type cacheEntry struct {
	recipes   []Recipe
	expiresAt time.Time
}

// CachedProvider wraps a Provider with an in-memory TTL cache.
// Identical ingredient sets share a cached result for ttl duration.
type CachedProvider struct {
	inner Provider
	ttl   time.Duration
	mu    sync.Mutex
	cache map[string]cacheEntry
	// byID caches GetByID results separately (longer TTL — recipes don't change).
	idMu    sync.Mutex
	idCache map[string]Recipe
}

func NewCachedProvider(inner Provider, ttl time.Duration) *CachedProvider {
	return &CachedProvider{
		inner:   inner,
		ttl:     ttl,
		cache:   make(map[string]cacheEntry),
		idCache: make(map[string]Recipe),
	}
}

func (c *CachedProvider) SearchByIngredients(ctx context.Context, ingredients []string) ([]Recipe, error) {
	key := ingredientKey(ingredients)

	c.mu.Lock()
	if e, ok := c.cache[key]; ok && time.Now().Before(e.expiresAt) {
		c.mu.Unlock()
		return e.recipes, nil
	}
	c.mu.Unlock()

	recipes, err := c.inner.SearchByIngredients(ctx, ingredients)
	if err != nil {
		return nil, err
	}

	c.mu.Lock()
	c.cache[key] = cacheEntry{recipes: recipes, expiresAt: time.Now().Add(c.ttl)}
	c.mu.Unlock()

	return recipes, nil
}

func (c *CachedProvider) GetByID(ctx context.Context, id string) (Recipe, error) {
	c.idMu.Lock()
	if r, ok := c.idCache[id]; ok {
		c.idMu.Unlock()
		return r, nil
	}
	c.idMu.Unlock()

	r, err := c.inner.GetByID(ctx, id)
	if err != nil {
		return Recipe{}, err
	}

	c.idMu.Lock()
	c.idCache[id] = r
	c.idMu.Unlock()

	return r, nil
}

// ingredientKey produces a stable cache key from an ingredient list.
func ingredientKey(ingredients []string) string {
	norm := make([]string, len(ingredients))
	for i, s := range ingredients {
		norm[i] = strings.ToLower(strings.TrimSpace(s))
	}
	sort.Strings(norm)
	return strings.Join(norm, ",")
}
