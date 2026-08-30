import assert from "node:assert/strict";
import { test } from "node:test";

import { STADIUMS } from "@/src/data/stadiums";
import {
  OPEN_METEO_BASE_URL,
  buildWeatherUrl,
  describeWeather,
  humidityLabel,
  isKnownWeatherCode,
  parseWeather,
  temperatureLabel,
  windLabel,
} from "@/weather-core";

const AT = "2026-08-29T21:00:00.000Z";

const payload = (current: Record<string, unknown>) => ({ current });

// --- the request ------------------------------------------------------------------

test("the request asks Open-Meteo for the fields the card renders", () => {
  const url = new URL(buildWeatherUrl([-22.912222, -43.230278]));
  assert.equal(`${url.origin}${url.pathname}`, OPEN_METEO_BASE_URL);
  const current = url.searchParams.get("current") ?? "";
  for (const field of [
    "temperature_2m",
    "apparent_temperature",
    "relative_humidity_2m",
    "weather_code",
    "wind_speed_10m",
    "is_day",
  ]) {
    assert.ok(current.includes(field), `missing ${field}`);
  }
  assert.equal(url.searchParams.get("wind_speed_unit"), "kmh");
});

test("coordinates are rounded, because the URL is also the cache key", () => {
  // Two callers asking about one stadium must produce one string, or the cache
  // stores a separate entry per caller and the upstream is hit per reader.
  const a = buildWeatherUrl([-22.9122224999, -43.2302784999]);
  const b = buildWeatherUrl([-22.9122221111, -43.2302781111]);
  assert.equal(a, b);
  assert.match(a, /latitude=-22\.9122&/);
});

test("a southern-hemisphere coordinate keeps its sign", () => {
  // Every ground in this division is south of the equator and west of Greenwich,
  // so a sign dropped anywhere lands the reading in China.
  const url = new URL(buildWeatherUrl([-1.381111, -48.444]));
  assert.equal(url.searchParams.get("latitude"), "-1.3811");
  assert.equal(url.searchParams.get("longitude"), "-48.4440");
});

// --- the code table ---------------------------------------------------------------

test("a known code is described in pt-BR", () => {
  assert.equal(describeWeather(63).label, "Chuva");
  assert.equal(describeWeather(95).label, "Temporal");
  assert.equal(describeWeather(0).label, "Céu limpo");
});

test("an unknown code degrades to a neutral label rather than blanking", () => {
  assert.equal(isKnownWeatherCode(4), false);
  assert.equal(describeWeather(4).label, "Condições indefinidas");
  assert.equal(describeWeather(4).kind, "cloudy");
});

test("the sky is named, never spelled as a character", () => {
  // The first draft of this module returned `☀`/`☁`/`☂` and this test went red
  // on the first one: U+2600 is Extended_Pictographic, so it renders as a colour
  // emoji on several platforms — the exact reason CLAUDE.md says the theme
  // toggle draws SunIcon and MoonIcon instead of `☀` and `☽`. Keeping the
  // assertion after the redesign is what stops a character coming back.
  const KINDS = new Set(["clear", "cloudy", "rain", "storm", "snow", "fog"]);
  for (let code = 0; code <= 99; code += 1) {
    if (!isKnownWeatherCode(code)) continue;
    const { kind, label } = describeWeather(code);
    assert.ok(KINDS.has(kind), `code ${code} has an unknown kind ${kind}`);
    assert.doesNotMatch(label, /\p{Extended_Pictographic}/u, `code ${code}'s label is pictographic`);
  }
});

// --- parsing ----------------------------------------------------------------------

test("a full payload becomes a snapshot", () => {
  const snapshot = parseWeather(
    payload({
      temperature_2m: 23.4,
      apparent_temperature: 25.1,
      relative_humidity_2m: 78,
      weather_code: 61,
      wind_speed_10m: 12.3,
      is_day: 1,
    }),
    AT,
  );
  assert.deepEqual(snapshot, {
    temperature: 23.4,
    feelsLike: 25.1,
    humidity: 78,
    windSpeed: 12.3,
    label: "Chuva fraca",
    kind: "rain",
    day: true,
    readAt: AT,
  });
});

test("every field but the temperature may be absent", () => {
  const snapshot = parseWeather(payload({ temperature_2m: 19 }), AT);
  assert.ok(snapshot);
  assert.equal(snapshot.temperature, 19);
  // Omitted, not undefined-valued: the card renders what is present.
  assert.equal("feelsLike" in snapshot, false);
  assert.equal("humidity" in snapshot, false);
  assert.equal("windSpeed" in snapshot, false);
});

test("no temperature is no card at all", () => {
  assert.equal(parseWeather(payload({ relative_humidity_2m: 80 }), AT), null);
  assert.equal(parseWeather(payload({ temperature_2m: null }), AT), null);
  assert.equal(parseWeather(payload({ temperature_2m: "23" }), AT), null);
});

test("a payload that is not a payload answers null rather than throwing", () => {
  for (const junk of [null, undefined, 4, "", [], {}, { current: null }, { current: 7 }]) {
    assert.equal(parseWeather(junk, AT), null);
  }
});

test("zero is a real temperature, and a real humidity", () => {
  // The trap `countsTowardStandings` records for a 0-0 scoreline, one module on:
  // a falsy check here would drop a freezing night in Curitiba.
  const snapshot = parseWeather(
    payload({ temperature_2m: 0, relative_humidity_2m: 0, wind_speed_10m: 0 }),
    AT,
  );
  assert.ok(snapshot);
  assert.equal(snapshot.temperature, 0);
  assert.equal(snapshot.humidity, 0);
  assert.equal(snapshot.windSpeed, 0);
});

test("is_day arrives as 1/0, not as a boolean", () => {
  const night = parseWeather(payload({ temperature_2m: 18, weather_code: 0, is_day: 0 }), AT);
  const day = parseWeather(payload({ temperature_2m: 18, weather_code: 0, is_day: 1 }), AT);
  assert.ok(night && day);
  assert.equal(night.day, false);
  assert.equal(day.day, true);
  // The word does not move with the light; only the mark does.
  assert.equal(night.label, day.label);
  assert.equal(night.kind, day.kind);
  // Absent means day. A `!!0` on a number that is legitimately 0 is the trap.
  assert.equal(parseWeather(payload({ temperature_2m: 18, weather_code: 0 }), AT)?.day, true);
});

// --- labels -----------------------------------------------------------------------

test("figures are rounded to what a reader acts on", () => {
  assert.equal(temperatureLabel(23.4), "23 °C");
  // `Math.round(-0.4)` is -0, and `${-0}` is "0" — so a chilly Curitiba night
  // just above freezing reads as "0 °C" rather than the absurd "-0 °C".
  assert.equal(temperatureLabel(-0.4), "0 °C");
  assert.equal(temperatureLabel(-3.2), "-3 °C");
  assert.equal(windLabel(12.6), "13 km/h");
  assert.equal(humidityLabel(77.5), "78%");
});

// --- the data this rests on -------------------------------------------------------

test("every stadium carries a coordinate, and it is in Brazil", () => {
  // The page can only ask about a ground it has a point for, so a stadium
  // without one silently loses the feature. Asserting the *data* rather than the
  // type, for the reason `player-photos.test.ts` gives: the compiler is
  // satisfied by an absent optional field, which reads on the page as nothing
  // at all.
  const entries = Object.entries(STADIUMS);
  assert.ok(entries.length >= 19, `only ${entries.length} stadiums`);
  for (const [slug, facts] of entries) {
    assert.ok(facts.coordinates, `${slug} has no coordinates`);
    const [lat, lon] = facts.coordinates;
    // Brazil's bounding box. Catches a swapped pair, a dropped sign and a
    // decimal-point slip, which are the three ways a hand-copied coordinate goes
    // wrong — all of which leave a perfectly plausible-looking number.
    assert.ok(lat >= -34 && lat <= 6, `${slug} latitude ${lat} is outside Brazil`);
    assert.ok(lon >= -74 && lon <= -34, `${slug} longitude ${lon} is outside Brazil`);
  }
});

test("no two stadiums share a coordinate", () => {
  // A copy-paste between two entries is invisible on the page: both grounds
  // would report the same, entirely plausible, weather.
  const seen = new Map<string, string>();
  for (const [slug, facts] of Object.entries(STADIUMS)) {
    if (!facts.coordinates) continue;
    const key = facts.coordinates.join(",");
    const other = seen.get(key);
    assert.equal(other, undefined, `${slug} shares a coordinate with ${other}`);
    seen.set(key, slug);
  }
});
