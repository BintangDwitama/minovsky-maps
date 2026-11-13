// Package reports lets players flag a published scenario. Reports are stored first and then
// sent to the owner by email; an email failure never loses a report.
package reports

import (
	"context"
	"errors"
	"log/slog"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/BintangDwitama/minovsky-maps/server/internal/publishing"
)

// MaxDetails is the longest free-text explanation accepted.
const MaxDetails = 1000

// Reasons maps the accepted reason codes to the wording used in emails.
var Reasons = map[string]string{
	"official-copy": "Copies official material",
	"offensive":     "Offensive or inappropriate",
	"spam":          "Spam",
	"broken":        "Broken or unplayable",
	"other":         "Other",
}

// Input is what a reporter sends.
type Input struct {
	ScenarioID string
	Reason     string
	Details    string
}

// Report is a stored report, as passed to the Notifier.
type Report struct {
	ID           int64
	ScenarioID   string
	ScenarioName string
	Reason       string
	Details      string
	CreatedAt    time.Time
}

// Invalid is a reporter mistake (bad reason, details too long).
type Invalid struct{ Message string }

func (e *Invalid) Error() string { return e.Message }

// Repository stores reports. ScenarioName returns publishing.ErrNotFound for unknown or
// taken-down scenarios.
type Repository interface {
	ScenarioName(ctx context.Context, id string) (string, error)
	AddReport(ctx context.Context, scenarioID, reason, details string) (int64, time.Time, error)
	MarkEmailed(ctx context.Context, id int64) error
}

// Notifier tells the owner about a new report.
type Notifier interface {
	Notify(ctx context.Context, r Report) error
}

// Service implements reporting.
type Service struct {
	repo   Repository
	notify Notifier
	log    *slog.Logger
}

// NewService wires the service.
func NewService(repo Repository, n Notifier, log *slog.Logger) *Service {
	if log == nil {
		log = slog.Default()
	}
	return &Service{repo: repo, notify: n, log: log}
}

// Report validates, stores and then notifies. Notification failures are logged, not returned.
func (s *Service) Report(ctx context.Context, in Input) error {
	if _, ok := Reasons[in.Reason]; !ok {
		return &Invalid{Message: "Choose a reason for the report."}
	}
	details := strings.TrimSpace(in.Details)
	if utf8.RuneCountInString(details) > MaxDetails {
		return &Invalid{Message: "Details can be at most 1,000 characters."}
	}
	if !publishing.ValidID(in.ScenarioID) {
		return publishing.ErrNotFound
	}
	name, err := s.repo.ScenarioName(ctx, in.ScenarioID)
	if err != nil {
		return err
	}
	id, at, err := s.repo.AddReport(ctx, in.ScenarioID, in.Reason, details)
	if err != nil {
		return err
	}

	report := Report{ID: id, ScenarioID: in.ScenarioID, ScenarioName: name, Reason: in.Reason, Details: details, CreatedAt: at}
	notifyCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), 10*time.Second)
	defer cancel()
	if err := s.notify.Notify(notifyCtx, report); err != nil {
		if !errors.Is(err, ErrNotConfigured) {
			s.log.Error("report stored but email failed", "report", id, "scenario", in.ScenarioID, "err", err)
		}
		return nil
	}
	if err := s.repo.MarkEmailed(ctx, id); err != nil {
		s.log.Warn("could not mark report as emailed", "report", id, "err", err)
	}
	return nil
}

// ErrNotConfigured is returned by a Notifier that has nowhere to send to.
var ErrNotConfigured = errors.New("notifications not configured")

// NoNotifier stores reports without sending anything (local development).
type NoNotifier struct{}

func (NoNotifier) Notify(context.Context, Report) error { return ErrNotConfigured }
