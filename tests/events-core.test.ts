import assert from "node:assert/strict";
import { test } from "node:test";

import {
  brasiliaDay,
  clubTimeline,
  dayLabel,
  eventSpan,
  numericDayLabel,
  scopeLabel,
  sourceHost,
  touchesClub,
} from "@/events-core";
import { CLUBS } from "@/src/data/clubs";
import { SEASON_EVENTS } from "@/src/data/events";
import { SNAPSHOT_DATE } from "@/src/data/matches";
import type { SeasonEvent } from "@/src/types";

const geral = (id: string, date: string, endDate?: string): SeasonEvent => ({
  id,
  scope: "geral",
  date,
  ...(endDate ? { endDate } : {}),
  title: id,
  source: "https://example.test/",
});

const clube = (id: string, clubCode: string, date: string): SeasonEvent => ({
  id,
  scope: "clube",
  clubCode,
  date,
  title: id,
  source: "https://example.test/",
});

// ── touchesClub / clubTimeline ────────────────────────────────────────────

test("a general acontecimento touches every club", () => {
  const event = geral("halt", "2026-06-01");
  assert.equal(touchesClub(event, "1771"), true);
  assert.equal(touchesClub(event, "1783"), true);
});

test("a club acontecimento touches only its own club", () => {
  const event = clube("tite", "1771", "2026-03-15");
  assert.equal(touchesClub(event, "1771"), true);
  assert.equal(touchesClub(event, "1783"), false);
});

test("a club timeline merges the general ones in, newest first", () => {
  const events = [
    clube("tite", "1771", "2026-03-15"),
    geral("halt", "2026-06-01"),
    clube("dorival", "1779", "2026-04-05"),
  ];
  assert.deepEqual(
    clubTimeline(events, "1771").map((e) => e.id),
    ["halt", "tite"],
  );
});

test("another club's acontecimentos are left out", () => {
  const events = [clube("tite", "1771", "2026-03-15"), clube("dorival", "1779", "2026-04-05")];
  assert.deepEqual(clubTimeline(events, "1779").map((e) => e.id), ["dorival"]);
});

test("a range sorts by where it starts, not by where it ends", () => {
  // The halt runs 1 June to 15 July; the sacking is 13 August. Ordering by the
  // END would still put the sacking first here, so the case that separates the
  // two rules is one where the range's end passes the later entry.
  const events = [
    geral("halt", "2026-06-01", "2026-09-30"),
    clube("zubeldia", "1765", "2026-08-13"),
  ];
  assert.deepEqual(
    clubTimeline(events, "1765").map((e) => e.id),
    ["zubeldia", "halt"],
  );
});

test("two acontecimentos on one day order by id, whatever order they arrive in", () => {
  const a = clube("alfa", "1771", "2026-03-15");
  const b = clube("beta", "1771", "2026-03-15");
  assert.deepEqual(clubTimeline([b, a], "1771").map((e) => e.id), ["alfa", "beta"]);
  assert.deepEqual(clubTimeline([a, b], "1771").map((e) => e.id), ["alfa", "beta"]);
});

test("clubTimeline does not reorder its input", () => {
  const events = [clube("beta", "1771", "2026-01-01"), clube("alfa", "1771", "2026-05-01")];
  clubTimeline(events, "1771");
  assert.deepEqual(events.map((e) => e.id), ["beta", "alfa"]);
});

// ── labels ────────────────────────────────────────────────────────────────

test("a day is written out in pt-BR, with no leading zero", () => {
  assert.equal(dayLabel("2026-03-15"), "15 de março de 2026");
  assert.equal(dayLabel("2026-06-01"), "1 de junho de 2026");
});

test("a day that is not a day is null rather than a guess", () => {
  assert.equal(dayLabel("2026-03"), null);
  assert.equal(dayLabel("15/03/2026"), null);
  assert.equal(dayLabel("2026-13-01"), null);
  assert.equal(dayLabel(""), null);
});

test("only a general acontecimento is captioned; a club one says nothing", () => {
  assert.equal(scopeLabel(geral("halt", "2026-06-01")), "Todo o Brasileirão");
  assert.equal(scopeLabel(clube("tite", "1771", "2026-03-15")), null);
});

// ── eventSpan ─────────────────────────────────────────────────────────────

test("an acontecimento with no end is a day, whether it is past or future", () => {
  const past = eventSpan(clube("tite", "1771", "2026-03-15"), "2026-09-08");
  assert.deepEqual(past, { kind: "dia", label: "15 de março de 2026", days: null });
  const ahead = eventSpan(clube("later", "1771", "2026-12-01"), "2026-09-08");
  assert.equal(ahead?.kind, "dia");
});

test("a closed span reads from one day to the other and counts both ends", () => {
  const span = eventSpan(geral("halt", "2026-06-01", "2026-07-15"), "2026-09-08");
  assert.equal(span?.kind, "periodo");
  assert.equal(span?.label, "de 1 de junho a 15 de julho de 2026");
  // 1 June to 15 July inclusive: 30 + 15.
  assert.equal(span?.days, 45);
});

test("a span whose end has not arrived says 'desde' and never invents an end", () => {
  const span = eventSpan(geral("halt", "2026-06-01", "2026-07-15"), "2026-06-20");
  assert.equal(span?.kind, "em-curso");
  assert.equal(span?.label, "desde 1 de junho");
  assert.equal(span?.days, null);
  assert.ok(!span?.label.includes("hoje"));
});

test("a span closes on its own last day rather than the day after", () => {
  const event = geral("halt", "2026-06-01", "2026-07-15");
  assert.equal(eventSpan(event, "2026-07-14")?.kind, "em-curso");
  assert.equal(eventSpan(event, "2026-07-15")?.kind, "periodo");
});

test("an unreadable endDate costs the span and never the whole entry", () => {
  const span = eventSpan({ ...geral("halt", "2026-06-01"), endDate: "15/07/2026" }, "2026-09-08");
  assert.deepEqual(span, { kind: "dia", label: "1 de junho de 2026", days: null });
});

test("an unreadable date is null, not a rendered fragment", () => {
  assert.equal(eventSpan(geral("bad", "junho de 2026"), "2026-09-08"), null);
});

// ── brasiliaDay ───────────────────────────────────────────────────────────

/**
 * **This test SETS the host's zone rather than inheriting it, and the first
 * version of it was worthless on the machine it was written on.**
 *
 * Deleting the explicit `timeZone` from `brasiliaDay` is the one mutation that
 * matters — it makes the function report the *host's* day — and the obvious
 * assertion passed against it here, because this workstation is already on
 * `-03`. It would have gone red in CI, which runs UTC, so the bug's visibility
 * depended on which machine asked. That is `rehearse-sync-schedule.sh`'s
 * inherited-environment failure in a unit test: hermetic, and still answering
 * differently in two places.
 *
 * Sweeping four zones is what makes the mutation die everywhere. `2026-03-16T01:20Z`
 * is 22:20 on the **15th** in São Paulo — the shape of the very fixture that
 * dates the Cruzeiro entry, and the reason nothing in this module turns a day
 * into an instant.
 */
test("brasiliaDay reports the Brazilian day whatever zone the HOST is in", () => {
  const original = process.env.TZ;
  try {
    for (const tz of ["UTC", "Asia/Tokyo", "America/Los_Angeles", "America/Sao_Paulo"]) {
      process.env.TZ = tz;
      assert.equal(brasiliaDay(new Date("2026-03-16T01:20:00Z")), "2026-03-15", `TZ=${tz}`);
      assert.equal(brasiliaDay(new Date("2026-03-15T23:30:00Z")), "2026-03-15", `TZ=${tz}`);
      assert.equal(brasiliaDay(new Date("2026-03-16T03:00:00Z")), "2026-03-16", `TZ=${tz}`);
    }
  } finally {
    if (original === undefined) delete process.env.TZ;
    else process.env.TZ = original;
  }
});

// ── gates over the curated file ───────────────────────────────────────────
//
// These are about `src/data/events.ts` rather than about the code, the way
// `tests/player-photos.test.ts` asserts the data: the compiler is satisfied by
// an empty string, which renders on the page as a missing attribution — or
// here, as a row nobody can trace.

test("every id is unique", () => {
  const ids = SEASON_EVENTS.map((e) => e.id);
  assert.equal(new Set(ids).size, ids.length);
});

test("every club acontecimento names a club this app has", () => {
  const codes = new Set(CLUBS.map((c) => c.code));
  for (const event of SEASON_EVENTS) {
    if (event.scope !== "clube") continue;
    assert.ok(
      codes.has(event.clubCode),
      `${event.id} names club ${event.clubCode}, which is not in clubs.ts`,
    );
  }
});

test("every date is a readable day, and every endDate is not before it", () => {
  for (const event of SEASON_EVENTS) {
    assert.ok(dayLabel(event.date), `${event.id} has an unreadable date`);
    if (event.endDate === undefined) continue;
    assert.ok(dayLabel(event.endDate), `${event.id} has an unreadable endDate`);
    assert.ok(event.endDate >= event.date, `${event.id} ends before it starts`);
  }
});

test("every entry carries a title and an https source", () => {
  for (const event of SEASON_EVENTS) {
    assert.ok(event.title.trim().length > 0, `${event.id} has no title`);
    assert.ok(
      event.source.startsWith("https://"),
      `${event.id} has no https source — an entry nobody can trace`,
    );
  }
});

test("both scopes are actually present", () => {
  // Emptying the file must not make every gate above pass vacuously — the rule
  // `tests/e2e/coaches.spec.ts` follows for the overrides it checks.
  assert.ok(SEASON_EVENTS.some((e) => e.scope === "geral"));
  assert.ok(SEASON_EVENTS.some((e) => e.scope === "clube"));
});

test("a club may hold more than one acontecimento, so nothing keys on the club", () => {
  // Chapecoense and Botafogo each changed técnico twice in 2026. A record keyed
  // by club — the shape every other curated file here uses — would silently
  // keep one of the two.
  const byClub = new Map<string, number>();
  for (const event of SEASON_EVENTS) {
    if (event.scope !== "clube") continue;
    byClub.set(event.clubCode, (byClub.get(event.clubCode) ?? 0) + 1);
  }
  assert.ok([...byClub.values()].some((n) => n > 1));
});

// ── sourceHost ────────────────────────────────────────────────────────────

test("a source is named by its bare host, without www", () => {
  assert.equal(
    sourceHost("https://ge.globo.com/futebol/times/cruzeiro/noticia/2026/03/15/x.ghtml"),
    "ge.globo.com",
  );
  assert.equal(sourceHost("https://www.lance.com.br/botafogo/x.html"), "lance.com.br");
});

test("a source that is not an http(s) URL renders no link rather than a broken one", () => {
  assert.equal(sourceHost("ge.globo.com/x"), null);
  assert.equal(sourceHost(""), null);
  assert.equal(sourceHost("javascript:alert(1)"), null);
});

test("every entry's source names a host", () => {
  for (const event of SEASON_EVENTS) {
    assert.ok(sourceHost(event.source), `${event.id}'s source does not parse`);
  }
});

test("a day reads as dd/mm/aaaa inside a sentence", () => {
  assert.equal(numericDayLabel("2026-09-07"), "07/09/2026");
  assert.equal(numericDayLabel("2026-01-31"), "31/01/2026");

  for (const day of ["", "2026-9-7", "07/09/2026", "2026-09-07T00:00:00Z", "2026-13-01", "2026-00-10"]) {
    assert.equal(numericDayLabel(day), null, JSON.stringify(day));
  }
});

// `server.ts` falls back to the raw string when this answers null, so a
// snapshot date the label refused would reach the page looking like a label.
// This is what keeps that fallback unreachable for the data actually shipped.
test("the snapshot the frozen-data note names is a day it can label", () => {
  assert.match(numericDayLabel(SNAPSHOT_DATE) ?? "", /^\d{2}\/\d{2}\/\d{4}$/);
});
