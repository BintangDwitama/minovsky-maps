package devenv

import (
	"os"
	"path/filepath"
	"slices"
	"testing"
)

func TestLoadFromParentWithoutOverriding(t *testing.T) {
	root := t.TempDir()
	content := "# comment\n\nMM_A=one\nexport MM_B=\"two words\"\nMM_C='three'\nMM_SET=from-file\nnot a line\n=nokey\n"
	if err := os.WriteFile(filepath.Join(root, FileName), []byte(content), 0o600); err != nil {
		t.Fatal(err)
	}
	child := filepath.Join(root, "server", "cmd", "api")
	if err := os.MkdirAll(child, 0o755); err != nil {
		t.Fatal(err)
	}
	t.Setenv("MM_SET", "from-environment")
	for _, k := range []string{"MM_A", "MM_B", "MM_C"} {
		t.Setenv(k, "") // registers cleanup
		os.Unsetenv(k)
	}

	path, set, err := Load(child)
	if err != nil {
		t.Fatal(err)
	}
	if path != filepath.Join(root, FileName) {
		t.Fatalf("path = %q", path)
	}
	if !slices.Equal(set, []string{"MM_A", "MM_B", "MM_C"}) {
		t.Fatalf("set = %v", set)
	}
	for k, want := range map[string]string{"MM_A": "one", "MM_B": "two words", "MM_C": "three", "MM_SET": "from-environment"} {
		if got := os.Getenv(k); got != want {
			t.Errorf("%s = %q, want %q", k, got, want)
		}
	}
}

func TestNoFile(t *testing.T) {
	path, set, err := Load(t.TempDir())
	if path != "" || set != nil || err != nil {
		t.Fatalf("got %q %v %v", path, set, err)
	}
}
