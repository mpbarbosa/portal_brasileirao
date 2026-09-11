import assert from "node:assert/strict";
import { test } from "node:test";

import {
  countryRateSeries,
  rateChartSeries,
  statusClass,
  statusClassTotals,
  timelineGeometry,
} from "@/traffic-report-core";
import type { TrafficTimelinePoint } from "@/src/types";

/**
 * The chart readings `TrafficView` used to compute for itself. The parser's own
 * cases stay in `tests/traffic-report-core.test.ts`; these are the page's.
 */

const point = (
  t: number,
  ratePerMin: number | null,
  visitorRatePerMin: number | null,
  countries: Record<string, number> = {},
): TrafficTimelinePoint =>
  ({ t, requests: null, uniqueIps: null, ratePerMin, visitorRatePerMin, countries }) as TrafficTimelinePoint;

test("the whole deployment draws visitors against the physical line", () => {
  const timeline = [point(1, null, null), point(2, 30, 4), point(3, 50, null), point(4, 20, 6)];
  const series = rateChartSeries(timeline, "");
  assert.deepEqual(series.primary, [
    { x: 2, y: 4 },
    { x: 4, y: 6 },
  ]);
  assert.deepEqual(series.context, [
    { x: 2, y: 30 },
    { x: 3, y: 50 },
    { x: 4, y: 20 },
  ]);
  assert.equal(series.filtered, false);
});

test("with no visitor figure anywhere the physical line stands alone, unrelabelled", () => {
  const series = rateChartSeries([point(1, 10, null), point(2, 12, null)], "");
  assert.deepEqual(series.primary, [
    { x: 1, y: 10 },
    { x: 2, y: 12 },
  ]);
  assert.equal(series.context, null);
});

test("a zero rate is a point, not a gap", () => {
  const series = rateChartSeries([point(1, 0, 0)], "");
  assert.deepEqual(series.primary, [{ x: 1, y: 0 }]);
});

test("a chosen country is that country's line and nothing behind it", () => {
  const timeline = [point(0, 5, 1, { BR: 100 }), point(60_000, 5, 1, { BR: 160 })];
  const series = rateChartSeries(timeline, "BR");
  assert.deepEqual(series.primary, countryRateSeries(timeline, "BR"));
  assert.equal(series.context, null);
  assert.equal(series.filtered, true);
});

const BOX = { width: 100, height: 50, pad: 5 };

test("nothing to draw is null rather than an empty path", () => {
  assert.equal(timelineGeometry([], [{ x: 1, y: 1 }], BOX), null);
});

test("both series share one domain, so an earlier context point is never left of the box", () => {
  const drawn = timelineGeometry([{ x: 10, y: 2 }], [{ x: 0, y: 8 }, { x: 10, y: 4 }], BOX);
  assert.ok(drawn);
  assert.equal(drawn.minX, 0);
  assert.equal(drawn.maxY, 8);
  // The context's first point sits on the left padding, not at a negative x.
  assert.match(drawn.contextD ?? "", /^M5\.0 /);
  // The primary's value is scaled against the union's maximum, not its own.
  assert.equal(drawn.end.y, BOX.height - BOX.pad - (2 / 8) * (BOX.height - BOX.pad * 2));
});

test("the y axis starts at zero, so a flat series does not fill the box", () => {
  const drawn = timelineGeometry([{ x: 0, y: 10 }, { x: 1, y: 10 }], [], BOX);
  assert.ok(drawn);
  assert.equal(drawn.end.y, BOX.pad);
  assert.equal(drawn.contextD, null);
});

test("one instant is one date on the caption, however many points share it", () => {
  const drawn = timelineGeometry([{ x: 7, y: 1 }], [{ x: 7, y: 3 }], BOX);
  assert.ok(drawn);
  assert.equal(drawn.single, true);
});

test("a status code falls into its class, and anything unparseable into outros", () => {
  assert.equal(statusClass("200"), "2xx");
  assert.equal(statusClass("304"), "3xx");
  assert.equal(statusClass("404"), "4xx");
  assert.equal(statusClass("503"), "5xx");
  assert.equal(statusClass("499x"), "outros");
  assert.equal(statusClass("101"), "outros");
});

test("class totals sum the exact codes and leave out a class with none", () => {
  const totals = statusClassTotals([
    { label: "200", count: 7 },
    { label: "206", count: 3 },
    { label: "404", count: 2 },
  ]);
  assert.equal(totals.get("2xx"), 10);
  assert.equal(totals.get("4xx"), 2);
  assert.equal(totals.has("5xx"), false);
});
