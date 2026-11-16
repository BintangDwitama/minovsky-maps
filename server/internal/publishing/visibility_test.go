package publishing_test

import (
	"context"
	"errors"
	"fmt"
	"testing"
	"time"

	"github.com/BintangDwitama/minovsky-maps/server/internal/publishing"
	"github.com/BintangDwitama/minovsky-maps/server/internal/scenario"
	"github.com/BintangDwitama/minovsky-maps/server/internal/store/memory"
)

func TestNewSavesArePrivateByDefault(t *testing.T) {
	ctx := context.Background()
	svc, _ := setup(t)
	c, err := svc.Publish(ctx, alice, "", example(t, "minimal.scenario.json"))
	if err != nil || c.Visibility != publishing.Private {
		t.Fatalf("publish: %+v %v", c, err)
	}
	if _, err := svc.Publish(ctx, alice, "secret", example(t, "minimal.scenario.json")); !errors.Is(err, publishing.ErrInvalidVisibility) {
		t.Fatalf("bad visibility: %v", err)
	}
}

func TestPrivateIsHiddenFromEveryoneButTheOwner(t *testing.T) {
	ctx := context.Background()
	svc, _ := setup(t)
	doc := example(t, "minimal.scenario.json")
	c, _ := svc.Publish(ctx, alice, publishing.Private, doc)

	if p, err := svc.Get(ctx, c.ID, alice); err != nil || p.Visibility != publishing.Private {
		t.Fatalf("owner read: %v", err)
	}
	for _, viewer := range []int64{0, bob} {
		if _, err := svc.Get(ctx, c.ID, viewer); !errors.Is(err, publishing.ErrNotFound) {
			t.Errorf("viewer %d read: %v", viewer, err)
		}
		if _, err := svc.Update(ctx, c.ID, publishing.Credential{OwnerID: viewer}, doc); !errors.Is(err, publishing.ErrNotFound) {
			t.Errorf("viewer %d update: %v", viewer, err)
		}
		if err := svc.Delete(ctx, c.ID, viewer); viewer != 0 && !errors.Is(err, publishing.ErrNotFound) {
			t.Errorf("viewer %d delete: %v", viewer, err)
		}
		if err := svc.SetVisibility(ctx, c.ID, viewer, publishing.Public); viewer != 0 && !errors.Is(err, publishing.ErrNotFound) {
			t.Errorf("viewer %d set visibility: %v", viewer, err)
		}
	}
	// the owner can share it later, with the same id
	if err := svc.SetVisibility(ctx, c.ID, alice, publishing.Link); err != nil {
		t.Fatal(err)
	}
	if _, err := svc.Get(ctx, c.ID, 0); err != nil {
		t.Fatalf("after sharing: %v", err)
	}
	if err := svc.SetVisibility(ctx, c.ID, bob, publishing.Private); !errors.Is(err, publishing.ErrNotOwner) {
		t.Fatalf("someone else changing it: %v", err)
	}
	if err := svc.SetVisibility(ctx, c.ID, alice, "nope"); !errors.Is(err, publishing.ErrInvalidVisibility) {
		t.Fatalf("invalid: %v", err)
	}
	if err := svc.SetVisibility(ctx, c.ID, 0, publishing.Public); !errors.Is(err, publishing.ErrSignedOut) {
		t.Fatalf("signed out: %v", err)
	}
}

func TestUpdateKeepsVisibilityAndClaimsStayLink(t *testing.T) {
	ctx := context.Background()
	svc, store := setup(t)
	doc := example(t, "minimal.scenario.json")
	c, _ := svc.Publish(ctx, alice, publishing.Public, doc)
	_, _ = svc.Update(ctx, c.ID, publishing.Credential{OwnerID: alice}, doc)
	if p, _ := svc.Get(ctx, c.ID, alice); p.Visibility != publishing.Public {
		t.Fatalf("update changed visibility to %q", p.Visibility)
	}
	legacy(t, store, "Legacy01", "tok", doc)
	if ids, _ := svc.Claim(ctx, alice, []publishing.TokenClaim{{ID: "Legacy01", Token: "tok"}}); len(ids) != 1 {
		t.Fatal("claim failed")
	}
	if p, _ := svc.Get(ctx, "Legacy01", 0); p.Visibility != publishing.Link {
		t.Fatalf("claimed visibility %q", p.Visibility)
	}
	list, _ := svc.ListOwned(ctx, alice)
	if len(list) != 2 || list[0].Visibility == "" {
		t.Fatalf("list %+v", list)
	}
}

/* ---------------- browse ---------------- */

type browseFixture struct {
	svc   *publishing.Service
	clock *time.Time
}

func newBrowse(t *testing.T) *browseFixture {
	t.Helper()
	v, _ := scenario.NewValidator()
	now := time.Date(2026, 11, 14, 10, 0, 0, 0, time.UTC)
	f := &browseFixture{clock: &now}
	store := memory.NewWithClock(func() time.Time {
		*f.clock = f.clock.Add(time.Second) // distinct, increasing times
		return *f.clock
	})
	f.svc = publishing.NewService(store, v)
	return f
}

func (f *browseFixture) publish(t *testing.T, name string, v publishing.Visibility, edit func(map[string]any)) string {
	t.Helper()
	doc := renameWith(t, example(t, "sample-mesa.scenario.json"), name, edit)
	c, err := f.svc.Publish(context.Background(), alice, v, doc)
	if err != nil {
		t.Fatal(err)
	}
	return c.ID
}

func (f *browseFixture) browse(t *testing.T, p publishing.BrowseParams) publishing.BrowsePage {
	t.Helper()
	q, err := publishing.ParseBrowse(p)
	if err != nil {
		t.Fatal(err)
	}
	page, err := f.svc.Browse(context.Background(), q)
	if err != nil {
		t.Fatal(err)
	}
	return page
}

func names(p publishing.BrowsePage) []string {
	out := []string{}
	for _, it := range p.Items {
		out = append(out, it.Name)
	}
	return out
}

func TestBrowseListsOnlyPublicNewestFirst(t *testing.T) {
	f := newBrowse(t)
	f.publish(t, "Hidden", publishing.Private, nil)
	f.publish(t, "By link", publishing.Link, nil)
	f.publish(t, "Older", publishing.Public, nil)
	f.publish(t, "Newer", publishing.Public, nil)
	got := names(f.browse(t, publishing.BrowseParams{}))
	if fmt.Sprint(got) != "[Newer Older]" {
		t.Fatalf("got %v", got)
	}
}

func TestBrowseFilters(t *testing.T) {
	f := newBrowse(t)
	f.publish(t, "Standard mesa", publishing.Public, nil)
	f.publish(t, "Carrier flats", publishing.Public, func(m map[string]any) {
		m["rules"].(map[string]any)["deployment"] = "carriers"
		m["rules"].(map[string]any)["squadSize"] = 4
		m["elevation"] = []any{}
		m["components"] = []any{}
	})
	f.publish(t, "Tiny", publishing.Public, func(m map[string]any) {
		m["board"].(map[string]any)["hexes"] = []any{map[string]any{"q": 0, "r": 0}, map[string]any{"q": 0, "r": 1}}
		m["elevation"] = []any{}
		m["components"] = []any{}
	})

	cases := map[string]struct {
		p    publishing.BrowseParams
		want string
	}{
		"deployment": {publishing.BrowseParams{Deployment: "carriers"}, "[Carrier flats]"},
		"squad":      {publishing.BrowseParams{Squad: "3"}, "[Tiny Standard mesa]"},
		"standard":   {publishing.BrowseParams{Size: "standard"}, "[Carrier flats Standard mesa]"},
		"smaller":    {publishing.BrowseParams{Size: "smaller"}, "[Tiny]"},
		"larger":     {publishing.BrowseParams{Size: "larger"}, "[]"},
		"elevation":  {publishing.BrowseParams{Elevation: "1"}, "[Standard mesa]"},
		"search":     {publishing.BrowseParams{Q: "FLAT"}, "[Carrier flats]"},
		"by author":  {publishing.BrowseParams{Q: "zz-nobody"}, "[]"},
		"one letter": {publishing.BrowseParams{Q: "x"}, "[Tiny Carrier flats Standard mesa]"},
		"like chars": {publishing.BrowseParams{Q: "%_"}, "[]"},
	}
	for name, c := range cases {
		if got := fmt.Sprint(names(f.browse(t, c.p))); got != c.want {
			t.Errorf("%s: got %s want %s", name, got, c.want)
		}
	}
}

func TestBrowsePagingIsStable(t *testing.T) {
	f := newBrowse(t)
	for i := 0; i < 30; i++ {
		f.publish(t, fmt.Sprintf("S%02d", i), publishing.Public, nil)
	}
	first := f.browse(t, publishing.BrowseParams{})
	if len(first.Items) != publishing.BrowsePageSize || first.Next == "" {
		t.Fatalf("first page: %d next=%q", len(first.Items), first.Next)
	}
	// a scenario listed while paging must not shift the next page
	f.publish(t, "Late", publishing.Public, nil)
	second := f.browse(t, publishing.BrowseParams{Cursor: first.Next})
	if len(second.Items) != 6 || second.Next != "" {
		t.Fatalf("second page: %v next=%q", names(second), second.Next)
	}
	seen := map[string]bool{}
	for _, it := range append(first.Items, second.Items...) {
		if seen[it.ID] {
			t.Fatalf("duplicate %s", it.Name)
		}
		seen[it.ID] = true
	}
}

func TestBrowseSortByUpdated(t *testing.T) {
	f := newBrowse(t)
	a := f.publish(t, "A", publishing.Public, nil)
	f.publish(t, "B", publishing.Public, nil)
	if _, err := f.svc.Update(context.Background(), a, publishing.Credential{OwnerID: alice}, renameWith(t, example(t, "sample-mesa.scenario.json"), "A2", nil)); err != nil {
		t.Fatal(err)
	}
	if got := fmt.Sprint(names(f.browse(t, publishing.BrowseParams{Sort: "updated"}))); got != "[A2 B]" {
		t.Fatalf("updated: %s", got)
	}
	if got := fmt.Sprint(names(f.browse(t, publishing.BrowseParams{}))); got != "[B A2]" {
		t.Fatalf("new: %s", got)
	}
}

func TestBrowseParams(t *testing.T) {
	bad := []publishing.BrowseParams{
		{Size: "huge"}, {Deployment: "boats"}, {Squad: "0"}, {Squad: "11"}, {Squad: "x"},
		{Elevation: "maybe"}, {Sort: "random"}, {Cursor: "!!"}, {Q: string(make([]rune, 61))},
	}
	for _, p := range bad {
		var inv *publishing.InvalidQuery
		if _, err := publishing.ParseBrowse(p); !errors.As(err, &inv) {
			t.Errorf("%+v accepted", p)
		}
	}
	c := publishing.Cursor{Key: time.Date(2026, 1, 2, 3, 4, 5, 6000, time.UTC), ID: "abcdEFG1"}
	back, err := publishing.DecodeCursor(publishing.EncodeCursor(c))
	if err != nil || !back.Key.Equal(c.Key) || back.ID != c.ID {
		t.Fatalf("cursor round trip: %+v %v", back, err)
	}
}
