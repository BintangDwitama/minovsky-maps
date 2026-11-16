package httpapi

import (
	"errors"
	"net/http"

	"github.com/BintangDwitama/minovsky-maps/server/internal/publishing"
)

// setVisibility: PATCH /api/scenarios/{id} {"visibility": "private"|"link"|"public"}; owner only.
func (a *api) setVisibility(w http.ResponseWriter, r *http.Request) {
	acc, ok := a.requireAccount(w, r)
	if !ok {
		return
	}
	var body struct {
		Visibility string `json:"visibility"`
	}
	if !decodeJSON(w, r, &body, `Request body must be JSON: {"visibility": …}.`) {
		return
	}
	v := publishing.Visibility(body.Visibility)
	if err := a.svc.SetVisibility(r.Context(), r.PathValue("id"), acc.ID, v); err != nil {
		a.fail(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"id": r.PathValue("id"), "visibility": v})
}

// browse: GET /api/browse — public scenarios only, never emails or account ids.
func (a *api) browse(w http.ResponseWriter, r *http.Request) {
	p := r.URL.Query()
	q, err := publishing.ParseBrowse(publishing.BrowseParams{
		Q: p.Get("q"), Size: p.Get("size"), Deployment: p.Get("deployment"), Squad: p.Get("squad"),
		Elevation: p.Get("elevation"), Sort: p.Get("sort"), Cursor: p.Get("cursor"),
	})
	var inv *publishing.InvalidQuery
	if errors.As(err, &inv) {
		writeErrors(w, http.StatusBadRequest, "Invalid "+inv.Param+": "+inv.Message+".")
		return
	}
	page, err := a.svc.Browse(r.Context(), q)
	if err != nil {
		a.fail(w, err)
		return
	}
	items := make([]map[string]any, 0, len(page.Items))
	for _, it := range page.Items {
		items = append(items, map[string]any{
			"id":           it.ID,
			"name":         it.Name,
			"ownerName":    it.OwnerName,
			"width":        it.Width,
			"height":       it.Height,
			"hexCount":     it.HexCount,
			"deployment":   it.Deployment,
			"squadSize":    it.SquadSize,
			"hasElevation": it.HasElevation,
			"listedAt":     it.ListedAt.UTC(),
			"updatedAt":    it.UpdatedAt.UTC(),
			"scenario":     it.Doc,
		})
	}
	var next any
	if page.Next != "" {
		next = page.Next
	}
	w.Header().Set("Cache-Control", "no-store") // visibility changes must show at once
	writeJSON(w, http.StatusOK, map[string]any{"items": items, "next": next})
}
