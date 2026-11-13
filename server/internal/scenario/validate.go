package scenario

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"sort"
	"strings"

	"github.com/BintangDwitama/minovsky-maps/schema"
	"github.com/santhosh-tekuri/jsonschema/v6"
)

// Invalid is returned when a document fails validation. Messages are user-readable.
type Invalid struct {
	// Codes holds integrity rule codes, or "schema" for JSON Schema failures.
	Codes    []string
	Messages []string
}

func (e *Invalid) Error() string { return "invalid scenario: " + strings.Join(e.Messages, "; ") }

// Validator checks scenario documents. Safe for concurrent use.
type Validator struct {
	schema *jsonschema.Schema
}

// NewValidator compiles the embedded JSON Schema once.
func NewValidator() (*Validator, error) {
	doc, err := jsonschema.UnmarshalJSON(bytes.NewReader(schema.ScenarioV1))
	if err != nil {
		return nil, fmt.Errorf("parse scenario schema: %w", err)
	}
	c := jsonschema.NewCompiler()
	if err := c.AddResource(schema.ScenarioV1ID, doc); err != nil {
		return nil, fmt.Errorf("add scenario schema: %w", err)
	}
	s, err := c.Compile(schema.ScenarioV1ID)
	if err != nil {
		return nil, fmt.Errorf("compile scenario schema: %w", err)
	}
	return &Validator{schema: s}, nil
}

// Validate returns the schema version of a valid document, or an *Invalid error.
func (v *Validator) Validate(raw []byte) (int, error) {
	inst, err := jsonschema.UnmarshalJSON(bytes.NewReader(raw))
	if err != nil {
		return 0, &Invalid{Codes: []string{"schema"}, Messages: []string{"Not valid JSON."}}
	}
	if err := v.schema.Validate(inst); err != nil {
		var ve *jsonschema.ValidationError
		if errors.As(err, &ve) {
			return 0, &Invalid{Codes: []string{"schema"}, Messages: schemaMessages(ve)}
		}
		return 0, &Invalid{Codes: []string{"schema"}, Messages: []string{err.Error()}}
	}

	var doc Document
	if err := json.Unmarshal(raw, &doc); err != nil {
		return 0, &Invalid{Codes: []string{"schema"}, Messages: []string{err.Error()}}
	}
	if problems := CheckIntegrity(&doc); len(problems) > 0 {
		inv := &Invalid{}
		for _, p := range problems {
			inv.Codes = append(inv.Codes, p.Code)
			inv.Messages = append(inv.Messages, p.Message)
		}
		return 0, inv
	}
	return doc.SchemaVersion, nil
}

// schemaMessages flattens a validation error into "path: message" lines (deepest causes only),
// deduplicated and capped so a broken document doesn't produce a wall of text.
func schemaMessages(ve *jsonschema.ValidationError) []string {
	seen := map[string]bool{}
	var out []string
	var walk func(u jsonschema.OutputUnit)
	walk = func(u jsonschema.OutputUnit) {
		if len(u.Errors) == 0 && u.Error != nil {
			path := u.InstanceLocation
			if path == "" {
				path = "/"
			}
			msg := fmt.Sprintf("%s: %s", path, u.Error.String())
			if !seen[msg] {
				seen[msg] = true
				out = append(out, msg)
			}
		}
		for _, c := range u.Errors {
			walk(c)
		}
	}
	walk(*ve.BasicOutput())
	sort.Strings(out)
	if len(out) > 20 {
		out = append(out[:20], fmt.Sprintf("…and %d more", len(out)-20))
	}
	if len(out) == 0 {
		out = []string{ve.Error()}
	}
	return out
}
