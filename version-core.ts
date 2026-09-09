/**
 * version-core.ts
 * ---------------
 * Whether the bundle a reader is running is still the bundle this host serves,
 * and what to do about it. Pure — two shas and two facts in, a verdict out
 * (tests/version-core.test.ts).
 *
 * It exists because `main` deploys itself here, several times on a busy
 * evening, and a page already open goes on running whatever it loaded. The
 * shell is revalidated on every navigation (an ETag and no `Cache-Control`)
 * and the assets are content-hashed, so a **reload** always lands on the new
 * version — nobody had to ask for one. A reader watching a match finish is
 * exactly the reader least likely to.
 *
 * `health-core.ts` is the neighbour and not the home for this: that module
 * turns `/api/health` into the pt-BR the Rodapé prints, where this compares
 * what it says against what the client is. The Rodapé's `Versão` line and this
 * verdict read the same field for opposite purposes — one reports, one acts —
 * and an action that can throw a reader's page away does not belong inside a
 * footer's formatter.
 *
 * **The comparison is the SERVER's sha against the CLIENT's own build sha, and
 * not against a previous reading of the server.** Watching `/api/health` change
 * would answer *did the host restart*, which is a different question with a
 * worse failure: a restart on the same commit (a `systemctl restart`, an OOM,
 * an `.env` edit) would reload every open page for a version nobody shipped,
 * and a reader who arrives mid-deploy — already stale when their first reading
 * was taken — would never see a change at all and never update. Comparing the
 * two builds is stateless, so it is right on the first reading.
 */

/** What a reading of the two shas licenses. */
export type VersionVerdict =
  /** The bundle running is the one this host serves. Nothing to do. */
  | "current"
  /** One of the two shas is missing. No claim either way, so no reload. */
  | "unknown"
  /** A different version is being served, and now is a fine moment to take it. */
  | "stale"
  /** A different version is being served, and the reader is busy. Ask again. */
  | "deferred"
  /** A reload was already spent on this sha and did not take. Stop asking. */
  | "stuck";

export interface VersionReading {
  /** The commit this bundle was built from, or null running from source. */
  client: string | null;
  /** The commit the process that answered `/api/health` was built from. */
  server: string | null;
  /**
   * The server sha a reload has already been spent on, if any.
   *
   * The loop guard, and it is not hypothetical: anything that pins the client
   * to an old bundle — a proxy holding the shell, a half-finished rsync, a
   * `dist/` whose HTML and assets disagree — makes a reload land on the same
   * mismatch it was trying to fix, and an ungated rule then reloads for ever,
   * at whatever the poll interval is, in every open tab. One attempt per sha
   * is enough: the reload either takes, or the situation needs a person.
   */
  reloadedFor: string | null;
  /**
   * Whether the page may be thrown away right now.
   *
   * A reload costs a reader their scroll position and anything they have
   * opened. This app holds no unsaved text anywhere — preferences go to the
   * account as they are set — so the cost is small, but it is not nothing, and
   * a reader who has deliberately opened the player card is mid-gesture. False
   * defers rather than cancels; the next check asks again.
   */
  canInterrupt: boolean;
}

/**
 * Normalise a sha for comparison.
 *
 * `""` is an absent value rather than a short one, which is `parseHealth`'s
 * rule for every string it narrows. Case is folded because the two shas are
 * stamped by two different tools — `git rev-parse --short` for the server and
 * the same string handed to Vite for the client — and a comparison that a
 * change of case could break is one nobody would think to test.
 *
 * Nothing here validates the shape. A build stamps `unknown` where there is no
 * git dir and `<sha>-dirty` over uncommitted work, and both are legitimate
 * values to compare: two builds of the same dirty tree agree, and a dirty
 * client against a clean server is a genuine difference worth reloading for.
 */
const normalise = (sha: string | null): string | null => {
  if (typeof sha !== "string") return null;
  const trimmed = sha.trim().toLowerCase();
  return trimmed === "" ? null : trimmed;
};

/**
 * What to do about the version the reader is running.
 *
 * The order of the branches is the whole of the logic, and two of them are
 * load-bearing:
 *
 * - **`unknown` comes first**, so a missing sha can never be read as a
 *   difference. Running from source both sides answer `dev` and agree, but a
 *   host serving a build older than this feature answers a payload with no
 *   `sha` at all — and treating absent as "different" would put every reader
 *   of that deploy into a reload loop against a server that cannot ever agree.
 *   An absent value is not evidence of anything.
 * - **`stuck` is tested before `deferred`**, because a reload that has already
 *   failed for this sha is not worth waiting for a quiet moment to repeat.
 */
export const versionVerdict = (reading: VersionReading): VersionVerdict => {
  const client = normalise(reading.client);
  const server = normalise(reading.server);

  if (client === null || server === null) return "unknown";
  if (client === server) return "current";
  if (normalise(reading.reloadedFor) === server) return "stuck";
  if (!reading.canInterrupt) return "deferred";

  return "stale";
};

/** Whether a verdict says to reload now. The one caller that acts on it. */
export const shouldReload = (verdict: VersionVerdict): boolean => verdict === "stale";
