package scenario

import (
	"fmt"
	"strings"
)

// IntegrityError is a hard problem that makes a document invalid. Codes and messages match
// web/src/domain/integrity.ts; schema/conformance.json checks both sides agree.
type IntegrityError struct {
	Code    string
	Message string
}

// kindDef mirrors the per-kind rules of the web component registry
// (web/src/domain/components/registry.ts) that integrity depends on.
type kindDef struct {
	label         string
	allowedOwners []string
	requiresLabel bool
	multiHex      bool // carrier: three hexes in a line
}

var (
	sides   = []string{"A", "B"}
	neutral = []string{"neutral"}
	anyone  = []string{"A", "B", "neutral"}
)

var kinds = map[string]kindDef{
	"base":      {label: "Base", allowedOwners: sides},
	"carrier":   {label: "Carrier", allowedOwners: sides, multiHex: true},
	"garrison":  {label: "Garrison", allowedOwners: sides},
	"upgrade":   {label: "Upgrade", allowedOwners: neutral},
	"energy":    {label: "Energy", allowedOwners: neutral},
	"objective": {label: "Objective", allowedOwners: neutral},
	"token":     {label: "Scenario token", allowedOwners: anyone, requiresLabel: true},
	"structure": {label: "Structure", allowedOwners: anyone, requiresLabel: true},
}

// directions: flat-top, 0 = N then clockwise (same table as web/src/domain/hex.ts).
var directions = [6]Hex{{0, -1}, {1, -1}, {1, 0}, {0, 1}, {-1, 1}, {-1, 0}}

func toDirection(facing int) int { return ((facing % 6) + 6) % 6 }

func add(a, b Hex) Hex { return Hex{a.Q + b.Q, a.R + b.R} }

// footprint returns the hexes a component occupies.
func footprint(c Component, def kindDef) []Hex {
	if !def.multiHex {
		return []Hex{c.Hex}
	}
	d := toDirection(c.Facing)
	front := add(c.Hex, directions[d])
	back := add(c.Hex, directions[(d+3)%6])
	return []Hex{front, c.Hex, back}
}

// fmtHex prints a hex in odd-q offset coordinates, "(col, row)", as the editor shows them.
func fmtHex(h Hex) string {
	row := h.R + (h.Q-(h.Q&1))/2
	return fmt.Sprintf("(%d, %d)", h.Q, row)
}

// CheckIntegrity applies the cross-field rules. The document must already be schema-valid.
func CheckIntegrity(doc *Document) []IntegrityError {
	var errs []IntegrityError
	add := func(code, format string, a ...any) {
		errs = append(errs, IntegrityError{Code: code, Message: fmt.Sprintf(format, a...)})
	}

	board := map[Hex]bool{}
	for _, h := range doc.Board.Hexes {
		if board[h.Hex] {
			add("duplicate-hex", "Board lists hex %s more than once.", fmtHex(h.Hex))
		}
		board[h.Hex] = true
	}

	elevSeen := map[Hex]bool{}
	for _, e := range doc.Elevation {
		if !board[e.Hex] {
			add("elevation-off-board", "Elevation set on hex %s, which is not on the board.", fmtHex(e.Hex))
		}
		if elevSeen[e.Hex] {
			add("duplicate-elevation", "Elevation listed twice for hex %s.", fmtHex(e.Hex))
		}
		elevSeen[e.Hex] = true
	}

	ids := map[string]bool{}
	for _, c := range doc.Components {
		def, ok := kinds[c.Kind]
		if !ok { // impossible after schema validation; keep the server safe anyway
			add("unknown-kind", "Component %q has unknown kind %q.", c.ID, c.Kind)
			continue
		}
		if ids[c.ID] {
			add("duplicate-component-id", "Component id %q is used more than once.", c.ID)
		}
		ids[c.ID] = true

		var off []string
		for _, h := range footprint(c, def) {
			if !board[h] {
				off = append(off, fmtHex(h))
			}
		}
		if len(off) > 0 {
			verb := "are"
			if len(off) == 1 {
				verb = "is"
			}
			add("component-off-board", "%s %q occupies %s, which %s not on the board.",
				def.label, c.ID, strings.Join(off, ", "), verb)
		}

		if !contains(def.allowedOwners, c.Owner) {
			add("owner-not-allowed", "%s %q cannot be owned by %q (allowed: %s).",
				def.label, c.ID, c.Owner, strings.Join(def.allowedOwners, ", "))
		}

		if def.requiresLabel && (c.Label == nil || strings.TrimSpace(*c.Label) == "") {
			add("label-required", "%s %q needs a label.", def.label, c.ID)
		}
	}

	goalIDs := map[string]bool{}
	for _, g := range doc.Goals {
		if goalIDs[g.ID] {
			add("duplicate-goal-id", "Goal id %q is used more than once.", g.ID)
		}
		goalIDs[g.ID] = true
	}
	return errs
}

func contains(list []string, s string) bool {
	for _, v := range list {
		if v == s {
			return true
		}
	}
	return false
}
