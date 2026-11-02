ALTER TABLE users ADD COLUMN google_subject TEXT;
CREATE UNIQUE INDEX users_google_subject_active_key ON users (google_subject) WHERE google_subject IS NOT NULL AND deleted_at IS NULL;
