package postgres

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/BintangDwitama/minovsky-maps/server/internal/accounts"
	"github.com/BintangDwitama/minovsky-maps/server/internal/publishing"
)

func (s *Store) SaveLoginState(ctx context.Context, st accounts.LoginState) error {
	_, err := s.pool.Exec(ctx, `
		INSERT INTO login_states (state_hash, nonce, verifier, return_to, expires_at)
		VALUES ($1, $2, $3, $4, $5)`, st.StateHash, st.Nonce, st.Verifier, st.ReturnTo, st.ExpiresAt)
	return err
}

// UseLoginState marks a pending state used in the same statement that reads it, so a state can
// be used only once even under concurrent callbacks.
func (s *Store) UseLoginState(ctx context.Context, stateHash []byte, now time.Time) (accounts.LoginState, error) {
	st := accounts.LoginState{StateHash: stateHash}
	err := s.pool.QueryRow(ctx, `
		UPDATE login_states SET used_at = $2
		WHERE state_hash = $1 AND used_at IS NULL AND expires_at > $2
		RETURNING nonce, verifier, return_to, expires_at`, stateHash, now).
		Scan(&st.Nonce, &st.Verifier, &st.ReturnTo, &st.ExpiresAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return accounts.LoginState{}, accounts.ErrNotFound
	}
	return st, err
}

func (s *Store) UpsertGoogleAccount(ctx context.Context, sub, email, displayName string) (accounts.Account, error) {
	var a accounts.Account
	err := s.pool.QueryRow(ctx, `
		INSERT INTO accounts (google_sub, email, display_name) VALUES ($1, $2, $3)
		ON CONFLICT (google_sub) DO UPDATE SET email = EXCLUDED.email
		RETURNING id, google_sub, email, display_name, created_at`, sub, email, displayName).
		Scan(&a.ID, &a.GoogleSub, &a.Email, &a.DisplayName, &a.CreatedAt)
	return a, err
}

func (s *Store) CreateSession(ctx context.Context, tokenHash []byte, accountID int64, expiresAt time.Time) error {
	_, err := s.pool.Exec(ctx,
		`INSERT INTO sessions (token_hash, account_id, expires_at) VALUES ($1, $2, $3)`,
		tokenHash, accountID, expiresAt)
	return err
}

func (s *Store) SessionAccount(ctx context.Context, tokenHash []byte, now time.Time) (accounts.Account, error) {
	var a accounts.Account
	err := s.pool.QueryRow(ctx, `
		SELECT a.id, a.google_sub, a.email, a.display_name, a.created_at
		FROM sessions se JOIN accounts a ON a.id = se.account_id
		WHERE se.token_hash = $1 AND se.expires_at > $2`, tokenHash, now).
		Scan(&a.ID, &a.GoogleSub, &a.Email, &a.DisplayName, &a.CreatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return accounts.Account{}, accounts.ErrNotFound
	}
	return a, err
}

func (s *Store) DeleteSession(ctx context.Context, tokenHash []byte) error {
	_, err := s.pool.Exec(ctx, `DELETE FROM sessions WHERE token_hash = $1`, tokenHash)
	return err
}

func (s *Store) DeleteExpired(ctx context.Context, now time.Time) error {
	if _, err := s.pool.Exec(ctx, `DELETE FROM sessions WHERE expires_at <= $1`, now); err != nil {
		return err
	}
	_, err := s.pool.Exec(ctx, `DELETE FROM login_states WHERE expires_at <= $1`, now)
	return err
}

func (s *Store) RenameAccount(ctx context.Context, id int64, displayName string) (accounts.Account, error) {
	var a accounts.Account
	err := s.pool.QueryRow(ctx, `
		UPDATE accounts SET display_name = $2 WHERE id = $1
		RETURNING id, google_sub, email, display_name, created_at`, id, displayName).
		Scan(&a.ID, &a.GoogleSub, &a.Email, &a.DisplayName, &a.CreatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return accounts.Account{}, accounts.ErrNotFound
	}
	return a, err
}

// DeleteAccount takes the account's scenarios down and deletes the account in one transaction;
// sessions cascade and owner_id becomes NULL.
func (s *Store) DeleteAccount(ctx context.Context, id int64) error {
	return pgx.BeginFunc(ctx, s.pool, func(tx pgx.Tx) error {
		if _, err := tx.Exec(ctx, `
			UPDATE scenarios SET taken_down_at = now(), removed_reason = $2
			WHERE owner_id = $1 AND taken_down_at IS NULL`, id, publishing.RemovedAccountGone); err != nil {
			return err
		}
		_, err := tx.Exec(ctx, `DELETE FROM accounts WHERE id = $1`, id)
		return err
	})
}
