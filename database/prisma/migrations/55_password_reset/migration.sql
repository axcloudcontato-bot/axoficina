-- "Esqueci minha senha" and the link an administrator hands to a team member. Only the hash of the link is kept.
ALTER TABLE "users"
  ADD COLUMN "password_reset_token_hash" TEXT,
  ADD COLUMN "password_reset_expires_at" TIMESTAMPTZ;
CREATE UNIQUE INDEX "users_password_reset_token_hash_key" ON "users" ("password_reset_token_hash") WHERE "password_reset_token_hash" IS NOT NULL;
