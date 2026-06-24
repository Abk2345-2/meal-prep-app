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
	"pkt": "pack", "packets": "pack", "sachet": "pack",
	"bottle": "bottle", "jar": "jar", "box": "box", "bag": "bag",
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

// categoryFor classifies an ingredient by comprehensive keyword matching.
// Order matters: more specific checks come before generic ones.
// Final categories shown as tabs: Meat, Dairy, Vegetable, Fruits, Spices, Grains, (Seafood/Pantry/Frozen hidden or merged)
func categoryFor(name string) string {
	n := strings.ToLower(name)
	switch {
	// ── Frozen (check first — "frozen peas" → frozen, not veggies) ─────────
	case containsAny(n, "frozen", "ice cream", "gelato", "sorbet"):
		return "frozen"

	// ── Spice blends / powders / masalas (before meat/seafood) ─────────────
	// "chicken masala", "fish masala", "meat masala" are spice blends, not meat.
	case strings.HasSuffix(n, "masala") ||
		strings.HasSuffix(n, "masala powder") ||
		strings.HasSuffix(n, "powder") ||
		strings.HasSuffix(n, "spice") ||
		strings.HasSuffix(n, "spice mix") ||
		strings.HasSuffix(n, "mix") ||
		strings.HasSuffix(n, "seasoning"):
		return "spices"

	// ── Meat ──────────────────────────────────────────────────────────────
	case containsAny(n,
		"chicken", "murgh", "kozhi",
		"beef", "boeuf",
		"pork", "ham", "bacon", "pancetta",
		"turkey", "duck", "goose", "quail",
		"lamb", "mutton", "goat", "gosht",
		"sausage", "salami", "pepperoni", "chorizo", "keema", "kheema",
		"mince", "minced", "ground meat",
		"veal", "bison", "venison",
	):
		return "meat"

	// ── Seafood ────────────────────────────────────────────────────────────
	case containsAny(n,
		"fish", "salmon", "tuna", "cod", "tilapia", "catfish", "hilsa", "rohu", "mackerel",
		"sardine", "herring", "anchovy", "trout", "halibut", "sea bass",
		"shrimp", "prawn", "lobster", "crab", "crayfish", "scallop", "oyster",
		"squid", "octopus", "clam", "mussel",
	):
		return "seafood"

	// ── Dairy ──────────────────────────────────────────────────────────────
	case containsAny(n,
		"milk", "skim milk", "whole milk",
		"cheese", "cheddar", "mozzarella", "parmesan", "ricotta", "feta",
		"yogurt", "yoghurt", "curd", "dahi",
		"butter", "ghee", "clarified butter",
		"cream", "heavy cream", "sour cream", "crème fraîche", "whipping cream",
		"paneer", "cottage cheese",
		"egg", "eggs", "anda",
		"whey", "condensed milk", "evaporated milk", "buttermilk", "lassi",
		"kefir",
	):
		return "dairy"

	// ── Fruits ─────────────────────────────────────────────────────────────
	case containsAny(n,
		"apple", "apples",
		"banana", "plantain",
		"mango", "aam",
		"orange", "clementine", "mandarin", "tangerine",
		"lemon", "lime", "nimbu",
		"grape", "raisin",
		"strawberry", "blueberry", "raspberry", "blackberry", "cranberry", "gooseberry",
		"papaya", "pawpaw",
		"pineapple", "ananas",
		"watermelon", "melon", "cantaloupe", "honeydew",
		"peach", "nectarine",
		"pear", "plum", "prune", "apricot", "cherry",
		"fig", "date", "khajur",
		"pomegranate", "anar",
		"guava", "amrood",
		"kiwi", "avocado", "passion fruit", "lychee", "jackfruit",
		"coconut", "tamarind", "imli",
		"dried fruit", "fruit",
	):
		return "fruits"

	// ── Spices & Herbs (before veggies — "coriander leaves" → spices) ──────
	case containsAny(n,
		// dry spices
		"cumin", "jeera",
		"turmeric", "haldi",
		"coriander powder", "dhania powder",
		"cardamom", "elaichi",
		"cinnamon", "dalchini",
		"clove", "laung",
		"black pepper", "white pepper", "peppercorn",
		"red chilli", "chili powder", "chilli powder", "cayenne", "paprika",
		"kashmiri chilli",
		"garam masala", "masala", "curry powder", "sambar powder", "rasam powder",
		"fenugreek", "methi seeds", "methi powder",
		"mustard seed", "rai", "sarson",
		"fennel seed", "saunf",
		"nigella", "kalonji",
		"ajwain", "carom",
		"asafoetida", "hing",
		"bay leaf", "tej patta",
		"star anise", "chakri phool",
		"nutmeg", "mace", "javitri",
		"saffron", "kesar",
		"oregano", "thyme", "rosemary", "marjoram", "sage",
		"basil", "mint", "pudina",
		"parsley", "dill", "tarragon",
		"coriander leaf", "coriander leaves", "fresh coriander", "cilantro",
		"curry leaf", "curry leaves", "kadipatta",
		"dried herb", "mixed herb", "herb",
		"chaat masala", "tandoori masala", "biryani masala",
		// pastes / fresh aromatics used as spice
		"ginger paste", "garlic paste", "ginger garlic paste",
		"green chilli", "dry red chilli",
		"pepper powder",
	):
		return "spices"

	// ── Vegetables ────────────────────────────────────────────────────────
	case containsAny(n,
		// alliums
		"onion", "pyaz", "shallot", "spring onion", "green onion", "scallion",
		"garlic", "lahsun", "ginger", "adrak",
		// leafy
		"spinach", "palak", "kale", "lettuce", "cabbage", "bok choy", "swiss chard",
		"methi leaf", "fenugreek leaf", "bathua",
		// brassicas
		"broccoli", "cauliflower", "gobi", "brussel sprout",
		// roots & tubers
		"potato", "aloo", "sweet potato", "shakarkandi", "yam", "suran",
		"carrot", "gajar", "beetroot", "beet", "turnip", "shalgam", "radish", "mooli",
		// pods & beans (fresh)
		"peas", "matar", "green beans", "french beans", "broad beans", "edamame",
		"cluster bean", "guar", "snake bean", "winged bean",
		// gourds
		"bottle gourd", "lauki", "dudhi",
		"bitter gourd", "karela", "pavakkai",
		"ridge gourd", "turai", "torai",
		"snake gourd", "tinda", "ash gourd",
		"pumpkin", "squash", "zucchini", "courgette",
		// nightshades & peppers
		"tomato", "tamatar", "cherry tomato",
		"eggplant", "brinjal", "baingan", "aubergine",
		"capsicum", "bell pepper",
		// others
		"cucumber", "kakdi",
		"celery", "leek", "artichoke", "asparagus", "okra", "bhindi", "lady finger",
		"corn", "maize", "sweet corn", "baby corn",
		"mushroom", "button mushroom", "portobello", "shiitake",
		"jackfruit", "raw jackfruit", "kathal",
		"breadfruit", "plantain flower",
		"lotus stem", "kamal kakdi",
		"drumstick", "moringa", "sahjan",
		"raw papaya", "raw banana",
		"colocasia", "arbi",
		"vegetable",
	):
		return "veggies"

	// ── Grains & Staples ──────────────────────────────────────────────────
	case containsAny(n,
		"rice", "basmati", "jasmine rice", "brown rice", "parboiled rice",
		"wheat", "atta", "whole wheat flour",
		"maida", "all purpose flour", "plain flour",
		"semolina", "suji", "rava",
		"cornflour", "corn starch", "besan", "chickpea flour", "gram flour",
		"ragi", "finger millet", "jowar", "bajra", "millet",
		"oats", "rolled oats", "oatmeal",
		"bread", "toast", "baguette", "pita", "naan", "roti", "chapati", "paratha",
		"pasta", "spaghetti", "penne", "fettuccine", "macaroni", "vermicelli", "semiya",
		"noodle", "egg noodle", "rice noodle",
		"cereal", "cornflakes", "muesli",
		"barley", "quinoa", "buckwheat", "amaranth",
		"poha", "flattened rice", "puffed rice", "murmura",
		"sabudana", "tapioca",
	):
		return "grain"

	// ── Pantry / Condiments / Pulses ─────────────────────────────────────
	case containsAny(n,
		// oils & fats
		"oil", "sunflower oil", "olive oil", "coconut oil", "mustard oil", "sesame oil",
		// sweeteners
		"sugar", "brown sugar", "jaggery", "gud", "honey", "maple syrup", "molasses",
		// salt & umami
		"salt", "rock salt", "black salt", "kala namak", "soy sauce", "fish sauce", "worcestershire",
		// acids
		"vinegar", "lemon juice",
		// pulses & legumes (dried)
		"dal", "lentil", "chana", "chickpea", "rajma", "kidney bean", "black bean",
		"moong", "masoor", "urad", "toor", "pigeon pea",
		"soybean", "peanut", "groundnut",
		// canned/preserved
		"canned", "tomato paste", "tomato puree", "tomato sauce",
		"coconut milk", "coconut cream",
		// nuts & seeds
		"cashew", "almond", "walnut", "pistachio", "pecan", "hazelnut",
		"sesame", "til", "poppy seed", "khus khus", "flax seed", "chia seed",
		"sunflower seed", "pumpkin seed",
		// dried fruit (not already caught by fruits)
		"dry fruit",
		// other condiments
		"sauce", "ketchup", "mayonnaise", "mustard", "hot sauce", "chutney",
		"jam", "pickle", "achar",
		"baking powder", "baking soda", "yeast", "gelatin", "agar",
		"cocoa", "chocolate", "vanilla",
		"water", "stock", "broth",
	):
		return "pantry"

	default:
		return "other"
	}
}

// isFrozen returns true when the name or unit suggests a frozen product.
func isFrozen(name, unit string) bool {
	return containsAny(strings.ToLower(name+unit), "frozen", "ice cream", "gelato", "sorbet")
}

func containsAny(s string, subs ...string) bool {
	for _, sub := range subs {
		if strings.Contains(s, sub) {
			return true
		}
	}
	return false
}

// qtyUnit matches a quantity+unit token that can appear anywhere in a phrase.
// Captures: (number)(unit) with optional space between, e.g. "2kg", "500 g", "1 pkt".
// Also matches standalone numbers like "2" or "500".
var qtyUnit = regexp.MustCompile(`(?i)\b([0-9]+(?:\.[0-9]+)?)\s*([a-z]+)?\b`)

// wordQty matches word-number tokens at the start only.
var wordQtyRe = regexp.MustCompile(`(?i)^(a|an|one|two|three|four|five|six|seven|eight|nine|ten|dozen|half|couple)\b`)

// extractQtyUnit scans the phrase for a number (optionally followed by a unit)
// and returns (qty, unit, phraseWithQtyRemoved).
// Handles both orders: "2kg chicken" and "chicken 2kg" and "chicken 2 kg".
func extractQtyUnit(raw string) (qty float64, unit, rest string) {
	qty = 1.0
	unit = "unit"

	// Try word-number at start first (e.g. "dozen eggs")
	if m := wordQtyRe.FindStringIndex(raw); m != nil {
		token := strings.ToLower(raw[m[0]:m[1]])
		if wn, ok := wordNumbers[token]; ok {
			qty = wn
			rest = strings.TrimSpace(raw[m[1]:])
			// See if the next word is a unit
			words := strings.Fields(rest)
			if len(words) > 0 {
				if u, ok := unitAliases[strings.ToLower(words[0])]; ok {
					unit = u
					rest = strings.TrimSpace(rest[len(words[0]):])
				}
			}
			return
		}
	}

	// Find a numeric token anywhere in the phrase (e.g. "chicken 2kg" or "2 kg chicken")
	m := qtyUnit.FindStringSubmatchIndex(raw)
	if m == nil {
		rest = raw
		return
	}

	// m[0]:m[1] = full match, m[2]:m[3] = number, m[4]:m[5] = optional unit word
	numStr := raw[m[2]:m[3]]
	n, err := strconv.ParseFloat(numStr, 64)
	if err != nil {
		rest = raw
		return
	}
	qty = n

	unitWord := ""
	if m[4] >= 0 {
		unitWord = strings.ToLower(raw[m[4]:m[5]])
	}

	if u, ok := unitAliases[unitWord]; ok {
		unit = u
		// Remove the full match (number + unit) from raw
		rest = strings.TrimSpace(raw[:m[0]] + raw[m[1]:])
	} else {
		// Unit word not recognised — keep it in the name, remove only the number
		rest = strings.TrimSpace(raw[:m[0]] + raw[m[3]:])
	}
	rest = strings.Join(strings.Fields(rest), " ") // collapse extra spaces
	return
}

// ParseLine turns a single phrase into a structured ParsedItem.
// Handles both "2kg chicken" and "chicken 2kg" and "1 pkt red chilli powder".
func ParseLine(now time.Time, line string) ParsedItem {
	raw := strings.TrimSpace(line)

	qty, unit, rest := extractQtyUnit(raw)

	name := strings.TrimSpace(rest)
	if name == "" {
		name = raw
	}
	name = titleCase(name)
	normalized := strings.ToLower(name)
	category := categoryFor(normalized)

	// Frozen items never expire — skip shelf-life calculation entirely.
	if category == "frozen" || isFrozen(normalized, unit) {
		return ParsedItem{
			RawText:        raw,
			Name:           name,
			NormalizedName: normalized,
			Quantity:       qty,
			Unit:           unit,
			Category:       "frozen",
			ShelfLifeDays:  0,
			// ExpiresAt intentionally nil — frozen = no expiry
		}
	}

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
