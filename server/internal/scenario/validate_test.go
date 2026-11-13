package scenario

import (
	"encoding/json"
	"errors"
	"io/fs"
	"path"
	"slices"
	"strings"
	"testing"

	"github.com/BintangDwitama/minovsky-maps/schema"
)

type conformance struct {
	Valid   []string `json:"valid"`
	Invalid map[string]struct {
		RejectedBy string `json:"rejectedBy"`
	} `json:"invalid"`
}

func loadConformance(t *testing.T) conformance {
	t.Helper()
	var c conformance
	if err := json.Unmarshal(schema.Conformance, &c); err != nil {
		t.Fatalf("conformance.json: %v", err)
	}
	return c
}

func jsonFiles(t *testing.T, dir string) []string {
	t.Helper()
	entries, err := fs.ReadDir(schema.Examples, dir)
	if err != nil {
		t.Fatal(err)
	}
	var names []string
	for _, e := range entries {
		if !e.IsDir() && strings.HasSuffix(e.Name(), ".json") {
			names = append(names, e.Name())
		}
	}
	return names
}

func newValidator(t *testing.T) *Validator {
	t.Helper()
	v, err := NewValidator()
	if err != nil {
		t.Fatal(err)
	}
	return v
}

// Every example is listed in conformance.json, so new fixtures can't be forgotten by either side.
func TestConformanceListsEveryExample(t *testing.T) {
	c := loadConformance(t)
	for _, name := range jsonFiles(t, "examples") {
		if !slices.Contains(c.Valid, name) {
			t.Errorf("examples/%s is not listed under \"valid\" in conformance.json", name)
		}
	}
	for _, name := range jsonFiles(t, "examples/invalid") {
		if _, ok := c.Invalid[name]; !ok {
			t.Errorf("examples/invalid/%s is not listed under \"invalid\" in conformance.json", name)
		}
	}
}

func TestConformanceValidExamples(t *testing.T) {
	v := newValidator(t)
	for _, name := range loadConformance(t).Valid {
		t.Run(name, func(t *testing.T) {
			raw, err := fs.ReadFile(schema.Examples, path.Join("examples", name))
			if err != nil {
				t.Fatal(err)
			}
			if _, err := v.Validate(raw); err != nil {
				t.Fatalf("expected valid, got %v", err)
			}
		})
	}
}

func TestConformanceInvalidExamples(t *testing.T) {
	v := newValidator(t)
	for name, want := range loadConformance(t).Invalid {
		t.Run(name, func(t *testing.T) {
			raw, err := fs.ReadFile(schema.Examples, path.Join("examples/invalid", name))
			if err != nil {
				t.Fatal(err)
			}
			_, err = v.Validate(raw)
			var inv *Invalid
			if !errors.As(err, &inv) {
				t.Fatalf("expected rejection (%s), got %v", want.RejectedBy, err)
			}
			if !slices.Contains(inv.Codes, want.RejectedBy) {
				t.Fatalf("expected code %q, got %v (%v)", want.RejectedBy, inv.Codes, inv.Messages)
			}
		})
	}
}

func TestMessagesMatchTheEditor(t *testing.T) {
	v := newValidator(t)
	raw, _ := fs.ReadFile(schema.Examples, "examples/invalid/off-board-carrier.json")
	_, err := v.Validate(raw)
	var inv *Invalid
	if !errors.As(err, &inv) {
		t.Fatal(err)
	}
	// same wording as web/src/domain/integrity.ts ("Carrier "c" occupies … not on the board.")
	if !strings.Contains(inv.Messages[0], `Carrier "c" occupies`) || !strings.HasSuffix(inv.Messages[0], "not on the board.") {
		t.Fatalf("unexpected message %q", inv.Messages[0])
	}
}

func TestSchemaMessagesAreReadable(t *testing.T) {
	v := newValidator(t)
	_, err := v.Validate([]byte(`{"schemaVersion":1}`))
	var inv *Invalid
	if !errors.As(err, &inv) {
		t.Fatal(err)
	}
	if len(inv.Messages) == 0 || !strings.Contains(strings.Join(inv.Messages, "\n"), "missing") {
		t.Fatalf("unexpected messages %v", inv.Messages)
	}
}

func TestIntegrityRules(t *testing.T) {
	label := "x"
	empty := " "
	doc := &Document{}
	for _, h := range []Hex{{0, 0}, {1, 0}, {0, 1}, {0, 0}} {
		doc.Board.Hexes = append(doc.Board.Hexes, struct {
			Hex
			Tags []string `json:"tags"`
		}{Hex: h})
	}
	doc.Elevation = append(doc.Elevation,
		struct {
			Hex
			Level int `json:"level"`
		}{Hex{5, 5}, 1},
		struct {
			Hex
			Level int `json:"level"`
		}{Hex{0, 1}, 1},
		struct {
			Hex
			Level int `json:"level"`
		}{Hex{0, 1}, 2},
	)
	doc.Components = []Component{
		{ID: "a", Kind: "base", Owner: "neutral", Hex: Hex{0, 0}},
		{ID: "a", Kind: "token", Owner: "A", Hex: Hex{1, 0}, Label: &empty},
		{ID: "c", Kind: "carrier", Owner: "A", Hex: Hex{0, 0}, Facing: 0},
		{ID: "d", Kind: "structure", Owner: "B", Hex: Hex{0, 1}, Label: &label},
	}
	doc.Goals = []struct {
		ID string `json:"id"`
	}{{"g"}, {"g"}}

	var codes []string
	for _, e := range CheckIntegrity(doc) {
		codes = append(codes, e.Code)
	}
	for _, want := range []string{
		"duplicate-hex", "elevation-off-board", "duplicate-elevation", "owner-not-allowed",
		"duplicate-component-id", "label-required", "component-off-board", "duplicate-goal-id",
	} {
		if !slices.Contains(codes, want) {
			t.Errorf("missing %s in %v", want, codes)
		}
	}
	if slices.Contains(codes, "unknown-kind") {
		t.Errorf("unexpected unknown-kind")
	}
}

func TestCarrierFootprintFollowsFacing(t *testing.T) {
	// middle (2,2) facing SE (2): front (3,2), back (1,2)
	got := footprint(Component{Kind: "carrier", Hex: Hex{2, 2}, Facing: 2}, kinds["carrier"])
	want := []Hex{{3, 2}, {2, 2}, {1, 2}}
	if !slices.Equal(got, want) {
		t.Fatalf("got %v want %v", got, want)
	}
	// facing wraps like toDirection in the editor
	if toDirection(-1) != 5 || toDirection(7) != 1 {
		t.Fatal("toDirection does not wrap")
	}
}

func TestOffsetFormatting(t *testing.T) {
	// odd-q: col 3, row 7 is axial (3, 6); col -1 row 0 is axial (-1, 1)
	if got := fmtHex(Hex{3, 6}); got != "(3, 7)" {
		t.Fatalf("got %s", got)
	}
	if got := fmtHex(Hex{-1, 1}); got != "(-1, 0)" {
		t.Fatalf("got %s", got)
	}
}
