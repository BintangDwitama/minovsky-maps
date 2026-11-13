// Command api is the Minovsky Maps publishing API.
//
// Configuration (environment):
//
//	PORT          listen port (default 8080; Vercel sets it)
//	DATABASE_URL  Postgres connection string (Neon). If empty, an in-memory store is used —
//	              fine for local development, never for production (data is lost on restart).
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
	"github.com/BintangDwitama/minovsky-maps/server/internal/publishing"
	"github.com/BintangDwitama/minovsky-maps/server/internal/scenario"
	"github.com/BintangDwitama/minovsky-maps/server/internal/store/memory"
	"github.com/BintangDwitama/minovsky-maps/server/internal/store/postgres"
)

// repository is what main needs from a store: the service's Repository plus a health ping.
type repository interface {
	publishing.Repository
	httpapi.Pinger
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

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	srv := &http.Server{
		Addr:              ":" + port,
		Handler:           httpapi.New(publishing.NewService(repo, validator), repo, httpapi.Options{Logger: log}),
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
