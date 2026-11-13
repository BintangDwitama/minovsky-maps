// Package schema embeds the scenario JSON Schema — the shared contract between the web editor
// and the server — together with its example documents and the conformance expectations
// both sides test against. The JSON files are the source of truth; this file only embeds them.
package schema

import "embed"

// ScenarioV1 is scenario.v1.schema.json (JSON Schema draft 2020-12).
//
//go:embed scenario.v1.schema.json
var ScenarioV1 []byte

// ScenarioV1ID is the $id of ScenarioV1.
const ScenarioV1ID = "https://minovsky-maps.dev/schema/scenario.v1.schema.json"

// Examples holds examples/ (valid documents) and examples/invalid/ (documents that must be rejected).
//
//go:embed examples
var Examples embed.FS

// Conformance is conformance.json: which examples are valid, and why each invalid one is rejected.
//
//go:embed conformance.json
var Conformance []byte
