/**
 * Pure parser for the traffic snapshots written by
 * `shell_scripts/12_traffic_report.sh` — one `summary-<stamp>.txt` per run,
 * read off nginx's access log **on the host**. No I/O: `server.ts` reads the
 * files and hands the text in, exactly as it does for every other `*-core`
 * module here, which is what makes the parsing testable without a log, a host
 * or a request.
 *
 * **This is the app's own access log rather than a provider's payload**, so it
 * is the second `*-core` after `health-core.ts` whose subject is this
 * deployment instead of the championship. Both consequences of that are
 * deliberate:
 *
 * - **Nothing here ever handles a visitor's IP address.** The report's own
 *   sections are already aggregates — the host resolves every unique IP to a
 *   country once and emits counts — so an address is not dropped here, it never
 *   reaches here. That is a property of the shell script and this module cannot
 *   restore it if somebody widens the script; `tests/traffic-report-core.test.ts`
 *   asserts an IP-shaped string in a summary is not carried into the payload.
 *
 * - **A snapshot is stale by construction, and the payload says how stale.**
 *   The timer writes one an hour, so `generated` is the reading's own instant —
 *   `StadiumWeather`'s rule. The page prints that rather than implying live
 *   numbers.
 *
 * The report is a cumulative total over nginx's whole log window (the live file
 * plus whatever rotation has kept), so `requests` rises across snapshots and is
 * not a per-hour figure. The per-snapshot **delta** is what approximates a rate,
 * and it is derived here rather than written by the script, because only a
 * reader holding two snapshots can compute one.
 */
import type {
  ApiEnvelope,
  TrafficCountRow,
  TrafficDashboard,
  TrafficSnapshot,
  TrafficTimelinePoint,
} from "@/src/types";

// ── Parsing ────────────────────────────────────────────────────────────────

/** Split a summary into its `== Section ==` blocks, keyed by title. */
const splitSections = (text: string): Record<string, string[]> => {
  const sections: Record<string, string[]> = { __head__: [] };
  let current = "__head__";
  for (const line of text.split(/\r?\n/)) {
    const heading = line.match(/^==\s*(.+?)\s*==$/);
    if (heading) {
      current = heading[1];
      sections[current] = [];
    } else {
      sections[current].push(line);
    }
  }
  return sections;
};

/**
 * Parse the `  <count> <label…>` rows that `uniq -c` produces, which is the
 * shape of almost every section.
 *
 * The label is **everything after the count**, not the next whitespace-delimited
 * field: a city reads `São Paulo, Brazil` and a referrer carries a URL with
 * spaces in it often enough to matter. Splitting on whitespace would file every
 * such row under its first word and silently merge unrelated buckets.
 */
const parseCountRows = (lines: string[] | undefined): TrafficCountRow[] => {
  const rows: TrafficCountRow[] = [];
  for (const line of lines ?? []) {
    const m = line.match(/^\s*(\d+)\s+(.+?)\s*$/);
    if (m) rows.push({ label: m[2], count: Number(m[1]) });
  }
  return rows;
};

interface GeoSection {
  geoSource: string | null;
  geoAttribution: string | null;
  byVisitor: TrafficCountRow[];
  byVolume: TrafficCountRow[];
}

/**
 * Parse one geo section — a `Geo source:` line plus two labelled sub-blocks,
 * `by unique visitor` and `by request volume`.
 *
 * **The two are not the same question and the section carries both on purpose.**
 * One office of forty people behind one address is one visitor and forty
 * requests, so a country ranked by volume and the same country ranked by
 * visitors disagree exactly where a few readers are reading a lot — which is
 * the interesting case rather than a discrepancy.
 *
 * A host with only a country-level database emits the cities section as a hint
 * and no rows, so both buckets come back empty and the caller shows nothing
 * rather than a chart of one `(unknown)` bar.
 */
const parseGeoSection = (lines: string[] | undefined): GeoSection => {
  const byVisitor: TrafficCountRow[] = [];
  const byVolume: TrafficCountRow[] = [];
  let bucket: TrafficCountRow[] | null = null;
  let geoSource: string | null = null;
  let geoAttribution: string | null = null;

  for (const line of lines ?? []) {
    // Attribution before source: "Geo attribution:" contains neither "Geo
    // source:" nor a leading count, but testing the narrower string first is
    // what keeps that true of a future line rather than of today's wording.
    if (/Geo attribution:/.test(line))
      geoAttribution = line.replace(/.*Geo attribution:\s*/, "").trim() || null;
    else if (/Geo source:/.test(line)) geoSource = line.replace(/.*Geo source:\s*/, "").trim();
    else if (/by unique visitor/.test(line)) bucket = byVisitor;
    else if (/by request volume/.test(line)) bucket = byVolume;
    else {
      const m = line.match(/^\s*(\d+)\s+(.+?)\s*$/);
      if (m && bucket) bucket.push({ label: m[2], count: Number(m[1]) });
    }
  }
  return { geoSource, geoAttribution, byVisitor, byVolume };
};

/** A parsed snapshot plus the sort key the timeline needs. */
export interface ParsedSnapshot extends TrafficSnapshot {
  generatedMs: number;
}

/**
 * Read one `summary-<stamp>.txt`.
 *
 * Returns **null** rather than a partial when the header carries no parseable
 * `Generated:` instant, because that value is the snapshot's position on the
 * timeline and every rate is a difference between two of them. A snapshot that
 * cannot be placed in time would either sort arbitrarily or invent a rate, and
 * `buildTrafficDashboard` drops it instead. Every other field is allowed to be
 * absent: an older summary, or one from a host with no geo database, is a real
 * thing to render less of.
 */
export const parseSummary = (text: string, file: string): ParsedSnapshot | null => {
  const sections = splitSections(text);
  const head = (sections["__head__"] ?? []).join("\n");
  const totals = (sections["Totals"] ?? []).join("\n");

  const grab = (re: RegExp, source = head): string | null => {
    const m = source.match(re);
    return m ? m[1].trim() : null;
  };

  const generated = grab(/Generated:\s*(\S+)/);
  const generatedMs = generated ? Date.parse(generated) : Number.NaN;
  if (!generated || Number.isNaN(generatedMs)) return null;

  // `Number(null)` is 0 and `Number("")` is 0, so every optional numeric goes
  // through a null check rather than `|| null`. Zero requests is a real reading
  // — a host serving nothing for an hour — and reporting it as "no data" would
  // hide exactly the outage worth seeing. Same trap `countsTowardStandings`
  // records for a 0-0.
  const num = (raw: string | null): number | null => {
    if (raw === null) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  };

  const countries = parseGeoSection(sections["Top countries"]);
  const cities = parseGeoSection(sections["Top cities"]);

  // Bucket the hour rows as "00".."23" so the chart can index them directly and
  // an hour with no traffic is an absent key rather than a missing column.
  const byHour: Record<string, number> = {};
  for (const { label, count } of parseCountRows(sections["Requests by hour of day"])) {
    if (/^\d{2}$/.test(label)) byHour[label] = count;
  }

  return {
    file,
    generated,
    generatedMs,
    logLines: num(grab(/\((\d+)\s+log lines\)/)),
    requests: num(grab(/Requests:\s*(\d+)/, totals)),
    uniqueIps: num(grab(/Unique IPs:\s*(\d+)/, totals)),
    dateRange: grab(/Date range:\s*(.+)/, totals),
    geoSource: countries.geoSource ?? cities.geoSource,
    geoAttribution: countries.geoAttribution ?? cities.geoAttribution,
    topPaths: parseCountRows(sections["Top 20 requested paths"]),
    statusCodes: parseCountRows(sections["HTTP status codes"]),
    referrers: parseCountRows(sections["Top 20 referrers"]),
    countriesByVisitor: countries.byVisitor,
    countriesByVolume: countries.byVolume,
    citiesByVisitor: cities.byVisitor,
    citiesByVolume: cities.byVolume,
    byHour,
    byDay: parseCountRows(sections["Requests by day"]),
    uniqueIpsByDay: parseCountRows(sections["Unique IPs by day"]),
    bots: num(grab(/Bot-ish hits:\s*(\d+)/, (sections["Bot / crawler share"] ?? []).join("\n"))),
    monitorHits: num(
      grab(/Monitor hits:\s*(\d+)/, (sections["Monitoring (/api/health)"] ?? []).join("\n")),
    ),
  };
};

// ── Public projection ────────────────────────────────────────────────────────

/**
 * `/api/health` is excluded from the **top paths** and from nothing else.
 *
 * It is machine polling by construction and carries no reader: `reconcile.yml`
 * reads it every fifteen minutes, the deploy job asserts the live commit
 * through it, and any uptime monitor pointed at this host will use it too. Left
 * in, it sits near the top of a twenty-row chart and pushes out a content route
 * that a person actually opened — which is the whole question that chart is
 * asked.
 *
 * It stays in `requests`, in the status codes and in the hour buckets, because
 * those answer *what did this server do* rather than *what did people read*,
 * and a filter there would make the totals disagree with the log. The count is
 * carried separately as `monitorHits` so the exclusion is visible rather than
 * silent — the report says how much it set aside.
 *
 * The sibling this was ported from filters its own poller out of the log
 * **before** every tally, and that is right there and wrong here: its
 * self-client was 85-90% of all lines and swamped the totals, where this is a
 * few hundred a day against a real audience.
 */
const MONITOR_PATH = /^\/api\/health(?![\w-])/;

/** Referrer rows nginx writes for "no referrer" — a literal `"-"`. Dropped
 *  rather than rendered, because it is every direct visit plus every bot, so
 *  it is both the largest bar and the least informative one. */
const isEmptyReferrer = (label: string): boolean => label === '"-"' || label === "-";

/** Project a parsed snapshot to what the page is served: the same fields, minus
 *  the sort key, with the two cosmetic filters above applied. */
const project = (snap: ParsedSnapshot): TrafficSnapshot => {
  const { generatedMs: _generatedMs, ...rest } = snap;
  return {
    ...rest,
    topPaths: snap.topPaths.filter((row) => !MONITOR_PATH.test(row.label)),
    referrers: snap.referrers
      .filter((row) => !isEmptyReferrer(row.label))
      // nginx quotes the referrer; the quotes are log syntax rather than part
      // of the address, and a URL rendered with them looks like a broken link.
      .map((row) => ({ ...row, label: row.label.replace(/^"|"$/g, "") })),
  };
};

/**
 * Build the `/api/traffic-dashboard` payload from every summary the caller
 * read: a cross-snapshot timeline plus the latest snapshot.
 *
 * `source` is `"traffic-log"` when at least one snapshot parsed and
 * `"fallback"` when none did — which is the ordinary state of a dev checkout
 * and of any host where the timer has not run yet, not an error. An
 * `ApiEnvelope` for the reason every other data route is one: the page has to
 * be able to say where this came from and how old it is.
 */
export const buildTrafficDashboard = (
  files: { file: string; text: string }[],
  updatedAt: string,
): ApiEnvelope<TrafficDashboard> => {
  const snaps = files
    .map(({ file, text }) => parseSummary(text, file))
    .filter((snap): snap is ParsedSnapshot => snap !== null)
    .sort((a, b) => a.generatedMs - b.generatedMs);

  if (snaps.length === 0) {
    return {
      source: "fallback",
      note: "Nenhum instantâneo de tráfego disponível nesta instância.",
      updatedAt,
      data: { snapshotCount: 0, windowRatePerMin: null, timeline: [], latest: null },
    };
  }

  const timeline: TrafficTimelinePoint[] = snaps.map((snap, i) => {
    // The first snapshot has nothing to difference against, so its rate is null
    // rather than zero — "not measurable yet" and "no traffic" are different
    // readings and the chart draws them differently.
    let ratePerMin: number | null = null;
    if (i > 0) {
      const previous = snaps[i - 1];
      const minutes = (snap.generatedMs - previous.generatedMs) / 60000;
      if (minutes > 0) {
        const delta = (snap.requests ?? 0) - (previous.requests ?? 0);
        // Clamped at zero: log rotation drops the oldest lines, so a cumulative
        // total legitimately goes *down* across a rotation and the honest
        // answer is "no measurable rate", never a negative one.
        ratePerMin = Math.max(0, Math.round(delta / minutes));
      }
    }

    const countries: Record<string, number> = {};
    for (const row of snap.countriesByVolume) countries[row.label] = row.count;

    return {
      t: snap.generatedMs,
      requests: snap.requests ?? 0,
      uniqueIps: snap.uniqueIps ?? 0,
      ratePerMin,
      countries,
    };
  });

  const first = snaps[0];
  const latest = snaps[snaps.length - 1];
  const windowMinutes = (latest.generatedMs - first.generatedMs) / 60000;
  const windowRatePerMin =
    windowMinutes > 0
      ? Math.max(0, Math.round(((latest.requests ?? 0) - (first.requests ?? 0)) / windowMinutes))
      : null;

  return {
    source: "traffic-log",
    note:
      snaps.length === 1
        ? "Um instantâneo do log de acesso da produção."
        : `${snaps.length} instantâneos do log de acesso da produção.`,
    updatedAt,
    data: {
      snapshotCount: snaps.length,
      windowRatePerMin,
      timeline,
      latest: project(latest),
    },
  };
};
