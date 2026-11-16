package httpapi_test

import (
	"net/http"
	"net/url"
	"strings"
	"testing"

	"github.com/BintangDwitama/minovsky-maps/server/internal/httpapi"
	"github.com/BintangDwitama/minovsky-maps/server/internal/reports"
)

type browseBody struct {
	Items []struct {
		ID        string `json:"id"`
		Name      string `json:"name"`
		OwnerName string `json:"ownerName"`
		Width     int    `json:"width"`
		HexCount  int    `json:"hexCount"`
	} `json:"items"`
	Next *string `json:"next"`
}

// save stores the sample with a name and visibility as the signed-in user.
func (f *fixture) save(t *testing.T, as []string, name, visibility string) string {
	t.Helper()
	body := strings.Replace(wrap(t, "examples/sample-mesa.scenario.json"), "Sample: Desert Mesa", name, 1)
	body = strings.Replace(body, `"visibility":"link"`, `"visibility":"`+visibility+`"`, 1)
	if visibility == "" {
		body = strings.Replace(body, `"visibility":"",`, "", 1)
	}
	rec := f.do("POST", "/api/scenarios", body, as...)
	if rec.Code != http.StatusCreated {
		t.Fatalf("save: %d %s", rec.Code, rec.Body)
	}
	return decode[created](t, rec).ID
}

func TestSaveDefaultsToPrivateAndHidesIt(t *testing.T) {
	f := newFixture(t, httpapi.Options{WriteBurst: 100, WritesPerMinute: 100})
	f.h = withReports(t, f) // reports need the fixture's store
	alice, bob := f.signIn(t, "alice"), f.signIn(t, "bob")
	id := f.save(t, alice, "Secret Mesa", "")

	owner := f.do("GET", "/api/scenarios/"+id, "", alice...)
	if owner.Code != http.StatusOK || !strings.Contains(owner.Body.String(), `"visibility":"private"`) {
		t.Fatalf("owner read: %d %s", owner.Code, owner.Body)
	}
	for name, h := range map[string][]string{"anonymous": nil, "bob": bob} {
		if rec := f.do("GET", "/api/scenarios/"+id, "", h...); rec.Code != http.StatusNotFound {
			t.Errorf("%s read: %d", name, rec.Code)
		}
	}
	report := `{"scenarioId":"` + id + `","reason":"spam"}`
	if rec := f.do("POST", "/api/reports", report); rec.Code != http.StatusNotFound {
		t.Fatalf("report on private: %d %s", rec.Code, rec.Body)
	}

	// sharing it later keeps the link
	if rec := f.do("PATCH", "/api/scenarios/"+id, `{"visibility":"link"}`, bob...); rec.Code != http.StatusNotFound {
		t.Fatalf("bob cannot even see it: %d", rec.Code)
	}
	if rec := f.do("PATCH", "/api/scenarios/"+id, `{"visibility":"link"}`, alice[0], alice[1]); rec.Code != http.StatusForbidden {
		t.Fatalf("missing client header: %d", rec.Code)
	}
	if rec := f.do("PATCH", "/api/scenarios/"+id, `{"visibility":"everyone"}`, alice...); rec.Code != http.StatusBadRequest {
		t.Fatalf("bad value: %d", rec.Code)
	}
	if rec := f.do("PATCH", "/api/scenarios/"+id, `{"visibility":"link"}`, alice...); rec.Code != http.StatusOK {
		t.Fatalf("share: %d %s", rec.Code, rec.Body)
	}
	anon := f.do("GET", "/api/scenarios/"+id, "")
	if anon.Code != http.StatusOK || strings.Contains(anon.Body.String(), "visibility") {
		t.Fatalf("anonymous after sharing: %d %s", anon.Code, anon.Body)
	}
	if rec := f.do("PATCH", "/api/scenarios/"+id, `{"visibility":"public"}`, bob...); rec.Code != http.StatusForbidden {
		t.Fatalf("bob changes alice's visibility: %d", rec.Code)
	}
	list := f.do("GET", "/api/me/scenarios", "", alice...)
	if !strings.Contains(list.Body.String(), `"visibility":"link"`) {
		t.Fatalf("my scenarios: %s", list.Body)
	}
}

func TestBrowseEndpoint(t *testing.T) {
	f := newFixture(t, httpapi.Options{WriteBurst: 100, WritesPerMinute: 100})
	alice := f.signIn(t, "alice")
	f.save(t, alice, "Private one", "private")
	f.save(t, alice, "Link one", "link")
	pub := f.save(t, alice, "Public one", "public")

	rec := f.do("GET", "/api/browse", "")
	if rec.Code != http.StatusOK || rec.Header().Get("Cache-Control") != "no-store" {
		t.Fatalf("browse: %d", rec.Code)
	}
	b := decode[browseBody](t, rec)
	if len(b.Items) != 1 || b.Items[0].ID != pub || b.Items[0].OwnerName != "Alice" || b.Items[0].Width != 15 || b.Next != nil {
		t.Fatalf("items: %s", rec.Body)
	}
	if body := rec.Body.String(); strings.Contains(body, "@example.com") || strings.Contains(body, `"ownerId"`) {
		t.Fatal("browse must not expose emails or account ids")
	}
	if b := decode[browseBody](t, f.do("GET", "/api/browse?q=alice", "")); len(b.Items) != 1 {
		t.Fatalf("search by author: %+v", b)
	}
	if b := decode[browseBody](t, f.do("GET", "/api/browse?deployment=carriers", "")); len(b.Items) != 0 {
		t.Fatalf("filter: %+v", b)
	}
	bad := f.do("GET", "/api/browse?size=huge", "")
	if bad.Code != http.StatusBadRequest || !strings.Contains(bad.Body.String(), "size") {
		t.Fatalf("invalid filter: %d %s", bad.Code, bad.Body)
	}
	if rec := f.do("GET", "/api/browse?q="+url.QueryEscape(strings.Repeat("x", 61)), ""); rec.Code != http.StatusBadRequest {
		t.Fatalf("long search: %d", rec.Code)
	}

	// making it private again removes it from Browse
	if rec := f.do("PATCH", "/api/scenarios/"+pub, `{"visibility":"private"}`, alice...); rec.Code != http.StatusOK {
		t.Fatal("unlist")
	}
	if b := decode[browseBody](t, f.do("GET", "/api/browse", "")); len(b.Items) != 0 {
		t.Fatalf("still listed: %+v", b)
	}
}

func TestBrowseRateLimitIsSeparate(t *testing.T) {
	f := newFixture(t, httpapi.Options{BrowsePerMinute: 1, BrowseBurst: 2})
	ip := []string{"X-Forwarded-For", "198.51.100.9"}
	for i := 0; i < 2; i++ {
		if rec := f.do("GET", "/api/browse", "", ip...); rec.Code != 200 {
			t.Fatalf("browse %d: %d", i, rec.Code)
		}
	}
	if rec := f.do("GET", "/api/browse", "", ip...); rec.Code != http.StatusTooManyRequests {
		t.Fatalf("expected 429, got %d", rec.Code)
	}
	if rec := f.do("GET", "/api/scenarios/zzzzzzzz", "", ip...); rec.Code != http.StatusNotFound {
		t.Fatalf("other reads are not limited: %d", rec.Code)
	}
}

// withReports rebuilds the fixture's handler with reporting on, keeping its store and sessions.
func withReports(t *testing.T, f *fixture) http.Handler {
	t.Helper()
	return newHandler(t, f, httpapi.Options{
		WriteBurst: 100, WritesPerMinute: 100,
		Reports: reports.NewService(f.store, reports.NoNotifier{}, nil),
	})
}
