package recipeprovider

import (
	"context"
	"log"
	"strings"
)

// FallbackProvider tries primary first; on quota/auth errors (402, 401, 429)
// it transparently falls back to secondary.
type FallbackProvider struct {
	primary   Provider
	secondary Provider
}

func NewFallbackProvider(primary, secondary Provider) *FallbackProvider {
	return &FallbackProvider{primary: primary, secondary: secondary}
}

func (f *FallbackProvider) SearchByIngredients(ctx context.Context, ingredients []string) ([]Recipe, error) {
	results, err := f.primary.SearchByIngredients(ctx, ingredients)
	if err != nil && isQuotaError(err) {
		log.Printf("primary provider quota error, falling back: %v", err)
		return f.secondary.SearchByIngredients(ctx, ingredients)
	}
	return results, err
}

func (f *FallbackProvider) GetByID(ctx context.Context, id string) (Recipe, error) {
	r, err := f.primary.GetByID(ctx, id)
	if err != nil && isQuotaError(err) {
		return f.secondary.GetByID(ctx, id)
	}
	return r, err
}

func isQuotaError(err error) bool {
	msg := err.Error()
	return strings.Contains(msg, "402") ||
		strings.Contains(msg, "401") ||
		strings.Contains(msg, "429")
}
