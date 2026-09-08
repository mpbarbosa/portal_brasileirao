/**
 * **Acontecimentos** — what happened off the pitch, dated, in two scopes: the
 * whole division (`geral`) and one club (`clube`).
 *
 * Pure like every other `*-core` module: acontecimentos in, acontecimentos out
 * (`tests/events-core.test.ts`). The data is `src/data/events.ts`, a committed
 * file, so the section costs no request and cannot fail — `scouts-core.ts`'
 * arrangement.
 *
 * ## Nothing here ever constructs a `Date`, and that is the whole design
 *
 * An acontecimento's date is a **Brazil-local calendar day**, a string like
 * `"2026-03-15"`. `new Date("2026-03-15")` is midnight **UTC** by the language
 * spec, and formatting that in a browser west of Greenwich prints **14 March**
 * — so the one obvious way to render this field is off by a day for every
 * reader in Brazil, which is every reader this app has. It would also print
 * correctly on a workstation in UTC and in CI, so nothing would go red.
 *
 * So the labels are built by **indexing a month table with the digits of the
 * string**, and the comparisons are ordinary string comparisons, which are
 * correct on ISO dates by construction and carry no zone at all. The one place
 * a real instant enters is `brasiliaDay`, which is the bridge and is named for
 * what it does.
 *
 * That is the same failure `live-core.ts` refuses for the match minute and
 * `goals-core.ts` for the goal minute: a precise-looking number the source does
 * not support. Here the source supports a *day*, and only a day.
 */
import type { ClubCode, SeasonEvent } from "@/src/types";

/** `YYYY-MM-DD`. Anything else is not a day and is treated as absent. */
const DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

const MONTHS = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

/**
 * The Brazil-local calendar day of an instant, as `YYYY-MM-DD`.
 *
 * **The only bridge between an instant and a day in this module**, and it goes
 * through `Intl` with an explicit `timeZone` rather than through the host's
 * offset: a workstation, a CI runner and the deployed host all run UTC, so
 * anything reading the *local* offset would agree with itself everywhere it is
 * tested and disagree with every reader.
 *
 * `en-CA` is not a language choice — it is the locale whose short date format
 * is already ISO, so the parts come out in the order this module reads them.
 *
 * **America/Sao_Paulo, and the app has clubs outside it.** Manaus is UTC-4 and
 * Rio Branco UTC-5, so a reader there is up to two hours from this clock. That
 * is deliberate rather than overlooked: an acontecimento is dated by the press
 * that reports it, and Brazilian football is reported on Brasília time — the
 * same clock `Cruzeiro demite Tite` is filed under. Dating it per reader would
 * make one event two different days depending on who opened the page.
 */
export const brasiliaDay = (now: Date): string =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);

/** Whether an acontecimento is one this club's reader should see. */
export const touchesClub = (event: SeasonEvent, clubCode: ClubCode): boolean =>
  event.scope === "geral" || event.clubCode === clubCode;

/**
 * One club's **Linha do tempo**: its own acontecimentos and every general one,
 * newest first.
 *
 * **The general ones are merged in rather than listed apart, and that is what
 * `geral` means.** An acontecimento that touches all twenty clubs belongs in
 * all twenty timelines; a second section headed "e também, em geral…" would be
 * asking the reader to interleave two lists by date themselves.
 *
 * **Newest first**, which is the club page's own convention for `played` —
 * "on a club page the latest result is the headline".
 *
 * **A range sorts by where it STARTS**, not by where it ends and not by
 * whether it is still running. A paralisação that began in June sits between
 * May and July, which is where a reader scanning for June expects it; sorting
 * an open-ended range to the top would put a five-week hole above a sacking
 * that happened last week.
 *
 * **Ties break on `id`, and the tie-break is not decoration.** Two clubs can
 * sack a técnico on one day, and `Array.prototype.sort` is only stable with
 * respect to the *input* order — so without this the rendered order would be
 * the order somebody happened to append to `src/data/events.ts`, and a spec
 * asserting it would go red on an unrelated edit.
 */
export const clubTimeline = (events: SeasonEvent[], clubCode: ClubCode): SeasonEvent[] =>
  events
    // `filter` already returns a new array, so nothing here mutates the
    // caller's — which `tests/events-core.test.ts` asserts rather than leaving
    // to a reader to re-derive from the absence of a `.slice()`.
    .filter((event) => touchesClub(event, clubCode))
    .sort((a, b) => (a.date === b.date ? a.id.localeCompare(b.id) : a.date < b.date ? 1 : -1));

/**
 * What a general acontecimento is captioned with, and **null for a club one**.
 *
 * The club page has already said whose page this is, so "Cruzeiro" under a
 * Cruzeiro sacking is the heading again — `playerPositionLabel`'s rule for a
 * broad position under a heading that names it. What a reader cannot infer is
 * that the paralisação is not about this club in particular, so that is the
 * one that gets words.
 */
export const scopeLabel = (event: SeasonEvent): string | null =>
  event.scope === "geral" ? "Todo o Brasileirão" : null;

/** `"2026-03-15"` → `"15 de março de 2026"`. Null for anything not a day. */
export const dayLabel = (day: string): string | null => {
  const parts = DAY.exec(day);
  if (!parts) return null;
  const month = MONTHS[Number(parts[2]) - 1];
  if (!month) return null;
  return `${Number(parts[3])} de ${month} de ${Number(parts[1])}`;
};

/** `"2026-06-01"` → `"1 de junho"`. The year is dropped where the span states it. */
const shortDayLabel = (day: string): string | null => {
  const parts = DAY.exec(day);
  if (!parts) return null;
  const month = MONTHS[Number(parts[2]) - 1];
  if (!month) return null;
  return `${Number(parts[3])} de ${month}`;
};

/**
 * The bare host of an entry's `source` — `"ge.globo.com"` — with `www.`
 * dropped.
 *
 * The section prints **who reported it** rather than the word "fonte", which is
 * this app's rule for every external link it renders: "each link reads as the
 * thing itself — a bare host, a bare handle, a name". It is also the whole of
 * what provenance is worth to a reader; the address behind it is the rest.
 *
 * Null rather than a fragment where the value is not a URL, so a mistyped
 * entry renders no link instead of a link to nowhere. Nothing constructs the
 * address from this: the `href` stays the stored string, so the words and the
 * destination cannot come to name two different sites — `InstagramLink`'s rule
 * for its `@handle`.
 */
export const sourceHost = (source: string): string | null => {
  try {
    const { protocol, hostname } = new URL(source);
    if (protocol !== "https:" && protocol !== "http:") return null;
    return hostname.replace(/^www\./, "") || null;
  } catch {
    return null;
  }
};

export interface EventSpan {
  /** A single day, a closed range, or a range that has not ended yet. */
  kind: "dia" | "periodo" | "em-curso";
  /** What the section prints. Never null for an entry whose `date` parses. */
  label: string;
  /** Whole days the range covers, both ends included. Null for a single day. */
  days: number | null;
}

const MS_PER_DAY = 86_400_000;

/**
 * How long an acontecimento lasted, and how to say so.
 *
 * **`today` is a parameter**, like `now` in `currentRound`, `liveBoard` and
 * `clubFocus` — nothing here reads the clock — and it is a **day** rather than
 * an instant, so a caller has to go through `brasiliaDay` and cannot
 * accidentally compare a São Paulo evening against a UTC tomorrow.
 *
 * Three states, and the clock separates only the last two:
 *
 * - **No `endDate` at all is a DAY**, always. A sacking never had an end.
 * - **An `endDate` still ahead is a span in progress** — "desde 1 de junho".
 * - **An `endDate` already passed is a closed span** — "de 1 de junho a 15 de
 *   julho", with the count of days it covered.
 *
 * **A span whose end is genuinely unknown is not representable, and that is a
 * decision rather than a gap.** Making an absent `endDate` mean "a day" for a
 * sacking and "still running" for a paralisação would be one field carrying two
 * meanings, told apart by a guess about which kind of thing the entry is. A
 * paralisação is *scheduled*, so its return date is known before it starts —
 * the one this file ships had both ends published months in advance. An
 * acontecimento whose end nobody knows is recorded as the day it began.
 *
 * Note what this never does: **it never invents an end.** A span in progress
 * reads "desde 1 de junho" rather than "de 1 de junho até hoje", which would
 * claim the acontecimento finishes the moment the page is read.
 */
export const eventSpan = (event: SeasonEvent, today: string): EventSpan | null => {
  const start = dayLabel(event.date);
  if (!start) return null;

  // No end recorded, or one that does not parse: a day. An unreadable
  // `endDate` degrades to the start rather than to nothing, so a typo costs
  // the span and never the whole entry.
  const end = event.endDate ? dayLabel(event.endDate) : null;
  if (!event.endDate || !end) return { kind: "dia", label: start, days: null };

  // A span whose end has not arrived is still running, and says so rather
  // than printing a last day the reader has not reached.
  if (today < event.endDate) {
    const since = shortDayLabel(event.date);
    return { kind: "em-curso", label: `desde ${since ?? start}`, days: null };
  }

  const from = shortDayLabel(event.date) ?? start;
  const days = Math.round((Date.parse(`${event.endDate}T00:00:00Z`) -
    Date.parse(`${event.date}T00:00:00Z`)) / MS_PER_DAY) + 1;
  return { kind: "periodo", label: `de ${from} a ${end}`, days };
};
