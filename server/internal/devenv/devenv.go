// Package devenv loads local-development settings from a `.env.local` file (written by the
// Neon CLI at the repository root). It never overrides variables that are already set, so
// real environment settings (e.g. on Vercel, where the file does not exist) always win.
package devenv

import (
	"bufio"
	"os"
	"path/filepath"
	"strings"
)

// FileName is the file looked for in the working directory and its parents.
const FileName = ".env.local"

// maxLevels: server/ and server/cmd/api are at most a few levels below the repo root.
const maxLevels = 4

// Load finds FileName in dir or up to maxLevels parents and sets each KEY=VALUE that is not
// already set. It returns the file used ("" if none) and the names it set (never the values).
func Load(dir string) (string, []string, error) {
	path := find(dir)
	if path == "" {
		return "", nil, nil
	}
	f, err := os.Open(path)
	if err != nil {
		return "", nil, err
	}
	defer f.Close()

	var set []string
	sc := bufio.NewScanner(f)
	for sc.Scan() {
		key, value, ok := parseLine(sc.Text())
		if !ok {
			continue
		}
		if _, exists := os.LookupEnv(key); exists {
			continue
		}
		if err := os.Setenv(key, value); err != nil {
			return path, set, err
		}
		set = append(set, key)
	}
	return path, set, sc.Err()
}

func find(dir string) string {
	for i := 0; i <= maxLevels; i++ {
		candidate := filepath.Join(dir, FileName)
		if info, err := os.Stat(candidate); err == nil && !info.IsDir() {
			return candidate
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			break
		}
		dir = parent
	}
	return ""
}

// parseLine accepts `KEY=VALUE`, `export KEY=VALUE`, optional single or double quotes around
// VALUE, and ignores blank lines and `#` comments.
func parseLine(line string) (string, string, bool) {
	line = strings.TrimSpace(line)
	if line == "" || strings.HasPrefix(line, "#") {
		return "", "", false
	}
	line = strings.TrimPrefix(line, "export ")
	key, value, ok := strings.Cut(line, "=")
	key = strings.TrimSpace(key)
	if !ok || key == "" || strings.ContainsAny(key, " \t") {
		return "", "", false
	}
	value = strings.TrimSpace(value)
	if len(value) >= 2 && (value[0] == '"' || value[0] == '\'') && value[len(value)-1] == value[0] {
		value = value[1 : len(value)-1]
	}
	return key, value, true
}
