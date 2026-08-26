/**
 * The **Saúde do serviço**: what `/api/health` reports about the process that
 * answered, turned into the pt-BR the **Rodapé** renders. Pure — a payload in,
 * strings out (tests/health-core.test.ts).
 *
 * `/api/health` is the one endpoint that is deliberately **not** an
 * `ApiEnvelope`: it describes the process rather than the championship, so it
 * has no `source`, no `note` and nothing to degrade to. That also makes it the
 * one payload the client cannot assume it understands — a host still serving
 * last week's bundle answers the shape *that* build emitted, and a footer is
 * not worth a blank page. Hence `parseHealth`, which narrows field by field and
 * lets every field but the status be absent; the rodapé then omits a line
 * rather than printing `undefined`, which is the same contract the player card
 * keeps for a fact the provider did not send.
 */

import type { Health } from "@/src/types";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

/** A non-empty string, or nothing. `""` is an absent value, not a short one. */
const text = (value: unknown): string | null =>
  typeof value === "string" && value.trim() !== "" ? value.trim() : null;

const finite = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

/**
 * Narrow an unknown `/api/health` body.
 *
 * `null` when there is no status to report — the endpoint's whole answer is
 * "the process is up and here is what it is", and a body without a status is
 * not that answer. Everything else is optional on purpose: running from source
 * there is no build time, and a future field this build does not know about
 * rides along ignored rather than failing the parse.
 */
export const parseHealth = (value: unknown): Health | null => {
  if (!isRecord(value)) return null;

  const status = text(value.status);
  if (status === null) return null;

  return {
    status,
    sha: text(value.sha),
    builtAt: text(value.builtAt),
    uptime: finite(value.uptime),
    provider: text(value.provider),
  };
};

/** Whether the readout should render as reassuring rather than as alarming. */
export const isHealthy = (health: Health): boolean => health.status === "ok";

/**
 * The status as a reader reads it.
 *
 * An unrecognised status is shown **verbatim**, the same rule `positionLabel`
 * and `nationalityLabel` follow: the raw word serves a reader better than
 * nothing and is a visible prompt to add the row here.
 */
export const healthStatusLabel = (status: string): string =>
  status === "ok" ? "no ar" : status;

/**
 * Where the app is **configured** to get its data — not where the last request
 * actually came from.
 *
 * The distinction is the reason this does not say "dados ao vivo". `/api/health`
 * reports whether a token is present and the kill switch is off; whether the
 * upstream answered a minute ago is what the envelope's `source` says, and the
 * banner above already carries that when it is not live. Claiming "ao vivo"
 * here would contradict a `fallback` banner three lines up.
 */
const PROVIDER_LABELS: Record<string, string> = {
  "football-data": "football-data.org",
  seed: "dados locais",
};

export const providerLabel = (provider: string | null): string | null =>
  provider === null ? null : (PROVIDER_LABELS[provider] ?? provider);

/**
 * The commit as a version, short enough to read and long enough to find.
 *
 * Seven characters is what `git log --oneline` prints and what a paste into
 * `git show` resolves. Anything that is not a hex sha is passed through whole —
 * running from source the server answers `dev`, and truncating that to `dev`
 * by luck rather than by rule is how `develop` would one day render as `dev`.
 */
export const shortSha = (sha: string | null): string | null => {
  if (sha === null) return null;
  return /^[0-9a-f]{7,40}$/i.test(sha) ? sha.slice(0, 7).toLowerCase() : sha;
};

/**
 * The instant the process started, as an ISO string.
 *
 * The endpoint reports **how long** it has been up; the rodapé shows **since
 * when**, which is the same fact read at the moment the payload arrived. Two
 * reasons for the conversion, and the second is the load-bearing one:
 *
 * - "no ar desde 26/08 03:10" answers "did it restart?" directly, where
 *   "no ar há 5 h 12 min" makes the reader do the subtraction.
 * - An elapsed label is different every time it is rendered, and one of the
 *   committed screenshots is a full-page capture of the home route. A band of
 *   text that changes between two captures of the *same build* is noise every
 *   refresh then commits — the failure `settle` was written for. An instant is
 *   fixed for the life of the process, so the same running server photographs
 *   identically.
 *
 * Read once, when the payload lands, rather than per render: `now` moves and
 * `uptime` does not, so recomputing would walk the answer forward second by
 * second and undo exactly the stability above.
 */
export const startInstant = (uptimeSeconds: number | null, readAt: number): string | null => {
  if (uptimeSeconds === null || uptimeSeconds < 0) return null;

  const started = new Date(readAt - uptimeSeconds * 1000);
  return Number.isNaN(started.getTime()) ? null : started.toISOString();
};
