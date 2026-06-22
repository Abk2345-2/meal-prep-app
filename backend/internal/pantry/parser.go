package pantry

import (
	"regexp"
	"strconv"
	"strings"
	"time"
)

// ParsedItem is the structured result of interpreting one free-text grocery
// phrase such as "2 lbs chicken" or "dozen eggs".
type ParsedItem struct {
	RawText        string   `json:"raw_text"`
	Name           string   `json:"name"`
	NormalizedName string   `json:"normalized_name"`
	Quantity       float64  `json:"quantity"`
	Unit           string   `json:"unit"`
	Category       string   `json:"category"`
	ShelfLifeDays  int      `json:"shelf_life_days"` // 0 = unknown
	ExpiresAt      *string  `json:"expires_at,omitempty"`
}

// wordNumbers maps spoken quantities to numeric values.
var wordNumbers = map[string]float64{
	"a": 1, "an": 1, "one": 1, "two": 2, "three": 3, "four": 4, "five": 5,
	"six": 6, "seven": 7, "eight": 8, "nine": 9, "ten": 10, "dozen": 12,
	"half": 0.5, "couple": 2,
}

// unitAliases normalizes the many ways people say a unit.
var unitAliases = map[string]string{
	"lb": "lb", "lbs": "lb", "pound": "lb", "pounds": "lb",
	"kg": "kg", "kgs": "kg", "kilogram": "kg", "kilograms": "kg",
	"g": "g", "gram": "g", "grams": "g",
	"oz": "oz", "ounce": "oz", "ounces": "oz",
	"cup": "cup", "cups": "cup",
	"tbsp": "tbsp", "tablespoon": "tbsp", "tablespoons": "tbsp",
	"tsp": "tsp", "teaspoon": "tsp", "teaspoons": "tsp",
	"l": "l", "liter": "l", "liters": "l", "litre": "l", "litres": "l",
	"ml": "ml", "milliliter": "ml", "milliliters": "ml",
	"head": "head", "heads": "head",
	"clove": "clove", "cloves": "clove",
	"can": "can", "cans": "can",
	"pack": "pack", "packs": "pack", "packet": "pack",
	"bunch": "bunch", "bunches": "bunch",
	"piece": "unit", "pieces": "unit", "unit": "unit", "units": "unit",
}

// shelfLife maps a normalized ingredient name to its typical fridge/pantry life
// in days, used to auto-suggest an expiry date. Falls back to a category default.
var shelfLife = map[string]int{
	"chicken": 3, "beef": 4, "pork": 4, "fish": 2, "salmon": 2, "shrimp": 2,
	"milk": 7, "yogurt": 14, "cheese": 21, "eggs": 28, "egg": 28, "butter": 30,
	"broccoli": 5, "spinach": 5, "lettuce": 6, "tomato": 6, "tomatoes": 6,
	"carrot": 21, "carrots": 21, "onion": 30, "onions": 30, "potato": 30, "potatoes": 30,
	"apple": 21, "apples": 21, "banana": 5, "bananas": 5,
	"rice": 365, "pasta": 365, "flour": 240, "bread": 5, "sugar": 365,
}

// categoryShelfLife is the fallback shelf life when the item is unknown.
var categoryShelfLife = map[string]int{
	"meat": 3, "seafood": 2, "dairy": 7, "produce": 6,
	"grain": 300, "pantry": 180, "other": 14,
}

// categoryFor classifies an ingredient by simple keyword matching.
func categoryFor(name string) string {
	switch {
	case containsAny(name, "chicken", "beef", "pork", "turkey", "lamb", "bacon", "sausage"):
		return "meat"
	case containsAny(name, "fish", "salmon", "tuna", "shrimp", "prawn", "cod"):
		return "seafood"
	case containsAny(name, "milk", "cheese", "yogurt", "butter", "cream", "egg"):
		return "dairy"
	case containsAny(name, "broccoli", "spinach", "lettuce", "tomato", "carrot", "onion",
		"potato", "pepper", "cucumber", "apple", "banana", "lemon", "garlic", "celery"):
		return "produce"
	case containsAny(name, "rice", "pasta", "bread", "flour", "oats", "cereal", "noodle"):
		return "grain"
	case containsAny(name, "oil", "sugar", "salt", "sauce", "spice", "can", "bean"):
		return "pantry"
	default:
		return "other"
	}
}

func containsAny(s string, subs ...string) bool {
	for _, sub := range subs {
		if strings.Contains(s, sub) {
			return true
		}
	}
	return false
}

// leadingQty pulls a numeric or word quantity (optionally with a unit) off the
// front of a phrase, e.g. "2 lbs", "500g", "dozen", "2 cups".
var leadingQty = regexp.MustCompile(`(?i)^\s*([0-9]+(?:\.[0-9]+)?|[a-z]+)\s*([a-z]+)?\b`)

// ParseLine turns a single phrase into a structured ParsedItem.
func ParseLine(now time.Time, line string) ParsedItem {
	raw := strings.TrimSpace(line)
	rest := raw
	qty := 1.0
	unit := "unit"

	if m := leadingQty.FindStringSubmatch(rest); m != nil {
		token := strings.ToLower(m[1])
		matchedQty := false

		// Numeric quantity, e.g. "2" or "500".
		if n, err := strconv.ParseFloat(token, 64); err == nil {
			qty = n
			matchedQty = true
		} else if wn, ok := wordNumbers[token]; ok {
			qty = wn
			matchedQty = true
		}

		if matchedQty {
			// Always consume the quantity token. Only consume the following word
			// if it is actually a unit — otherwise it is the ingredient name
			// (e.g. "dozen eggs", "5 eggs").
			consumed := m[1]
			if m[2] != "" {
				if u, ok := unitAliases[strings.ToLower(m[2])]; ok {
					unit = u
					consumed = m[1] + rest[len(m[1]):strings.Index(rest, m[2])+len(m[2])]
				}
			}
			rest = strings.TrimSpace(rest[len(consumed):])
		}
	}

	name := strings.TrimSpace(rest)
	if name == "" {
		name = raw
	}
	name = titleCase(name)
	normalized := strings.ToLower(name)
	category := categoryFor(normalized)

	days := shelfLife[normalized]
	if days == 0 {
		// try first word, e.g. "chicken breast" -> "chicken"
		if first := firstWord(normalized); first != "" {
			days = shelfLife[first]
		}
	}
	if days == 0 {
		days = categoryShelfLife[category]
	}

	item := ParsedItem{
		RawText:        raw,
		Name:           name,
		NormalizedName: normalized,
		Quantity:       qty,
		Unit:           unit,
		Category:       category,
		ShelfLifeDays:  days,
	}
	if days > 0 {
		exp := now.AddDate(0, 0, days).Format(time.RFC3339)
		item.ExpiresAt = &exp
	}
	return item
}

// ParseText splits a multi-item phrase on commas / "and" and parses each part.
func ParseText(now time.Time, text string) []ParsedItem {
	splitter := regexp.MustCompile(`(?i)\s*(?:,|;|\band\b|\bplus\b)\s*`)
	parts := splitter.Split(text, -1)
	items := make([]ParsedItem, 0, len(parts))
	for _, p := range parts {
		if strings.TrimSpace(p) == "" {
			continue
		}
		items = append(items, ParseLine(now, p))
	}
	return items
}

func firstWord(s string) string {
	fields := strings.Fields(s)
	if len(fields) == 0 {
		return ""
	}
	return fields[0]
}

func titleCase(s string) string {
	fields := strings.Fields(strings.ToLower(s))
	for i, f := range fields {
		if len(f) > 0 {
			fields[i] = strings.ToUpper(f[:1]) + f[1:]
		}
	}
	return strings.Join(fields, " ")
}
