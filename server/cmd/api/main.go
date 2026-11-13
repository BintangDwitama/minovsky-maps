// Command api is the Minovsky Maps publishing API.
//
// Configuration (environment):
//
//	PORT          listen port (default 8080; Vercel sets it)
//	DATABASE_URL  Postgres connection string (Neon). If empty, an in-memory store is used —
//	              fine for local development, never for production (data is lost on restart).
//
//	TURNSTILE_SECRET  Cloudflare Turnstile secret; enables the bot check on writes and reports
//	RESEND_API_KEY    Resend API key; with REPORT_EMAIL, reports are emailed to the owner
//	REPORT_EMAIL      where report emails go (the Resend account's own address)
//	PUBLIC_APP_URL    public site address used for links in emails
//
// Locally, unset variables are also read from `.env.local` in the repo root (written by
// `neon init` / `neon checkout`; points at the Neon dev branch). Real environment values win.
package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/BintangDwitama/minovsky-maps/server/internal/devenv"
	"github.com/BintangDwitama/minovsky-maps/server/internal/httpapi"
	"github.com/BintangDwitama/minovsky-maps/server/internal/notify"
	"github.com/BintangDwitama/minovsky-maps/server/internal/publishing"
	"github.com/BintangDwitama/minovsky-maps/server/internal/reports"
	"github.com/BintangDwitama/minovsky-maps/server/internal/scenario"
	"github.com/BintangDwitama/minovsky-maps/server/internal/store/memory"
	"github.com/BintangDwitama/minovsky-maps/server/internal/store/postgres"
	"github.com/BintangDwitama/minovsky-maps/server/internal/turnstile"
)

// repository is what main needs from a store: publishing and reports storage plus a health ping.
type repository interface {
	publishing.Repository
	reports.Repository
	httpapi.Pinger
}

// botCheck adapts the Turnstile verifier to the API's BotCheck (mapping its rejection error).
type botCheck struct{ v *turnstile.Verifier }

func (b botCheck) Verify(ctx context.Context, token, ip string) error {
	err := b.v.Verify(ctx, token, ip)
	if errors.Is(err, turnstile.ErrRejected) {
		return httpapi.ErrBot
	}
	return err
}

func main() {
	log := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	if err := run(log); err != nil {
		log.Error("server stopped", "err", err)
		os.Exit(1)
	}
}

func run(log *slog.Logger) error {
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	// local development: pick up DATABASE_URL etc. from the Neon CLI's .env.local (never overrides)
	if wd, err := os.Getwd(); err == nil {
		if file, names, err := devenv.Load(wd); err != nil {
			log.Warn("could not read local env file", "file", file, "err", err)
		} else if file != "" {
			log.Info("loaded local env file", "file", file, "vars", names)
		}
	}

	validator, err := scenario.NewValidator()
	if err != nil {
		return err
	}

	var repo repository
	if url := os.Getenv("DATABASE_URL"); url != "" {
		connectCtx, cancel := context.WithTimeout(ctx, 30*time.Second)
		store, err := postgres.Open(connectCtx, url)
		cancel()
		if err != nil {
			return err
		}
		defer store.Close()
		repo = store
		log.Info("using postgres store")
	} else {
		repo = memory.New()
		log.Warn("DATABASE_URL not set: using in-memory store (data is lost on restart)")
	}

	opts := httpapi.Options{Logger: log}

	// bot check (Cloudflare Turnstile) on publish, update and report
	if secret := os.Getenv("TURNSTILE_SECRET"); secret != "" {
		opts.Bot = botCheck{turnstile.New(secret)}
		log.Info("bot check enabled")
	} else {
		log.Warn("TURNSTILE_SECRET not set: publish, update and report are not bot-checked")
	}

	// reports, emailed to the owner through Resend when configured
	var notifier reports.Notifier = reports.NoNotifier{}
	apiKey, reportTo := os.Getenv("RESEND_API_KEY"), os.Getenv("REPORT_EMAIL")
	if apiKey != "" && reportTo != "" {
		resend := notify.NewResend(apiKey, reportTo, os.Getenv("PUBLIC_APP_URL"))
		if endpoint := os.Getenv("RESEND_API_URL"); endpoint != "" {
			resend = resend.WithEndpoint(endpoint) // testing against a local fake
		}
		notifier = resend
		log.Info("report emails enabled")
	} else {
		log.Warn("RESEND_API_KEY or REPORT_EMAIL not set: reports are stored but not emailed")
	}
	opts.Reports = reports.NewService(repo, notifier, log)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	srv := &http.Server{
		Addr:              ":" + port,
		Handler:           httpapi.New(publishing.NewService(repo, validator), repo, opts),
		ReadHeaderTimeout: 10 * time.Second,
		ReadTimeout:       30 * time.Second,
		WriteTimeout:      30 * time.Second,
		IdleTimeout:       90 * time.Second,
	}

	errc := make(chan error, 1)
	go func() {
		log.Info("listening", "addr", srv.Addr)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			errc <- err
		}
		close(errc)
	}()

	select {
	case err := <-errc:
		return err
	case <-ctx.Done():
	}
	log.Info("shutting down")
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	return srv.Shutdown(shutdownCtx)
}
