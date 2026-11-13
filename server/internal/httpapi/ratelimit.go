package httpapi

import (
	"math"
	"sync"
	"time"
)

// limiter is a per-key token bucket: `burst` requests at once, refilled at `perMinute`.
// One server instance, so in-memory state is enough.
type limiter struct {
	mu        sync.Mutex
	buckets   map[string]*bucket
	perMinute float64
	burst     float64
	now       func() time.Time
	lastSweep time.Time
}

type bucket struct {
	tokens float64
	last   time.Time
}

func newLimiter(perMinute, burst int, now func() time.Time) *limiter {
	return &limiter{
		buckets:   map[string]*bucket{},
		perMinute: float64(perMinute),
		burst:     float64(burst),
		now:       now,
	}
}

// allow takes a token for key; when refused it reports how long until the next token.
func (l *limiter) allow(key string) (bool, time.Duration) {
	l.mu.Lock()
	defer l.mu.Unlock()
	now := l.now()
	l.sweep(now)

	b, ok := l.buckets[key]
	if !ok {
		b = &bucket{tokens: l.burst, last: now}
		l.buckets[key] = b
	}
	rate := l.perMinute / 60 // tokens per second
	b.tokens = math.Min(l.burst, b.tokens+now.Sub(b.last).Seconds()*rate)
	b.last = now
	if b.tokens >= 1 {
		b.tokens--
		return true, 0
	}
	wait := time.Duration((1 - b.tokens) / rate * float64(time.Second))
	return false, wait
}

// sweep drops full buckets every few minutes so memory stays bounded.
func (l *limiter) sweep(now time.Time) {
	if now.Sub(l.lastSweep) < 5*time.Minute {
		return
	}
	l.lastSweep = now
	full := time.Duration(l.burst / (l.perMinute / 60) * float64(time.Second))
	for k, b := range l.buckets {
		if now.Sub(b.last) > full {
			delete(l.buckets, k)
		}
	}
}
