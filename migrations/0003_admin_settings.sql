-- v1 Phase 2 step 7: somewhere for the backend to keep a setting it changes itself.
--
-- Today that is exactly one row: the PIN. `ADMIN_PIN_HASH` is a Cloudflare secret, and a
-- running Worker cannot rewrite its own environment — so "change the PIN" has to store
-- the new hash somewhere it CAN write. When a row is present it wins; the environment
-- secret is the fallback for a deployment that has never changed its PIN.
--
-- Consequence worth knowing: if this table were wiped, the PIN would revert to whatever
-- ADMIN_PIN_HASH still holds. That is the same blast radius as losing the sessions table
-- (everyone signs in again), not a new one — the site's content lives in git either way.
--
-- Additive only: nothing reads this table until the code that writes it ships.
CREATE TABLE IF NOT EXISTS settings (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,
  updated_at  INTEGER NOT NULL
);
