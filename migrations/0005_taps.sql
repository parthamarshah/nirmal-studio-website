-- v1 Phase 3 step 6: the contact-tap counter. Counts go in `taps` (made in 0001: day,
-- action, count — no visitor data). This adds only what keeps one visitor from inflating
-- them: a hash of (address, day, a server secret) with a count, so a burst from one place
-- stops counting after a few dozen. The hash can't be turned back into an address, and
-- rows older than two days are deleted as new ones arrive (functions/api/tap.js).
--
-- Additive only: nothing reads this table until the code that writes it ships.
CREATE TABLE IF NOT EXISTS tap_limits (
  bucket TEXT PRIMARY KEY,  -- sha-256 of (ip, day, SESSION_SECRET), hex
  day    TEXT NOT NULL,
  n      INTEGER NOT NULL
);
