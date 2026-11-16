package scenario_test

import (
	"encoding/json"
	"fmt"
	"io/fs"
	"testing"

	"github.com/BintangDwitama/minovsky-maps/schema"
	"github.com/BintangDwitama/minovsky-maps/server/internal/scenario"
)

func TestFacetsOfTheSample(t *testing.T) {
	doc, err := fs.ReadFile(schema.Examples, "examples/sample-mesa.scenario.json")
	if err != nil {
		t.Fatal(err)
	}
	f, err := scenario.ComputeFacets(doc)
	if err != nil {
		t.Fatal(err)
	}
	if f.Name != "Sample: Desert Mesa" || f.Width != 15 || f.Height != 15 || f.HexCount != 225 ||
		f.Deployment != "bases" || f.SquadSize != 3 || !f.HasElevation || f.Description == "" {
		t.Fatalf("facets %+v", f)
	}
}

// board builds an odd-q rectangle (same layout as the web's rectangleHexes), optionally
// dropping one cell or adding an off-origin one.
func board(w, h int, drop bool, extra *[2]int) []byte {
	type hex struct{ Q, R int }
	var hexes []hex
	for col := 0; col < w; col++ {
		for row := 0; row < h; row++ {
			if drop && col == 1 && row == 1 {
				continue
			}
			hexes = append(hexes, hex{col, row - (col-(col&1))/2})
		}
	}
	if extra != nil {
		hexes = append(hexes, hex{extra[0], extra[1]})
	}
	b, _ := json.Marshal(map[string]any{
		"meta":  map[string]string{"name": "x"},
		"board": map[string]any{"hexes": hexes},
		"rules": map[string]any{"deployment": "carriers", "squadSize": 4},
	})
	return b
}

func TestRectangleRuleMatchesTheWeb(t *testing.T) {
	cases := []struct {
		doc       []byte
		w, h, cnt int
	}{
		{board(15, 15, false, nil), 15, 15, 225},
		{board(12, 18, false, nil), 12, 18, 216},
		{board(5, 4, true, nil), 0, 0, 19},             // a hole: not a rectangle
		{board(3, 3, false, &[2]int{-1, 0}), 0, 0, 10}, // a negative column: not a rectangle
	}
	for i, c := range cases {
		t.Run(fmt.Sprint(i), func(t *testing.T) {
			f, err := scenario.ComputeFacets(c.doc)
			if err != nil {
				t.Fatal(err)
			}
			if f.Width != c.w || f.Height != c.h || f.HexCount != c.cnt || f.Deployment != "carriers" || f.SquadSize != 4 || f.HasElevation {
				t.Fatalf("got %+v", f)
			}
		})
	}
}
