/**
 * **Clima no estádio** — the current conditions at a ground, from Open-Meteo.
 *
 * Pure, like every other `*-core` module: it builds a request URL and parses a
 * response, and `server.ts` does the fetching. That split is what lets the
 * WMO code table and the parsing be unit-tested without a network.
 *
 * **Open-Meteo needs no key and no signup**, which is why this can ship at all:
 * a fresh clone runs it with no configuration, exactly as the app already runs
 * without `FOOTBALL_DATA_TOKEN`. It is also a **separate upstream**, so it
 * spends nothing from football-data's 10 requests a minute and gets its own kill
 * switch rather than riding on `DISABLE_FOOTBALL_DATA` — one provider having a
 * bad afternoon should not take the other's data off the page.
 *
 * **It reports what is happening now, and never a forecast**, which is a
 * decision rather than a limit of the API. Open-Meteo will happily return
 * hourly values sixteen days out; a kickoff that far away has a forecast worth
 * about as much as a guess, and printing one next to a fixture would be the
 * failure `live-core.ts` refuses for the match minute — a precise-looking number
 * the data does not support. Current conditions are true when they are read, and
 * `readAt` says when that was.
 */
import type { WeatherKind, WeatherSnapshot } from "@/src/types";

export const OPEN_METEO_BASE_URL = "https://api.open-meteo.com/v1/forecast";

/**
 * Build the request for one point.
 *
 * Coordinates are rounded to four decimals — about 11 m, far finer than any
 * weather model resolves — because it is also the **cache key**. Full float
 * precision would give two callers asking about one stadium two different
 * strings, and the whole point of the cache is that twenty readers on a match
 * page cost one upstream request.
 */
export const buildWeatherUrl = ([lat, lon]: readonly [number, number]): string => {
  const params = new URLSearchParams({
    latitude: lat.toFixed(4),
    longitude: lon.toFixed(4),
    current: "temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,is_day",
    wind_speed_unit: "kmh",
    timezone: "auto",
  });
  return `${OPEN_METEO_BASE_URL}?${params.toString()}`;
};

interface WmoLabel {
  label: string;
  kind: WeatherKind;
}

/**
 * WMO weather interpretation codes, in pt-BR.
 *
 * Hand-written, and the descriptions are the Brazilian ones rather than
 * translations of the English: `garoa` is what 51-55 is called here, not
 * "chuvisco leve", and 95-99 are *temporais* rather than "tempestades". Codes
 * this table does not know degrade to a neutral label instead of blanking the
 * card — the same rule `positionLabel` follows for a position it has no
 * translation for, and for the same reason: something true and vague beats
 * nothing.
 */
const WMO: Record<number, WmoLabel> = {
  0: { label: "Céu limpo", kind: "clear" },
  1: { label: "Predominantemente limpo", kind: "clear" },
  2: { label: "Parcialmente nublado", kind: "cloudy" },
  3: { label: "Nublado", kind: "cloudy" },
  45: { label: "Névoa", kind: "fog" },
  48: { label: "Névoa congelante", kind: "fog" },
  51: { label: "Garoa fraca", kind: "rain" },
  53: { label: "Garoa", kind: "rain" },
  55: { label: "Garoa forte", kind: "rain" },
  56: { label: "Garoa congelante", kind: "rain" },
  57: { label: "Garoa congelante forte", kind: "rain" },
  61: { label: "Chuva fraca", kind: "rain" },
  63: { label: "Chuva", kind: "rain" },
  65: { label: "Chuva forte", kind: "rain" },
  66: { label: "Chuva congelante", kind: "rain" },
  67: { label: "Chuva congelante forte", kind: "rain" },
  71: { label: "Neve fraca", kind: "snow" },
  73: { label: "Neve", kind: "snow" },
  75: { label: "Neve forte", kind: "snow" },
  77: { label: "Grãos de neve", kind: "snow" },
  80: { label: "Pancadas de chuva", kind: "rain" },
  81: { label: "Pancadas de chuva fortes", kind: "rain" },
  82: { label: "Pancadas de chuva muito fortes", kind: "rain" },
  85: { label: "Pancadas de neve", kind: "snow" },
  86: { label: "Pancadas de neve fortes", kind: "snow" },
  95: { label: "Temporal", kind: "storm" },
  96: { label: "Temporal com granizo", kind: "storm" },
  99: { label: "Temporal com granizo forte", kind: "storm" },
};

const UNKNOWN: WmoLabel = { label: "Condições indefinidas", kind: "cloudy" };

/**
 * The pt-BR description of a WMO code, and which of the six skies to draw.
 *
 * **It returns a kind rather than a character, and that is the second time this
 * codebase has reached that answer.** The first draft used `☀`/`☁`/`☂`, and a
 * test asserting no glyph is Extended_Pictographic went red on the very first
 * one: U+2600 is emoji-presentation on several platforms, so a mark meant to sit
 * in `currentColor` beside 24px icons would render as a colour picture at
 * whatever size the font decided. That is exactly what `SunIcon` and `MoonIcon`
 * exist for — see the theme-toggle note in CLAUDE.md — so the drawing belongs in
 * `SectionIcons.tsx` and this module names the sky instead.
 */
export const describeWeather = (code: number): { label: string; kind: WeatherKind } => {
  const entry = WMO[code] ?? UNKNOWN;
  return { label: entry.label, kind: entry.kind };
};

/** True where the table has a real entry, so a caller can tell a described sky
 *  from a shrugged one. Used by the test that keeps the table honest. */
export const isKnownWeatherCode = (code: number): boolean => code in WMO;

const finite = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

/**
 * Narrow Open-Meteo's payload into a `WeatherSnapshot`.
 *
 * Field by field, with everything but the temperature allowed to be absent —
 * the same shape `parseHealth` uses and for the same reason: this is somebody
 * else's JSON, the app cannot assume it understands it, and a card that omits
 * the humidity is better than one printing `undefined`. **Temperature is the one
 * required field**, because a weather card with no temperature is not a weather
 * card; without it this answers null and the caller says nothing at all.
 */
export const parseWeather = (payload: unknown, readAt: string): WeatherSnapshot | null => {
  if (typeof payload !== "object" || payload === null) return null;
  const current = (payload as { current?: unknown }).current;
  if (typeof current !== "object" || current === null) return null;
  const c = current as Record<string, unknown>;

  const temperature = finite(c.temperature_2m);
  if (temperature === null) return null;

  const code = finite(c.weather_code);
  const described = describeWeather(code ?? -1);

  const snapshot: WeatherSnapshot = {
    temperature,
    label: described.label,
    kind: described.kind,
    // `is_day` arrives as 1/0 rather than a boolean, and absent means day. It
    // rides along because a clear sky is drawn differently after dark — the
    // only thing darkness changes, since "céu limpo" is true at midnight.
    day: finite(c.is_day) !== 0,
    readAt,
  };
  const feelsLike = finite(c.apparent_temperature);
  if (feelsLike !== null) snapshot.feelsLike = feelsLike;
  const humidity = finite(c.relative_humidity_2m);
  if (humidity !== null) snapshot.humidity = humidity;
  const wind = finite(c.wind_speed_10m);
  if (wind !== null) snapshot.windSpeed = wind;
  return snapshot;
};

/** `23 °C` — whole degrees, because a tenth is precision nobody acts on and the
 *  card is read at a glance. The space before the unit is the SI convention and
 *  the one pt-BR uses. */
export const temperatureLabel = (celsius: number): string =>
  `${Math.round(celsius)} °C`;

/** `12 km/h`, same rounding rule. */
export const windLabel = (kmh: number): string => `${Math.round(kmh)} km/h`;

/** `78%` — no space, which is the pt-BR convention for percent and the one
 *  `pointsPercentageLabel` already follows in this codebase. */
export const humidityLabel = (percent: number): string => `${Math.round(percent)}%`;
