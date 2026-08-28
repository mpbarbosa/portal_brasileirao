/**
 * The only file that knows SQL.
 *
 * Everything that decides *what should happen* lives in `account-core.ts` and
 * `session-core.ts`, which are pure and take `now` as a parameter. This file
 * decides only where the bytes go. That split is what lets expiry, renewal and
 * claim-checking be unit-tested without a database, exactly as
 * `commons-core.ts` is tested without a network while `scripts/commons-api.ts`
 * does the fetching.
 *
 * `node:sqlite` rather than `better-sqlite3`: it is in core Node, so there is no
 * native module for `npm ci --omit=dev` to build on a production box the deploy
 * scripts already avoid compiling on. It emits an `ExperimentalWarning` on
 * boot — that is expected, and belongs in the runbook rather than in an
 * incident.
 */

import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import path from "node:path";

import type { DatabaseSync as DatabaseSyncType } from "node:sqlite";

type DatabaseSync = DatabaseSyncType;

/**
 * `node:sqlite` is loaded **lazily**, and that is not a style choice.
 *
 * A static import is evaluated when `server.ts` is loaded, so a runtime without
 * the module throws `ERR_UNKNOWN_BUILTIN_MODULE` at import time and the **whole
 * process fails to boot** — a site that is down, on a release that only meant to
 * add a feature nobody had switched on.
 *
 * The host pins Node 22, which is not quite the same as having this: the module
 * arrived in **22.5**, so 22.0–22.4 satisfies the pin and still lacks it. That
 * is exactly the gap this guards, and it is why the pin is not a substitute for
 * loading it here.
 *
 * Loading it lazily keeps the contract the rest of this file states: an
 * unavailable store is a feature that is absent, never an app that is broken.
 */
const loadDatabaseSync = (): new (path: string) => DatabaseSync => {
  // The base path is `process.cwd()` and **not `import.meta.url`**, which is
  // what this was and which worked everywhere except the one place that
  // matters. esbuild bundles `server.ts` to **CommonJS**, where
  // `import.meta.url` is `undefined`, so `createRequire` threw
  // "The argument 'filename' must be … Received undefined" and the store failed
  // to open — on every host with accounts configured, and nowhere else.
  //
  // Nothing caught it. The unit tests and the end-to-end suite both run under
  // `tsx`, which is ESM; CI's bundle smoke test runs the real CommonJS build
  // but left accounts unconfigured, so `openStore` was never called. The bug
  // needed production's module system *and* production's configuration at once,
  // and no harness had both. `check`'s smoke step now sets dummy Google
  // credentials for exactly that reason.
  //
  // Any absolute path works: resolving a builtin never touches the filesystem.
  const require = createRequire(path.join(process.cwd(), "resolve-base.cjs"));
  return (require("node:sqlite") as { DatabaseSync: new (path: string) => DatabaseSync })
    .DatabaseSync;
};

import type { Account, AuthProvider } from "@/account-core";
import type { SessionRecord } from "@/session-core";

/**
 * Migrations, applied in order, tracked by SQLite's own `PRAGMA user_version`.
 *
 * No framework: there will be a handful of these in this app's lifetime, and a
 * migration tool is a dependency plus a directory plus a lockfile to hold five
 * statements. The index in this array **is** the version, so entries are only
 * ever appended — editing one that has run somewhere is how two databases come
 * to disagree about what version 1 means.
 */
const MIGRATIONS: string[] = [
  `
  CREATE TABLE accounts (
    id            TEXT PRIMARY KEY,
    provider      TEXT NOT NULL,
    subject       TEXT NOT NULL,
    display_name  TEXT NOT NULL,
    created_at    INTEGER NOT NULL,
    last_seen_at  INTEGER NOT NULL,
    UNIQUE(provider, subject)
  );

  CREATE TABLE sessions (
    token_hash  TEXT PRIMARY KEY,
    account_id  TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    created_at  INTEGER NOT NULL,
    expires_at  INTEGER NOT NULL
  );

  CREATE INDEX sessions_by_account ON sessions(account_id);
  `,
  `
  CREATE TABLE preferences (
    account_id  TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    key         TEXT NOT NULL,
    value       TEXT NOT NULL,
    updated_at  INTEGER NOT NULL,
    PRIMARY KEY (account_id, key)
  );
  `,
];

interface AccountRow {
  id: string;
  provider: string;
  subject: string;
  display_name: string;
  created_at: number;
  last_seen_at: number;
}

const toAccount = (row: AccountRow): Account => ({
  id: row.id,
  provider: row.provider as AuthProvider,
  subject: row.subject,
  displayName: row.display_name,
  createdAt: row.created_at,
  lastSeenAt: row.last_seen_at,
});

export interface AccountStore {
  /**
   * Find the account for this provider subject, or create one.
   *
   * The upsert is the whole of "sign up": there is no separate registration,
   * because Google has already established who this is and asking again would
   * be a form that adds nothing.
   */
  upsertAccount(input: {
    id: string;
    provider: AuthProvider;
    subject: string;
    displayName: string;
    now: number;
  }): Account;

  /** The session row for a token hash, or null. Expiry is not judged here — see
   *  `sessionState`, which is pure and takes `now`. */
  findSession(tokenHash: string): SessionRecord | null;

  findAccount(id: string): Account | null;

  startSession(session: SessionRecord): void;

  /** Replace one session's token and expiry, keeping the account. Used by
   *  rolling renewal, which mints a new token rather than extending the old
   *  one — a renewed session should not keep a value that has been in flight
   *  for a month. */
  replaceSession(oldHash: string, session: SessionRecord): void;

  endSession(tokenHash: string): void;

  /** "Sair de todos os dispositivos". This is the operation a JWT cannot
   *  actually perform, and the reason sessions are rows. */
  endAllSessions(accountId: string): void;

  /** Hard delete, cascading to sessions, in one transaction — the LGPD
   *  erasure right, and not a soft-delete flag. */
  deleteAccount(accountId: string): void;

  /**
   * The reader's preferences, as a key/value map.
   *
   * Key/value rather than a column per preference, so adding one is a write
   * rather than a migration — and so a **stale bundle reading a newer row does
   * not break**: an unknown key is simply a key this build has no use for,
   * where an unknown column would be a query that fails.
   */
  readPreferences(accountId: string): Record<string, string>;

  /** Set or clear one key. `null` deletes the row rather than storing a null,
   *  so "follows nobody" and "has never chosen" are the same state — which is
   *  what `planSync` assumes when it decides whether to seed. */
  writePreference(accountId: string, key: string, value: string | null, now: number): void;

  /** Drop sessions that have expired. Nothing reads them, and keeping them is
   *  a record of when a person was last here, retained for no stated purpose. */
  pruneSessions(now: number): number;

  close(): void;
}

const migrate = (db: DatabaseSync): void => {
  const [{ user_version: version }] = db.prepare("PRAGMA user_version").all() as {
    user_version: number;
  }[];

  for (let index = version; index < MIGRATIONS.length; index += 1) {
    db.exec("BEGIN");
    try {
      db.exec(MIGRATIONS[index]);
      // `PRAGMA` does not accept a bound parameter, and the value is a loop
      // index rather than anything a request supplies.
      db.exec(`PRAGMA user_version = ${index + 1}`);
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  }
};

/**
 * Open the store, or return `null`.
 *
 * **Null is a supported state, not an error path.** `FOOTBALL_DATA_TOKEN` unset
 * already means "serve seed data and say so"; an unopenable account store means
 * the accounts feature is *absent* — no control renders, the routes 404 — rather
 * than broken. A fresh clone with an empty `.env` gets an app that works, minus
 * a feature it never mentions.
 */
export const openStore = (file: string): AccountStore | null => {
  let db: DatabaseSync;
  try {
    // SQLite creates the file but not the directory above it, and fails with a
    // bare "unable to open database file" that reads like a permissions
    // problem. Both real callers point at a directory that may not exist yet:
    // the host's `${DEPLOY_DIR}/data` before the first deploy that needs it,
    // and `./test-results` before Playwright has written anything.
    mkdirSync(path.dirname(file), { recursive: true });
    const DatabaseSyncCtor = loadDatabaseSync();
    db = new DatabaseSyncCtor(file);
    // Foreign keys are OFF by default in SQLite, which would quietly make
    // `ON DELETE CASCADE` above decorative — deleting an account would leave
    // its sessions behind, still valid, pointing at a row that is gone.
    db.exec("PRAGMA foreign_keys = ON");
    // WAL: readers do not block the writer. One process, but the health check
    // and a sign-in genuinely overlap.
    db.exec("PRAGMA journal_mode = WAL");
    migrate(db);
  } catch (error) {
    console.error("[accounts] store unavailable:", (error as Error).message);
    return null;
  }

  const insertAccount = db.prepare(
    `INSERT INTO accounts (id, provider, subject, display_name, created_at, last_seen_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  );
  const selectBySubject = db.prepare("SELECT * FROM accounts WHERE provider = ? AND subject = ?");
  const selectById = db.prepare("SELECT * FROM accounts WHERE id = ?");
  const touchAccount = db.prepare(
    "UPDATE accounts SET last_seen_at = ?, display_name = ? WHERE id = ?",
  );
  const insertSession = db.prepare(
    "INSERT INTO sessions (token_hash, account_id, created_at, expires_at) VALUES (?, ?, ?, ?)",
  );
  const selectSession = db.prepare("SELECT * FROM sessions WHERE token_hash = ?");
  const deleteSession = db.prepare("DELETE FROM sessions WHERE token_hash = ?");
  const deleteSessionsFor = db.prepare("DELETE FROM sessions WHERE account_id = ?");
  const deleteExpired = db.prepare("DELETE FROM sessions WHERE expires_at <= ?");
  const deleteAccountRow = db.prepare("DELETE FROM accounts WHERE id = ?");
  const selectPreferences = db.prepare("SELECT key, value FROM preferences WHERE account_id = ?");
  const upsertPreference = db.prepare(
    `INSERT INTO preferences (account_id, key, value, updated_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(account_id, key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
  );
  const deletePreference = db.prepare(
    "DELETE FROM preferences WHERE account_id = ? AND key = ?",
  );

  return {
    upsertAccount({ id, provider, subject, displayName, now }) {
      const existing = selectBySubject.get(provider, subject) as AccountRow | undefined;
      if (existing) {
        // The display name is refreshed on every sign-in rather than frozen at
        // first: somebody who changes their name at Google has changed it, and
        // this app has no field for them to correct it in.
        touchAccount.run(now, displayName, existing.id);
        return toAccount({ ...existing, last_seen_at: now, display_name: displayName });
      }

      insertAccount.run(id, provider, subject, displayName, now, now);
      return { id, provider, subject, displayName, createdAt: now, lastSeenAt: now };
    },

    findSession(tokenHash) {
      const row = selectSession.get(tokenHash) as
        | { token_hash: string; account_id: string; created_at: number; expires_at: number }
        | undefined;
      if (!row) return null;
      return {
        tokenHash: row.token_hash,
        accountId: row.account_id,
        createdAt: row.created_at,
        expiresAt: row.expires_at,
      };
    },

    findAccount(id) {
      const row = selectById.get(id) as AccountRow | undefined;
      return row ? toAccount(row) : null;
    },

    startSession(session) {
      insertSession.run(
        session.tokenHash,
        session.accountId,
        session.createdAt,
        session.expiresAt,
      );
    },

    replaceSession(oldHash, session) {
      db.exec("BEGIN");
      try {
        deleteSession.run(oldHash);
        insertSession.run(
          session.tokenHash,
          session.accountId,
          session.createdAt,
          session.expiresAt,
        );
        db.exec("COMMIT");
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }
    },

    endSession(tokenHash) {
      deleteSession.run(tokenHash);
    },

    endAllSessions(accountId) {
      deleteSessionsFor.run(accountId);
    },

    deleteAccount(accountId) {
      db.exec("BEGIN");
      try {
        deleteSessionsFor.run(accountId);
        deleteAccountRow.run(accountId);
        db.exec("COMMIT");
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }
    },

    readPreferences(accountId) {
      const rows = selectPreferences.all(accountId) as { key: string; value: string }[];
      return Object.fromEntries(rows.map((row) => [row.key, row.value]));
    },

    writePreference(accountId, key, value, now) {
      if (value === null) deletePreference.run(accountId, key);
      else upsertPreference.run(accountId, key, value, now);
    },

    pruneSessions(now) {
      return Number(deleteExpired.run(now).changes);
    },

    close() {
      db.close();
    },
  };
};
