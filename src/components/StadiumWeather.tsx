import { useEffect, useState } from "react";

import { fetchStadiumWeather } from "@/src/api";
import { WeatherIcon } from "@/src/components/SectionIcons";
import { Surface } from "@/src/components/Surface";
import { humidityLabel, temperatureLabel, windLabel } from "@/weather-core";
import type { WeatherSnapshot } from "@/src/types";

interface Props {
  /** The stadium's slug — the server resolves the coordinate from it. */
  slug: string;
}

/**
 * **Clima no estádio**: what the sky is doing at the ground, right now.
 *
 * It fetches its own data rather than taking it from the page, because it is
 * the only thing on the stadium page that is not already in a payload the
 * client holds — and because it must be free to fail without touching anything
 * else. **Nothing renders until there is something true to say**: no
 * coordinate, the feature switched off, the upstream unreachable, or a payload
 * that will not parse all end in the same place, which is an absent section
 * rather than an apology. That is the rule the page already applies to a
 * stadium with no inauguration year.
 *
 * There is deliberately **no refresh and no clock**. A reader on a stadium page
 * is not watching the weather change, the cache is fifteen minutes deep, and a
 * ticking component here would re-render the page for a number that moves once
 * an hour — the argument `MeuTimeStrip` makes for owning its own tick, run
 * backwards. The reading's time is printed instead, so the card says how old it
 * is rather than implying it is live.
 */
export function StadiumWeather({ slug }: Props) {
  const [weather, setWeather] = useState<WeatherSnapshot | null>(null);

  useEffect(() => {
    let live = true;
    setWeather(null);
    fetchStadiumWeather(slug)
      .then((envelope) => {
        if (live) setWeather(envelope.data);
      })
      // A weather card is a nicety; it is never a reason to surface an error on
      // a page that has already rendered the ground.
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [slug]);

  if (!weather) return null;

  const readAt = new Date(weather.readAt);
  const time = Number.isNaN(readAt.getTime())
    ? null
    : readAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  return (
    <section className="mt-6">
      <h3 className="text-title-medium font-bold">Clima no estádio</h3>
      <Surface filled className="mt-2 flex items-center gap-4 px-4 py-3">
        <WeatherIcon
          kind={weather.kind}
          day={weather.day}
          className="h-10 w-10 shrink-0 text-primary"
        />
        <div className="min-w-0">
          <p className="text-title-large font-bold tabular-nums">
            {temperatureLabel(weather.temperature)}
          </p>
          <p className="text-body-medium text-ink-soft">{weather.label}</p>
        </div>
        <dl className="ml-auto grid gap-x-4 gap-y-1 text-body-small sm:grid-cols-2">
          {weather.feelsLike !== undefined && (
            <div className="flex gap-2">
              <dt className="text-ink-faint">Sensação</dt>
              <dd className="tabular-nums">{temperatureLabel(weather.feelsLike)}</dd>
            </div>
          )}
          {weather.humidity !== undefined && (
            <div className="flex gap-2">
              <dt className="text-ink-faint">Umidade</dt>
              <dd className="tabular-nums">{humidityLabel(weather.humidity)}</dd>
            </div>
          )}
          {weather.windSpeed !== undefined && (
            <div className="flex gap-2">
              <dt className="text-ink-faint">Vento</dt>
              <dd className="tabular-nums">{windLabel(weather.windSpeed)}</dd>
            </div>
          )}
        </dl>
      </Surface>
      {time && (
        <p className="mt-1 text-body-small text-ink-faint">
          Leitura das {time}, do Open-Meteo.
        </p>
      )}
    </section>
  );
}
