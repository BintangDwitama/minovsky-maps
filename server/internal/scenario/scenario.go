// Package scenario validates scenario documents exactly like the web editor does:
// JSON Schema (schema/scenario.v1.schema.json) first, then the cross-field integrity rules
// that JSON Schema cannot express (mirroring web/src/domain/integrity.ts).
package scenario

// CurrentSchemaVersion is the only schemaVersion the server accepts. Older documents are
// migrated by the editor before they are published.
const CurrentSchemaVersion = 1

// Hex is an axial coordinate on the flat-top grid.
type Hex struct {
	Q int `json:"q"`
	R int `json:"r"`
}

// Document is the subset of a scenario the integrity rules need. It is decoded only after the
// JSON Schema check passed, so field types are already guaranteed.
type Document struct {
	SchemaVersion int `json:"schemaVersion"`
	Meta          struct {
		Name string `json:"name"`
	} `json:"meta"`
	Board struct {
		Hexes []struct {
			Hex
			Tags []string `json:"tags"`
		} `json:"hexes"`
	} `json:"board"`
	Elevation []struct {
		Hex
		Level int `json:"level"`
	} `json:"elevation"`
	Components []Component `json:"components"`
	Goals      []struct {
		ID string `json:"id"`
	} `json:"goals"`
}

// Component is one placed component.
type Component struct {
	ID     string  `json:"id"`
	Kind   string  `json:"kind"`
	Owner  string  `json:"owner"`
	Hex    Hex     `json:"hex"`
	Facing int     `json:"facing"`
	Label  *string `json:"label"`
}
