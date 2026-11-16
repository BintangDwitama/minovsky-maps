package publishing

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"
)

// BrowsePageSize is how many scenarios one Browse page holds.
const BrowsePageSize = 24

// MaxSearchLength caps the search text.
const MaxSearchLength = 60

// Board-size filters (StandardWidth × StandardHeight is the printed mat).
const (
	SizeStandard = "standard"
	SizeSmaller  = "smaller"
	SizeLarger   = "larger"

	StandardWidth  = 15
	StandardHeight = 15
	StandardHexes  = StandardWidth * StandardHeight
)

// Sort orders.
const (
	SortNew     = "new"     // newest listed first
	SortUpdated = "updated" // most recently updated first
)

// BrowseQuery is a validated Browse request. Zero values mean "any".
type BrowseQuery struct {
	Q          string // already trimmed; "" or at least 2 characters
	Size       string
	Deployment string // "bases" | "carriers"
	Squad      int    // 1–10
	Elevation  bool   // only scenarios with elevation
	Sort       string // SortNew | SortUpdated
	After      *Cursor
	// Limit is how many rows to fetch (the service asks for one more than a page).
	Limit int
}

// Cursor is where the next page starts: strictly after (Key, ID) in the sort order.
type Cursor struct {
	Key time.Time
	ID  string
}

// BrowseItem is one public scenario in a Browse page.
type BrowseItem struct {
	ID            string
	Name          string
	OwnerName     string
	Width, Height int
	HexCount      int
	Deployment    string
	SquadSize     int
	HasElevation  bool
	ListedAt      time.Time
	UpdatedAt     time.Time
	Doc           json.RawMessage
}

// SortKey is the item's value in the given order.
func (it BrowseItem) SortKey(sort string) time.Time {
	if sort == SortUpdated {
		return it.UpdatedAt
	}
	return it.ListedAt
}

// InvalidQuery names a Browse parameter that could not be used.
type InvalidQuery struct {
	Param   string
	Message string
}

func (e *InvalidQuery) Error() string { return e.Param + ": " + e.Message }

// BrowseParams are the raw request parameters.
type BrowseParams struct {
	Q, Size, Deployment, Squad, Elevation, Sort, Cursor string
}

// ParseBrowse validates raw parameters into a query.
func ParseBrowse(p BrowseParams) (BrowseQuery, error) {
	q := BrowseQuery{Sort: SortNew}
	q.Q = strings.Join(strings.Fields(p.Q), " ")
	if utf8.RuneCountInString(q.Q) > MaxSearchLength {
		return q, &InvalidQuery{"q", fmt.Sprintf("search text can be at most %d characters", MaxSearchLength)}
	}
	if utf8.RuneCountInString(q.Q) < 2 {
		q.Q = "" // one letter matches almost everything; treat as no search
	}
	switch p.Size {
	case "", SizeStandard, SizeSmaller, SizeLarger:
		q.Size = p.Size
	default:
		return q, &InvalidQuery{"size", "must be standard, smaller or larger"}
	}
	switch p.Deployment {
	case "", "bases", "carriers":
		q.Deployment = p.Deployment
	default:
		return q, &InvalidQuery{"deployment", "must be bases or carriers"}
	}
	if p.Squad != "" {
		n, err := strconv.Atoi(p.Squad)
		if err != nil || n < 1 || n > 10 {
			return q, &InvalidQuery{"squad", "must be a number from 1 to 10"}
		}
		q.Squad = n
	}
	switch p.Elevation {
	case "":
	case "1", "true":
		q.Elevation = true
	default:
		return q, &InvalidQuery{"elevation", "must be 1"}
	}
	switch p.Sort {
	case "", SortNew:
	case SortUpdated:
		q.Sort = SortUpdated
	default:
		return q, &InvalidQuery{"sort", "must be new or updated"}
	}
	if p.Cursor != "" {
		c, err := DecodeCursor(p.Cursor)
		if err != nil {
			return q, &InvalidQuery{"cursor", "is not valid"}
		}
		q.After = &c
	}
	return q, nil
}

// EncodeCursor makes the opaque page token: base64url of "<unix micro>.<id>".
func EncodeCursor(c Cursor) string {
	return base64.RawURLEncoding.EncodeToString([]byte(fmt.Sprintf("%d.%s", c.Key.UnixMicro(), c.ID)))
}

// DecodeCursor reads a page token.
func DecodeCursor(s string) (Cursor, error) {
	raw, err := base64.RawURLEncoding.DecodeString(s)
	if err != nil {
		return Cursor{}, err
	}
	micro, id, ok := strings.Cut(string(raw), ".")
	n, err := strconv.ParseInt(micro, 10, 64)
	if !ok || err != nil || !ValidID(id) {
		return Cursor{}, fmt.Errorf("bad cursor")
	}
	return Cursor{Key: time.UnixMicro(n).UTC(), ID: id}, nil
}

// BrowsePage is one page of results.
type BrowsePage struct {
	Items []BrowseItem
	// Next is the cursor for the following page, or "" when this is the last.
	Next string
}

// Browse returns one page of public scenarios.
func (s *Service) Browse(ctx context.Context, q BrowseQuery) (BrowsePage, error) {
	q.Limit = BrowsePageSize + 1
	items, err := s.repo.Browse(ctx, q)
	if err != nil {
		return BrowsePage{}, err
	}
	page := BrowsePage{Items: items}
	if len(items) > BrowsePageSize {
		page.Items = items[:BrowsePageSize]
		last := page.Items[BrowsePageSize-1]
		page.Next = EncodeCursor(Cursor{Key: last.SortKey(q.Sort), ID: last.ID})
	}
	return page, nil
}
