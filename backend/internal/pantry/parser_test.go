package pantry

import (
	"testing"
	"time"
)

func TestParseLine(t *testing.T) {
	now := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	cases := []struct {
		in       string
		wantName string
		wantQty  float64
		wantUnit string
	}{
		{"2 lbs chicken", "Chicken", 2, "lb"},
		{"dozen eggs", "Eggs", 12, "unit"},
		{"500g rice", "Rice", 500, "g"},
		{"2 cups milk", "Milk", 2, "cup"},
		{"1 head broccoli", "Broccoli", 1, "head"},
		{"broccoli", "Broccoli", 1, "unit"},
	}
	for _, c := range cases {
		got := ParseLine(now, c.in)
		if got.Name != c.wantName {
			t.Errorf("%q: name=%q want %q", c.in, got.Name, c.wantName)
		}
		if got.Quantity != c.wantQty {
			t.Errorf("%q: qty=%v want %v", c.in, got.Quantity, c.wantQty)
		}
		if got.Unit != c.wantUnit {
			t.Errorf("%q: unit=%q want %q", c.in, got.Unit, c.wantUnit)
		}
	}
}

func TestParseText_MultiItem(t *testing.T) {
	now := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	items := ParseText(now, "2 lbs chicken, 1 head broccoli and 5 eggs")
	if len(items) != 3 {
		t.Fatalf("expected 3 items, got %d", len(items))
	}
	if items[2].Quantity != 5 || items[2].Name != "Eggs" {
		t.Errorf("third item wrong: %+v", items[2])
	}
}

func TestShelfLifeExpiry(t *testing.T) {
	now := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	chicken := ParseLine(now, "1 lb chicken")
	if chicken.ExpiresAt == nil {
		t.Fatal("chicken should have an expiry")
	}
	if chicken.ShelfLifeDays != 3 {
		t.Errorf("chicken shelf life = %d, want 3", chicken.ShelfLifeDays)
	}
}
