import assert from "node:assert/strict";
import { test } from "node:test";

import { buildTrafficDashboard, parseSummary } from "@/traffic-report-core";

/**
 * A summary in the shape `shell_scripts/12_traffic_report.sh` writes. Taken
 * from a real run of that script over a stock `combined` fixture log rather
 * than composed by hand — a fixture invented to match the parser proves the
 * parser matches itself.
 */
const summary = (
  overrides: { generated?: string; requests?: number; monitor?: number | null } = {},
): string =>
  `Portal Brasileirão — traffic snapshot
Generated: ${overrides.generated ?? "2026-09-03T14:07:02+00:00"}
Source:    /var/log/nginx/portal-brasileirao.access.log* (8 log lines)

== Totals ==
Requests:       ${overrides.requests ?? 8}
Unique IPs:     5
Date range:     03/Sep/2026:14:02:11  ->  04/Sep/2026:17:04:09

== Top 20 requested paths ==
      2 /api/health
      1 /sitemap.xml
      1 /partida/554977
      1 /

== HTTP status codes ==
      7 200
      1 404

== Top 20 referrers ==
      6 "-"
      1 "https://www.google.com/search?q=brasileirao tabela"

== Top countries ==
Geo source: /var/lib/GeoIP/GeoLite2-City.mmdb
-- by unique visitor (top 20) --
      4 Brazil
      1 United States
-- by request volume (top 20) --
      7 Brazil
      1 United States

== Top cities ==
Geo source: /var/lib/GeoIP/GeoLite2-City.mmdb
-- by unique visitor (top 20) --
      3 São Paulo, Brazil
      1 (unknown)
-- by request volume (top 20) --
      6 São Paulo, Brazil

== Requests by hour of day ==
      2 14
      3 15

== Requests by day ==
      5 03/Sep/2026
      3 04/Sep/2026

== Unique IPs by day ==
      3 03/Sep/2026
      3 04/Sep/2026

== Bot / crawler share ==
Bot-ish hits:   1 of 8

${
  overrides.monitor === null
    ? ""
    : `== Monitoring (/api/health) ==
Monitor hits:   ${overrides.monitor ?? 2} of 8
`
}`;

// ------------------------------------------------------------------ parsing

test("every section of a full summary is read", () => {
  const snap = parseSummary(summary(), "summary-20260903-140702.txt");
  assert.ok(snap);
  assert.equal(snap.file, "summary-20260903-140702.txt");
  assert.equal(snap.requests, 8);
  assert.equal(snap.uniqueIps, 5);
  assert.equal(snap.logLines, 8);
  assert.equal(snap.dateRange, "03/Sep/2026:14:02:11  ->  04/Sep/2026:17:04:09");
  assert.equal(snap.geoSource, "/var/lib/GeoIP/GeoLite2-City.mmdb");
  assert.equal(snap.bots, 1);
  assert.equal(snap.monitorHits, 2);
  assert.deepEqual(snap.statusCodes, [
    { label: "200", count: 7 },
    { label: "404", count: 1 },
  ]);
  assert.deepEqual(snap.byHour, { "14": 2, "15": 3 });
  assert.deepEqual(snap.byDay, [
    { label: "03/Sep/2026", count: 5 },
    { label: "04/Sep/2026", count: 3 },
  ]);
  assert.deepEqual(snap.uniqueIpsByDay, [
    { label: "03/Sep/2026", count: 3 },
    { label: "04/Sep/2026", count: 3 },
  ]);
});

test("a snapshot with no parseable Generated is dropped, not partially read", () => {
  // It has no place on the timeline and every rate is a difference between two
  // instants, so half-reading it would sort arbitrarily or invent a rate.
  assert.equal(parseSummary(summary().replace(/^Generated:.*$/m, "Generated: ontem"), "s.txt"), null);
  assert.equal(parseSummary("== Totals ==\nRequests: 5\n", "s.txt"), null);
});

test("a label keeps everything after the count, spaces included", () => {
  // Splitting on whitespace would file "São Paulo, Brazil" under "São" and
  // truncate every referrer at its first space — silently merging buckets that
  // have nothing to do with each other.
  const snap = parseSummary(summary(), "s.txt");
  assert.ok(snap);
  assert.deepEqual(snap.citiesByVisitor, [
    { label: "São Paulo, Brazil", count: 3 },
    { label: "(unknown)", count: 1 },
  ]);
  assert.ok(
    snap.referrers.some((r) => r.label === '"https://www.google.com/search?q=brasileirao tabela"'),
  );
});

test("the two geo readings are kept apart", () => {
  // By-visitor and by-volume answer different questions and legitimately
  // disagree; folding them would report an office of forty as forty visitors.
  const snap = parseSummary(summary(), "s.txt");
  assert.ok(snap);
  assert.deepEqual(snap.countriesByVisitor, [
    { label: "Brazil", count: 4 },
    { label: "United States", count: 1 },
  ]);
  assert.deepEqual(snap.countriesByVolume, [
    { label: "Brazil", count: 7 },
    { label: "United States", count: 1 },
  ]);
});

test("the geo credit is read from the report, and its absence is not a blank one", () => {
  // The credit is what DB-IP's CC BY 4.0 licence charges for the data, so it
  // travels with the rows rather than being written into the component — a page
  // that composed it would credit the wrong vendor the moment the host's
  // database changed underneath it.
  //
  // Copied from a real run against dbip-city-lite 2026-09, not composed.
  const credited = summary().replace(
    "Geo source: /var/lib/GeoIP/GeoLite2-City.mmdb",
    `Geo source: /var/lib/GeoIP/dbip-city-lite.mmdb
Geo attribution: IP Geolocation by DB-IP (https://db-ip.com), CC BY 4.0`,
  );
  const snap = parseSummary(credited, "s.txt");
  assert.ok(snap);
  assert.equal(snap.geoAttribution, "IP Geolocation by DB-IP (https://db-ip.com), CC BY 4.0");
  // The attribution line must not be mistaken for the source line, and the
  // rows beneath it must survive the extra line — a parser matching
  // /Geo source:/ first would swallow neither, but one matching a looser
  // /Geo/ would take the credit as the path.
  assert.equal(snap.geoSource, "/var/lib/GeoIP/dbip-city-lite.mmdb");
  assert.ok(snap.countriesByVisitor.length > 0);

  // A database whose terms the report does not know emits no such line, and
  // null is the honest answer: an empty string would render as a credit that
  // credits nobody.
  const uncredited = parseSummary(summary(), "s.txt");
  assert.ok(uncredited);
  assert.equal(uncredited.geoAttribution, null);
});

test("a host with no geo database yields empty geo, not a chart of one bar", () => {
  // Copied from a real run of the script with mmdblookup off PATH, not
  // composed: the first version of this fixture only deleted the `Geo source:`
  // line and left the rows beneath it, so it asserted against a summary shape
  // the script cannot emit — and went red for the right answer.
  const noGeo = summary().replace(
    /== Top countries ==[\s\S]*?(?=== Requests by hour)/,
    `== Top countries ==
(No GeoLite2 database — install mmdb-bin and place GeoLite2-City.mmdb
 in /var/lib/GeoIP/, or set GEO_DB, then re-run. Every other section
 works without it.)

== Top cities ==
(No GeoLite2 database — see the note under Top countries.)

`,
  );
  const snap = parseSummary(noGeo, "s.txt");
  assert.ok(snap);
  assert.equal(snap.geoSource, null);
  assert.deepEqual(snap.countriesByVisitor, []);
  assert.deepEqual(snap.citiesByVolume, []);
});

test("zero is a reading and an absent section is not", () => {
  // `Number(null)` and `Number("")` are both 0, so the two collapse under any
  // truthiness check — and an hour that genuinely served nobody is exactly the
  // outage worth seeing. Same trap `countsTowardStandings` records for a 0-0.
  const zeroed = summary().replace("Bot-ish hits:   1 of 8", "Bot-ish hits:   0 of 8");
  assert.equal(parseSummary(zeroed, "s.txt")?.bots, 0);

  const dropped = summary().replace(/== Bot \/ crawler share ==\n[\s\S]*?\n\n/, "");
  assert.equal(parseSummary(dropped, "s.txt")?.bots, null);
});

test("a summary written before a section existed still parses", () => {
  // Snapshots outlive the script that wrote them: the host keeps whatever it
  // has written, so an older shape has to render less rather than vanish.
  const old = summary().replace(/== Monitoring[\s\S]*$/, "");
  const snap = parseSummary(old, "s.txt");
  assert.ok(snap);
  assert.equal(snap.monitorHits, null);
  assert.equal(snap.requests, 8);
});

// -------------------------------------------------------------- projection

test("/api/health is dropped from the top paths and from nothing else", () => {
  const built = buildTrafficDashboard([{ file: "a.txt", text: summary() }], "2026-09-03T15:00:00Z");
  const latest = built.data.latest;
  assert.ok(latest);
  assert.ok(!latest.topPaths.some((r) => r.label.startsWith("/api/health")));
  assert.ok(latest.topPaths.some((r) => r.label === "/partida/554977"));
  // Still counted everywhere the question is "what did the server do".
  assert.equal(latest.requests, 8);
  assert.equal(latest.monitorHits, 2);
  assert.equal(
    latest.statusCodes.reduce((sum, r) => sum + r.count, 0),
    8,
  );
});

test("a path merely containing api/health is kept", () => {
  // The rule is anchored, so a club or fixture whose slug happens to contain
  // the word is not silently removed from the chart.
  const text = summary().replace("      1 /sitemap.xml", "      1 /clube/api/health-fc");
  const built = buildTrafficDashboard([{ file: "a.txt", text }], "2026-09-03T15:00:00Z");
  assert.ok(built.data.latest?.topPaths.some((r) => r.label === "/clube/api/health-fc"));
});

test("the empty referrer is dropped and nginx's quotes are stripped", () => {
  const built = buildTrafficDashboard([{ file: "a.txt", text: summary() }], "2026-09-03T15:00:00Z");
  const referrers = built.data.latest?.referrers ?? [];
  assert.ok(!referrers.some((r) => r.label === '"-"' || r.label === "-"));
  assert.deepEqual(referrers, [
    { label: "https://www.google.com/search?q=brasileirao tabela", count: 1 },
  ]);
});

test("no visitor address reaches the payload", () => {
  // The report already aggregates on the host, so an address never arrives
  // here — but a widened section upstream would arrive silently, and this is
  // what would notice. Note it is a floor: it cannot restore the property, only
  // report that this shape of summary has not lost it.
  const withIps = summary().replace(
    "== Bot / crawler share ==",
    "== Suspect sources ==\n      9 203.0.113.10 404 curl/8.5.0\n\n== Bot / crawler share ==",
  );
  const built = buildTrafficDashboard([{ file: "a.txt", text: withIps }], "2026-09-03T15:00:00Z");
  assert.doesNotMatch(JSON.stringify(built), /\b\d{1,3}(\.\d{1,3}){3}\b/);
});

// ---------------------------------------------------------------- timeline

test("snapshots are ordered by their instant, not by the caller's order", () => {
  const built = buildTrafficDashboard(
    [
      { file: "b.txt", text: summary({ generated: "2026-09-03T16:07:02+00:00", requests: 500 }) },
      { file: "a.txt", text: summary({ generated: "2026-09-03T14:07:02+00:00", requests: 100 }) },
    ],
    "2026-09-03T17:00:00Z",
  );
  assert.deepEqual(
    built.data.timeline.map((p) => p.requests),
    [100, 500],
  );
  assert.equal(built.data.latest?.requests, 500);
});

test("the first snapshot has no rate, and the second's is the difference", () => {
  // Null is "not measurable yet", which the chart must not draw as a zero.
  const built = buildTrafficDashboard(
    [
      { file: "a.txt", text: summary({ generated: "2026-09-03T14:00:00+00:00", requests: 100 }) },
      { file: "b.txt", text: summary({ generated: "2026-09-03T15:00:00+00:00", requests: 700 }) },
    ],
    "2026-09-03T15:30:00Z",
  );
  assert.equal(built.data.timeline[0].ratePerMin, null);
  assert.equal(built.data.timeline[1].ratePerMin, 10);
  assert.equal(built.data.windowRatePerMin, 10);
});

test("the read rate is the total with /api/health taken out", () => {
  // The split this panel exists for. Measured on production 2026-09-05, the
  // monitor was 26,899 of 48,513 requests — 55% — so one line drawn from
  // `requests` was mostly machine while the panel beneath it had already
  // filtered the same traffic out of its ranking.
  const built = buildTrafficDashboard(
    [
      {
        file: "a.txt",
        text: summary({ generated: "2026-09-03T14:00:00+00:00", requests: 100, monitor: 10 }),
      },
      {
        file: "b.txt",
        text: summary({ generated: "2026-09-03T15:00:00+00:00", requests: 700, monitor: 430 }),
      },
    ],
    "2026-09-03T15:30:00Z",
  );
  // 600 requests in 60 minutes is 10/min; 420 of them were /api/health, so the
  // 180 that were not are 3/min.
  assert.equal(built.data.timeline[1].ratePerMin, 10);
  assert.equal(built.data.timeline[1].readRatePerMin, 3);
  // The first snapshot has nothing to difference against, in either series.
  assert.equal(built.data.timeline[0].readRatePerMin, null);
});

test("a snapshot with no monitor figure yields a null read rate, never the total", () => {
  // A summary written before `12_traffic_report.sh` counted them has no answer,
  // and falling back to `ratePerMin` would put two different quantities on one
  // line — the confusion the second series exists to end. Asserted against the
  // total explicitly, because `null` and `10` are both "not the read rate" and
  // only one of them is the bug.
  const built = buildTrafficDashboard(
    [
      {
        file: "a.txt",
        text: summary({ generated: "2026-09-03T14:00:00+00:00", requests: 100, monitor: null }),
      },
      {
        file: "b.txt",
        text: summary({ generated: "2026-09-03T15:00:00+00:00", requests: 700, monitor: 430 }),
      },
    ],
    "2026-09-03T15:30:00Z",
  );
  assert.equal(built.data.timeline[1].ratePerMin, 10);
  assert.equal(built.data.timeline[1].readRatePerMin, null);
});

test("a rotation clamps the read rate at zero as well as the total", () => {
  // Both series difference a cumulative counter, so both meet the rotation.
  const built = buildTrafficDashboard(
    [
      {
        file: "a.txt",
        text: summary({ generated: "2026-09-03T14:00:00+00:00", requests: 9000, monitor: 5000 }),
      },
      {
        file: "b.txt",
        text: summary({ generated: "2026-09-03T15:00:00+00:00", requests: 300, monitor: 120 }),
      },
    ],
    "2026-09-03T15:30:00Z",
  );
  assert.equal(built.data.timeline[1].ratePerMin, 0);
  assert.equal(built.data.timeline[1].readRatePerMin, 0);
});

test("a rotation that shrinks the cumulative total reports no rate, never a negative one", () => {
  // logrotate drops the oldest lines, so the window's total legitimately falls.
  const built = buildTrafficDashboard(
    [
      { file: "a.txt", text: summary({ generated: "2026-09-03T14:00:00+00:00", requests: 9000 }) },
      { file: "b.txt", text: summary({ generated: "2026-09-03T15:00:00+00:00", requests: 300 }) },
    ],
    "2026-09-03T15:30:00Z",
  );
  assert.equal(built.data.timeline[1].ratePerMin, 0);
  assert.equal(built.data.windowRatePerMin, 0);
});

test("one snapshot has no window to average over", () => {
  const built = buildTrafficDashboard([{ file: "a.txt", text: summary() }], "2026-09-03T15:00:00Z");
  assert.equal(built.data.snapshotCount, 1);
  assert.equal(built.data.windowRatePerMin, null);
  assert.equal(built.source, "traffic-log");
});

test("the timeline carries each snapshot's countries so a per-country rate is derivable", () => {
  const built = buildTrafficDashboard([{ file: "a.txt", text: summary() }], "2026-09-03T15:00:00Z");
  assert.deepEqual(built.data.timeline[0].countries, { Brazil: 7, "United States": 1 });
});

// ---------------------------------------------------------------- fallback

test("no readable snapshot is a fallback envelope, not an error", () => {
  // The ordinary state of a dev checkout and of a host whose timer has not run.
  for (const files of [[], [{ file: "a.txt", text: "" }], [{ file: "a.txt", text: "lixo" }]]) {
    const built = buildTrafficDashboard(files, "2026-09-03T15:00:00Z");
    assert.equal(built.source, "fallback");
    assert.equal(built.data.latest, null);
    assert.equal(built.data.snapshotCount, 0);
    assert.deepEqual(built.data.timeline, []);
    assert.match(built.note, /instantâneo/);
  }
});

test("one unreadable file among readable ones is skipped, not fatal", () => {
  const built = buildTrafficDashboard(
    [
      { file: "bad.txt", text: "truncado" },
      { file: "good.txt", text: summary() },
    ],
    "2026-09-03T15:00:00Z",
  );
  assert.equal(built.data.snapshotCount, 1);
  assert.equal(built.data.latest?.file, "good.txt");
});
