package scenario

import "encoding/json"

// Facets are the searchable facts about a scenario that Browse filters on. They are derived
// from a (valid) document on every save and stored next to it; never part of the document.
type Facets struct {
	Name        string
	Description string
	// Width and Height are set only when the board is a full width × height rectangle
	// (the same rule as the web's rectangleSize); otherwise both are 0.
	Width, Height int
	HexCount      int
	Deployment    string
	SquadSize     int
	HasElevation  bool
}

type facetDoc struct {
	Meta struct {
		Name        string `json:"name"`
		Description string `json:"description"`
	} `json:"meta"`
	Board struct {
		Hexes []struct{ Q, R int } `json:"hexes"`
	} `json:"board"`
	Elevation []struct {
		Level int `json:"level"`
	} `json:"elevation"`
	Rules struct {
		Deployment string `json:"deployment"`
		SquadSize  int    `json:"squadSize"`
	} `json:"rules"`
}

// ComputeFacets reads the facets of a scenario document.
func ComputeFacets(doc []byte) (Facets, error) {
	var d facetDoc
	if err := json.Unmarshal(doc, &d); err != nil {
		return Facets{}, err
	}
	f := Facets{
		Name:        d.Meta.Name,
		Description: d.Meta.Description,
		HexCount:    len(d.Board.Hexes),
		Deployment:  d.Rules.Deployment,
		SquadSize:   d.Rules.SquadSize,
	}
	for _, e := range d.Elevation {
		if e.Level > 0 {
			f.HasElevation = true
			break
		}
	}
	f.Width, f.Height = rectangle(d.Board.Hexes)
	return f, nil
}

// rectangle mirrors web/src/domain/scenario.ts rectangleSize: odd-q offset coordinates, origin
// at (0, 0), and every cell of the bounding box present.
func rectangle(hexes []struct{ Q, R int }) (int, int) {
	if len(hexes) == 0 {
		return 0, 0
	}
	maxCol, maxRow := -1, -1
	for _, h := range hexes {
		row := h.R + (h.Q-(h.Q&1))/2
		if h.Q < 0 || row < 0 {
			return 0, 0
		}
		maxCol = max(maxCol, h.Q)
		maxRow = max(maxRow, row)
	}
	w, ht := maxCol+1, maxRow+1
	if w*ht != len(hexes) {
		return 0, 0
	}
	return w, ht
}
