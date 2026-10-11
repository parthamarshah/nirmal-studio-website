-- v1 Phase 3 step 1: images uploaded from /admin, waiting to be published.
--
-- An upload is turned into a GitHub blob straight away (one request per upload, so a
-- publish never has to push megabytes through one Worker invocation) and recorded here
-- by the repo path it will be published at. Publish then only *references* that blob sha
-- in its tree. The bytes are also kept in KV (UPLOADS, with an expiry) so the editor can
-- show the image before a rebuild, and so the blob can be re-created if GitHub ever
-- garbage-collects it before the publish happens.
--
-- D1, not KV, is the record: it is strongly consistent, and publish must KNOW whether a
-- file a draft points at was uploaded. KV can miss a fresh write for tens of seconds.
--
-- Like every table here, losing it loses only unpublished work: a draft pointing at a
-- file that isn't in the repo and isn't recorded here is refused at publish, never sent
-- to a build that would fail.
--
-- Additive only: nothing reads this table until the code that writes it ships.
CREATE TABLE IF NOT EXISTS uploads (
  path        TEXT PRIMARY KEY,            -- content/media/<dir>/<file>, server-generated
  doc_id      TEXT NOT NULL,               -- 'founders' | 'project:<slug>' — which document may use it
  blob_sha    TEXT NOT NULL,               -- git blob sha GitHub returned
  bytes       INTEGER NOT NULL,
  width       INTEGER,
  height      INTEGER,
  created_at  INTEGER NOT NULL,
  created_by  TEXT                         -- which session uploaded it (truncated)
);
