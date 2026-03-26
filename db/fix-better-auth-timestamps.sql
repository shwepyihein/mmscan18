-- Run on your Neon/Postgres DB (e.g. psql or Neon SQL editor).
-- Better Auth may omit `updatedAt` on INSERT; columns must DEFAULT to a timestamp.

ALTER TABLE account
  ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;

UPDATE account
SET "updatedAt" = COALESCE("updatedAt", "createdAt", CURRENT_TIMESTAMP)
WHERE "updatedAt" IS NULL;

-- Same class of error on `user` if you see it next:
ALTER TABLE "user"
  ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;

UPDATE "user"
SET "updatedAt" = COALESCE("updatedAt", "createdAt", CURRENT_TIMESTAMP)
WHERE "updatedAt" IS NULL;

-- Optional: `session` / `verification` if NOT NULL without DEFAULT:
-- ALTER TABLE session ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;
