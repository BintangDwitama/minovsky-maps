package turnstile

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
)

func fakeCloudflare(t *testing.T, status int, body string) (*httptest.Server, *[]string) {
	t.Helper()
	var seen []string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_ = r.ParseForm()
		seen = append(seen, r.PostForm.Get("secret"), r.PostForm.Get("response"), r.PostForm.Get("remoteip"))
		w.WriteHeader(status)
		_, _ = w.Write([]byte(body))
	}))
	t.Cleanup(srv.Close)
	return srv, &seen
}

func TestVerify(t *testing.T) {
	ctx := context.Background()

	ok, seen := fakeCloudflare(t, 200, `{"success":true}`)
	if err := New("s3cret").WithEndpoint(ok.URL).Verify(ctx, "tok", "203.0.113.9"); err != nil {
		t.Fatalf("valid token: %v", err)
	}
	if got := *seen; got[0] != "s3cret" || got[1] != "tok" || got[2] != "203.0.113.9" {
		t.Fatalf("sent %v", got)
	}

	bad, _ := fakeCloudflare(t, 200, `{"success":false,"error-codes":["invalid-input-response"]}`)
	if err := New("s").WithEndpoint(bad.URL).Verify(ctx, "tok", ""); !errors.Is(err, ErrRejected) {
		t.Fatalf("rejected token: %v", err)
	}

	if err := New("s").WithEndpoint(ok.URL).Verify(ctx, "  ", ""); !errors.Is(err, ErrRejected) {
		t.Fatalf("empty token: %v", err)
	}

	down, _ := fakeCloudflare(t, 500, `oops`)
	err := New("s").WithEndpoint(down.URL).Verify(ctx, "tok", "")
	if err == nil || errors.Is(err, ErrRejected) {
		t.Fatalf("outage should be a non-rejection error, got %v", err)
	}
}
