import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, test } from "node:test";

import { openStore, type AccountStore } from "@/account-store";
import { SESSION_TTL_MS } from "@/session-core";

/**
 * The one test file here that does real I/O, because the module under test is
 * the one whose whole job is I/O. Every *rule* it enforces — expiry, renewal,
 * claim checking — is tested in the pure cores without a database.
 *
 * On disk rather than `:memory:`: the things worth catching are the ones an
 * in-memory database does not have, starting with whether `PRAGMA foreign_keys`
 * was actually turned on.
 */
const dir = mkdtempSync(path.join(tmpdir(), "pb-accounts-"));
after(() => rmSync(dir, { recursive: true, force: true }));

let counter = 0;
const freshStore = (): AccountStore => {
  counter += 1;
  const store = openStore(path.join(dir, `accounts-${counter}.db`));
  assert.ok(store, "store should open");
  return store;
};

const NOW = 1_700_000_000_000;

const signIn = (store: AccountStore, subject = "sub-1", name = "Ana") =>
  store.upsertAccount({
    id: `acc_${subject}`,
    provider: "google",
    subject,
    displayName: name,
    now: NOW,
  });

test("an unopenable path is null, not a throw — the feature is absent, not broken", () => {
  // `docs/accounts.md` §3.9: an unopenable store must mean the feature is
  // simply *absent*, the way an unset FOOTBALL_DATA_TOKEN means seed data.
  //
  // Provoked with a regular file standing where a directory has to be, rather
  // than with a merely absent directory. An absent one does not provoke it:
  // `openStore` deliberately creates a missing directory (the test below), so
  // `/nonexistent-directory-pb/accounts.db` — what this asserted first — is
  // unopenable only for a uid that cannot mkdir at `/`. That passed on CI's
  // unprivileged runner and failed for anyone developing in a root container,
  // which is a result that tracks the uid of whoever ran it rather than the
  // contract being claimed.
  //
  // Resolving a path *through* a regular file is ENOTDIR for every uid: root's
  // CAP_DAC_OVERRIDE relaxes permission checks, and this is not one. Note the
  // extra segment is load-bearing — naming the file directly as the parent
  // throws EEXIST from Node's own recursive-mkdir bookkeeping instead, which
  // is a weaker thing to rest this on than kernel path resolution.
  const notADirectory = path.join(dir, "not-a-directory");
  writeFileSync(notADirectory, "");

  assert.equal(openStore(path.join(notADirectory, "sub", "accounts.db")), null);
});

test("a missing directory is created rather than refused — the fresh-host case", () => {
  // The counterpart to the rule above, and the reason it cannot be provoked by
  // an absent directory. `account-store.ts` mkdirs deliberately because both
  // real callers name one that may not exist yet: the host's
  // `${DEPLOY_DIR}/data` before the first deploy (`docs/accounts.md` §3.2), and
  // `./test-results` before Playwright has written anything (§3.11).
  //
  // Pinned here so that a future reader who meets the test above does not
  // "fix" it by deleting the mkdir, which would leave a fresh host with the
  // accounts feature silently absent.
  const store = openStore(path.join(dir, "absent", "nested", "accounts.db"));
  assert.ok(store, "a store beneath a missing directory must open, not return null");
  store.close();
});

test("the same provider subject signs in to the same account", () => {
  const store = freshStore();
  const first = signIn(store);
  const second = store.upsertAccount({
    id: "acc_would_be_new",
    provider: "google",
    subject: "sub-1",
    displayName: "Ana",
    now: NOW + 1000,
  });

  assert.equal(second.id, first.id, "a second sign-in must not mint a second account");
  assert.equal(second.lastSeenAt, NOW + 1000);
});

test("a name changed at Google is a name changed here", () => {
  const store = freshStore();
  signIn(store, "sub-1", "Ana");
  const renamed = signIn(store, "sub-1", "Ana Torcedora");
  assert.equal(renamed.displayName, "Ana Torcedora");
  assert.equal(store.findAccount(renamed.id)?.displayName, "Ana Torcedora");
});

test("two providers reporting the same subject are two people", () => {
  const store = freshStore();
  const google = store.upsertAccount({
    id: "acc_g",
    provider: "google",
    subject: "shared",
    displayName: "A",
    now: NOW,
  });
  const dev = store.upsertAccount({
    id: "acc_d",
    provider: "dev",
    subject: "shared",
    displayName: "B",
    now: NOW,
  });
  assert.notEqual(google.id, dev.id);
});

test("a session round-trips by its hash and nothing else", () => {
  const store = freshStore();
  const account = signIn(store);
  store.startSession({
    tokenHash: "hash-1",
    accountId: account.id,
    createdAt: NOW,
    expiresAt: NOW + SESSION_TTL_MS,
  });

  assert.equal(store.findSession("hash-1")?.accountId, account.id);
  assert.equal(store.findSession("hash-unknown"), null);
});

test("renewal replaces the token rather than extending it", () => {
  const store = freshStore();
  const account = signIn(store);
  store.startSession({
    tokenHash: "old",
    accountId: account.id,
    createdAt: NOW,
    expiresAt: NOW + 10,
  });

  store.replaceSession("old", {
    tokenHash: "new",
    accountId: account.id,
    createdAt: NOW + 5,
    expiresAt: NOW + SESSION_TTL_MS,
  });

  // A renewed session must not keep a value that has been in flight for a month.
  assert.equal(store.findSession("old"), null);
  assert.equal(store.findSession("new")?.accountId, account.id);
});

test("signing out everywhere ends every session, which is why sessions are rows", () => {
  const store = freshStore();
  const account = signIn(store);
  for (const hash of ["phone", "laptop", "work"]) {
    store.startSession({
      tokenHash: hash,
      accountId: account.id,
      createdAt: NOW,
      expiresAt: NOW + SESSION_TTL_MS,
    });
  }

  store.endSession("phone");
  assert.equal(store.findSession("phone"), null);
  assert.ok(store.findSession("laptop"));

  store.endAllSessions(account.id);
  assert.equal(store.findSession("laptop"), null);
  assert.equal(store.findSession("work"), null);
});

test("deleting an account really deletes it, and takes its sessions with it", () => {
  const store = freshStore();
  const account = signIn(store);
  store.startSession({
    tokenHash: "hash-1",
    accountId: account.id,
    createdAt: NOW,
    expiresAt: NOW + SESSION_TTL_MS,
  });

  store.deleteAccount(account.id);

  // The LGPD erasure right is a delete, not a flag. A session left behind
  // would still authenticate a row that no longer exists.
  assert.equal(store.findAccount(account.id), null);
  assert.equal(store.findSession("hash-1"), null);
});

test("expired sessions are pruned, and live ones are not", () => {
  const store = freshStore();
  const account = signIn(store);
  store.startSession({
    tokenHash: "dead",
    accountId: account.id,
    createdAt: NOW - SESSION_TTL_MS,
    expiresAt: NOW - 1,
  });
  store.startSession({
    tokenHash: "alive",
    accountId: account.id,
    createdAt: NOW,
    expiresAt: NOW + SESSION_TTL_MS,
  });

  assert.equal(store.pruneSessions(NOW), 1);
  assert.equal(store.findSession("dead"), null);
  assert.ok(store.findSession("alive"));
});

test("the schema survives being opened twice — migrations are idempotent", () => {
  counter += 1;
  const file = path.join(dir, `reopen-${counter}.db`);

  const first = openStore(file);
  assert.ok(first);
  first.upsertAccount({
    id: "acc_1",
    provider: "google",
    subject: "sub-1",
    displayName: "Ana",
    now: NOW,
  });
  first.close();

  const second = openStore(file);
  assert.ok(second, "reopening a migrated database must not fail");
  assert.equal(second.findAccount("acc_1")?.displayName, "Ana");
  second.close();
});


test("a preference round-trips, and clearing it removes the row", () => {
  const store = freshStore();
  const account = signIn(store);

  store.writePreference(account.id, "preferences", '{"club":"1769"}', NOW);
  assert.deepEqual(store.readPreferences(account.id), { preferences: '{"club":"1769"}' });

  // null deletes rather than storing a null, so "follows nobody" and "has never
  // chosen" are the same state — which is what planSync assumes when it decides
  // whether a device may seed the account.
  store.writePreference(account.id, "preferences", null, NOW);
  assert.deepEqual(store.readPreferences(account.id), {});
});

test("writing the same key twice replaces rather than duplicating", () => {
  const store = freshStore();
  const account = signIn(store);

  store.writePreference(account.id, "preferences", '{"club":"1769"}', NOW);
  store.writePreference(account.id, "preferences", '{"club":"1783"}', NOW + 1);
  assert.deepEqual(store.readPreferences(account.id), { preferences: '{"club":"1783"}' });
});

test("deleting an account takes its preferences with it", () => {
  // The cascade is only real because PRAGMA foreign_keys is ON — off, this
  // assertion is what would fail.
  const store = freshStore();
  const account = signIn(store);
  store.writePreference(account.id, "preferences", '{"club":"1769"}', NOW);

  store.deleteAccount(account.id);
  assert.deepEqual(store.readPreferences(account.id), {});
});

test("one account's preferences are invisible to another", () => {
  const store = freshStore();
  const ana = signIn(store, "sub-ana", "Ana");
  const bruno = signIn(store, "sub-bruno", "Bruno");

  store.writePreference(ana.id, "preferences", '{"club":"1769"}', NOW);
  assert.deepEqual(store.readPreferences(bruno.id), {});
});
