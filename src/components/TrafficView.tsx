import { useEffect, useMemo, useState } from "react";

import { countLabel } from "@/count-core";
import { controlClasses } from "@/src/components/Button";
import { BACK_LINK } from "@/src/components/interaction";
import { Surface } from "@/src/components/Surface";
import {
  botShareLabel,
  chronologicalDays,
  rateChartSeries,
  statusClassTotals,
  timelineGeometry,
} from "@/traffic-report-core";
import type { TrafficCountRow, TrafficDashboard, TrafficSnapshot } from "@/src/types";

/**
 * `/trafego` — this deployment's own nginx access log, read back as charts.
 *
 * **Unlisted, not private.** Absent from `NAV_ITEMS`, `noindex`, `Disallow`ed
 * and out of the sitemap, so nothing links here — but the address works for
 * anybody who has it. What makes that acceptable is upstream of this file: the
 * host aggregates before it writes, so no visitor address exists in the payload
 * to leak. If that ever stops being true, this page needs a session before the
 * data does.
 *
 * **Every chart is inline SVG or flexbox, and no charting library is added**,
 * which is this app's standing answer — `RankSparkline`, `RankCandles` and the
 * Perfil scatters are all hand-drawn for the same reason. A dependency to draw
 * six bar lists on a page nobody navigates to is a poor trade.
 *
 * Two readings on this page are easy to get backwards, and both are named in
 * the copy rather than left to the reader:
 *
 * - **The counts are cumulative over nginx's whole log window, not per hour.**
 *   Each snapshot re-reads the entire log, so "Requisições" rises between
 *   snapshots. The rate chart is the difference between consecutive snapshots,
 *   and it is the only thing here that answers "how busy is it now".
 * - **"Endereços" is not "visitors".** One household behind one address is one;
 *   one reader crossing between mobile networks is several. The word is
 *   deliberately the mechanical one — `StadiumWeather`'s rule about naming what
 *   a proxy actually counts.
 */


/**
 * **Every mark on this page is one tone, and the status classes are the single
 * exception.** That is a decision reversed after looking at it: the first
 * version gave each panel its own role — primary, tertiary, secondary — and two
 * things were wrong with it, one visible and one not.
 *
 * The visible one is `RankCandles`' two greys again. On the light palette
 * `secondary` is #4d6357 and `tertiary` is #3d6473, two desaturated darks that
 * are a hue apart on paper and indistinguishable in a 6px bar. Measured in the
 * page rather than guessed.
 *
 * The one that matters is that **the colour was encoding nothing.** Every bar
 * list here is a single series, so a different hue per panel invites a reader
 * to think blue means something green does not. It matters most exactly where
 * the first version differed most: "Países por endereço" and "Países por
 * volume" sit side by side and are read *against* each other — same quantity,
 * two questions — so painting them alike is what says so.
 *
 * Colour therefore means one thing on this page: which class an HTTP status
 * falls in. There it is semantic (`positive`, `warning`, `error`) rather than
 * categorical, and it stays.
 */
const TONE = "text-primary";

/** The rate chart's two series, named once so the key, the `aria-label` and the
 *  `<title>` cannot come to disagree — `StatusChip`'s rule for a lookup table
 *  that had been written out twice. */
const LABEL_VISITOR = "Visitantes: requisições por minuto causadas por um navegador neste site";
const LABEL_PHYSICAL = "Físico: todos os acessos que o servidor serviu, robôs e monitoramento incluídos";

/**
 * The rate chart's key.
 *
 * It exists because the pair is separated by **dash and weight rather than by
 * hue** — see `TimeLine`'s `context` — and a difference in stroke carries no
 * meaning a reader can guess. Stated once beside the figure, in `ScatterKey`'s
 * arrangement and for its reason: two marks sharing one vocabulary make a
 * reader check whether two statements of it agree.
 *
 * The swatches are `<svg>` and not a border-styled `<span>`, so the sample is
 * drawn by the same stroke properties as the line it names.
 */
function LineKey({ entries }: { entries: { label: string; dashed?: boolean }[] }) {
  return (
    <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-label-small text-ink-muted">
      {entries.map((entry) => (
        <li key={entry.label} className="flex items-center gap-1.5">
          <svg viewBox="0 0 24 8" className={`h-2 w-6 shrink-0 ${TONE}`} aria-hidden="true">
            <path
              d="M1 4 H23"
              fill="none"
              stroke="currentColor"
              strokeWidth={entry.dashed ? 1.5 : 2}
              strokeDasharray={entry.dashed ? "5 4" : undefined}
              strokeOpacity={entry.dashed ? 0.45 : 1}
              strokeLinecap="round"
            />
          </svg>
          <span>{entry.label}</span>
        </li>
      ))}
    </ul>
  );
}

// ── Building blocks ─────────────────────────────────────────────────────────

/** A figure with its caption beneath, in the Ficha idiom the player card uses:
 *  the number at a headline step in `primary`, the unit in the caption. */
function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Surface filled className="px-3 py-2">
      <p className="text-label-medium uppercase text-ink-faint">{label}</p>
      <p className="mt-0.5 text-headline-small font-bold tabular-nums text-primary">{value}</p>
      {hint ? <p className="mt-0.5 text-body-small text-ink-muted">{hint}</p> : null}
    </Surface>
  );
}

/** A titled panel. Padding stays here rather than in `Surface`, which owns the
 *  chrome alone — the rule that component's own comment states. */
function Panel({
  title,
  caption,
  children,
  action,
}: {
  title: string;
  caption: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <Surface filled className="px-4 py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-title-small font-semibold">{title}</h3>
        {action}
      </div>
      <p className="mt-0.5 text-body-small text-ink-muted">{caption}</p>
      <div className="mt-3">{children}</div>
    </Surface>
  );
}

/**
 * A ranked list as horizontal bars.
 *
 * **The bar is length from zero and that is correct here**, which is the
 * opposite of the Perfil marker's rule and for the reason that rule gives: a
 * count *is* a magnitude, so zero is meaningful and twice the bar is twice the
 * traffic. The Perfil plots a position within a range, where zero is not.
 *
 * Labels are truncated with the full value in `title`, because a referrer is
 * somebody else's URL and a path can be any length — and the count sits outside
 * the truncation so the number is never the thing that gets cut.
 */
function Bars({ rows, max = 12 }: { rows: TrafficCountRow[]; max?: number }) {
  const shown = rows.slice(0, max);
  // At least 1, or a list of zeroes divides by zero and every bar renders NaN%.
  const top = Math.max(1, ...shown.map((row) => row.count));

  if (shown.length === 0) {
    return <p className="py-4 text-center text-body-small text-ink-faint">Sem dados.</p>;
  }

  return (
    <ul className="flex flex-col gap-2">
      {shown.map((row) => (
        <li key={row.label} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
          <div className="min-w-0">
            <p className="truncate text-body-small text-on-surface-variant" title={row.label}>
              {row.label}
            </p>
            <div className="mt-1 h-1.5 overflow-hidden rounded-x-small bg-surface-container-high">
              <div
                className={`h-full rounded-x-small bg-current transition-[width] ${TONE}`}
                style={{ width: `${(row.count / top) * 100}%` }}
              />
            </div>
          </div>
          <span className="shrink-0 text-body-small tabular-nums text-ink-muted">
            {countLabel(row.count)}
          </span>
        </li>
      ))}
    </ul>
  );
}

/**
 * One series over time, as a line.
 *
 * The x axis is the snapshot's own instant, so an hour the timer missed leaves
 * a longer segment rather than a gap the eye reads as a level stretch — the
 * points carry their real time and the line joins them.
 *
 * Axis labels are **HTML around the SVG, never `<text>` inside it** —
 * `RankCandles`' rule, and for its reason: a drawing that scales to its
 * container scales its type with it, so a label sized for a desktop is six
 * pixels tall on a phone.
 */
const TIMELINE_BOX = { width: 720, height: 200 };
const TIMELINE_PAD = 6;

function TimeLine({
  points,
  label,
  context,
  empty,
}: {
  points: { x: number; y: number }[];
  label: string;
  /**
   * A second series drawn behind the first, on the **same axes**, for reading
   * the claim against its own context — here, everything the server served
   * behind what a person read.
   *
   * It is separated by **weight and dash, never by hue**. Every mark on this
   * page is one tone deliberately: on the light palette `secondary` and
   * `tertiary` are two desaturated darks indistinguishable in a thin stroke,
   * and more to the point a second colour invites a reader to think it encodes
   * something a first colour does not. `RankCandles` draws an absent round
   * hollow for the same reason, and `scatterTrail` ramps opacity rather than
   * reaching for a second token.
   */
  context?: { points: { x: number; y: number }[]; label: string };
  /** What to say when there is nothing to draw. The default answers "too few
   *  snapshots"; a filtered series has a different reason and must give it. */
  empty?: string;
}) {
  // The shared scale, the zero floor and the one-instant caption are
  // `timelineGeometry`'s, beside the series it draws.
  const drawn = useMemo(
    () => timelineGeometry(points, context?.points ?? [], { ...TIMELINE_BOX, pad: TIMELINE_PAD }),
    [points, context],
  );

  if (!drawn) {
    return (
      <p className="py-8 text-center text-body-small text-ink-faint">
        {empty ?? "Ainda não há instantâneos suficientes para desenhar uma linha."}
      </p>
    );
  }

  const day = (d: Date) =>
    d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

  return (
    <figure className="m-0">
      <div className="flex items-stretch gap-2">
        <div className="flex flex-col justify-between text-label-small text-ink-faint">
          <span className="tabular-nums">{countLabel(drawn.maxY)}</span>
          <span className="tabular-nums">0</span>
        </div>
        <svg
          viewBox={`0 0 ${TIMELINE_BOX.width} ${TIMELINE_BOX.height}`}
          // `grow min-w-0` and deliberately not `w-full`: inside this flex row
          // `w-full` is 100% of the container rather than of what the y-axis
          // gutter leaves, which is how RankCandles came to paint outside its
          // card while every assertion about it passed.
          className={`h-40 grow min-w-0 ${TONE}`}
          preserveAspectRatio="none"
          role="img"
          aria-label={context ? `${label}; ${context.label}` : label}
        >
          <title>{context ? `${label}; ${context.label}` : label}</title>
          {/* Behind the primary, so the claim is never occluded by its own
              context where the two coincide. */}
          {drawn.contextD ? (
            <path
              d={drawn.contextD}
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              strokeDasharray="5 4"
              strokeOpacity={0.45}
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          ) : null}
          <path
            d={drawn.d}
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            // The box scales non-uniformly to fit a phone, so without this the
            // line thins horizontally and thickens vertically.
            vectorEffect="non-scaling-stroke"
          />
          {/* Where the series stands now — and **the entire mark when there is
              only one snapshot**, since a one-point path is a bare moveto and
              draws nothing at all. `RankSparkline` carries this exact circle for
              this exact reason, and leaving it out here shipped a panel that was
              an empty box with axis labels on the day the timer was installed:
              `getTotalLength()` measured 0 in the live page. The radius is in
              user units under `preserveAspectRatio="none"`, so it is an ellipse
              at most widths; that is a mark, not a measurement, and matching the
              line's own non-uniform scaling is what keeps it on the line. */}
          <circle cx={drawn.end.x} cy={drawn.end.y} r={3} fill="currentColor" />
        </svg>
      </div>
      <figcaption className="mt-1 flex justify-between text-label-small text-ink-faint">
        <span>{day(new Date(drawn.minX))}</span>
        {drawn.single ? null : <span>{day(new Date(drawn.maxX))}</span>}
      </figcaption>
    </figure>
  );
}

/** Requests per hour of day, 00–23. Twenty-four columns rather than a line: an
 *  hour is a bucket, and a line between buckets implies values in between. */
function Hours({ byHour }: { byHour: Record<string, number> }) {
  const hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
  const values = hours.map((h) => byHour[h] ?? 0);
  const top = Math.max(1, ...values);

  return (
    <div>
      <div className="flex h-32 items-end gap-0.5">
        {hours.map((hour, i) => (
          <div
            key={hour}
            className="flex h-full flex-1 items-end rounded-x-small bg-surface-container-high"
            title={`${hour}h · ${countLabel(values[i])} requisições`}
          >
            <div
              className="w-full rounded-x-small bg-primary transition-[height]"
              // A minimum of 1px for a non-zero hour: at 128px tall against a
              // busy peak, a quiet hour rounds to nothing and reads as an hour
              // the site was down.
              style={{ height: values[i] === 0 ? 0 : `max(1px, ${(values[i] / top) * 100}%)` }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-label-small text-ink-faint">
        {["00", "06", "12", "18", "23"].map((h) => (
          <span key={h}>{h}h</span>
        ))}
      </div>
    </div>
  );
}

/**
 * Status codes, aggregated into their classes.
 *
 * Aggregated because the individual codes are a long tail nobody reads — the
 * question a person opens this for is "how much of this is failing", and 404
 * against 410 is not that question. The exact codes stay available beneath.
 */
const STATUS_CLASSES = [
  { key: "2xx", label: "Sucesso", tone: "bg-positive" },
  { key: "3xx", label: "Redirecionamento", tone: "bg-tertiary" },
  { key: "4xx", label: "Erro do cliente", tone: "bg-warning" },
  { key: "5xx", label: "Erro do servidor", tone: "bg-error" },
  { key: "outros", label: "Outros", tone: "bg-outline" },
] as const;

function Statuses({ statusCodes }: { statusCodes: TrafficCountRow[] }) {
  const byClass = statusClassTotals(statusCodes);
  const total = [...byClass.values()].reduce((sum, n) => sum + n, 0);
  const present = STATUS_CLASSES.filter((c) => (byClass.get(c.key) ?? 0) > 0);

  if (total === 0) {
    return <p className="py-4 text-center text-body-small text-ink-faint">Sem dados.</p>;
  }

  return (
    <div>
      <div className="flex h-4 w-full overflow-hidden rounded-x-small" role="presentation">
        {present.map((c) => (
          <div
            key={c.key}
            className={c.tone}
            style={{ width: `${((byClass.get(c.key) ?? 0) / total) * 100}%` }}
            title={`${c.label} · ${countLabel(byClass.get(c.key))}`}
          />
        ))}
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
        {present.map((c) => (
          <li key={c.key} className="flex items-center gap-1.5 text-body-small text-ink-muted">
            <span className={`inline-block h-2 w-2 rounded-full ${c.tone}`} aria-hidden="true" />
            {c.label}
            <span className="tabular-nums text-on-surface">{countLabel(byClass.get(c.key))}</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-body-small text-ink-faint">
        Códigos exatos:{" "}
        {statusCodes.map((row, i) => (
          <span key={row.label}>
            {i > 0 ? " · " : ""}
            <span className="tabular-nums">{row.label}</span> ({countLabel(row.count)})
          </span>
        ))}
      </p>
    </div>
  );
}


// ── The page ────────────────────────────────────────────────────────────────

type Payload = { source: string; note: string; updatedAt: string; data: TrafficDashboard };

export function TrafficView({ onBack }: { onBack: () => void }) {
  const [payload, setPayload] = useState<Payload | null>(null);
  const [failed, setFailed] = useState(false);
  /** Country filter for the rate chart. Empty is every country together. */
  const [country, setCountry] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/traffic-dashboard")
      .then((response) => (response.ok ? (response.json() as Promise<Payload>) : null))
      .then((body) => {
        if (cancelled) return;
        if (body) setPayload(body);
        else setFailed(true);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const timeline = payload?.data.timeline ?? [];

  /**
   * The rate chart's series.
   *
   * **Two views of the same hour: physical and real.** `Físico` is every access
   * the server served — robots, scanners, monitoring and people. `Visitantes`
   * is the traffic a browser on this site caused. The gap between the strokes
   * is everything that was not a person.
   *
   * **`Visitantes` is not `Físico` minus `monitorHits`, which is what #375
   * shipped and what the host's own log refuted.** That definition was wrong
   * in both directions at once: it subtracted readers, because `App.tsx`
   * fetches `/api/health` for the Rodapé on every page view, and it counted
   * crawlers and scanners as reading. The 02:00Z hour of 2026-09-05 is the
   * demonstration — **673 requests, 22 of them browser-caused**, drawn by the
   * old definition at about 10/min as though people had been there. 643 of
   * that hour came from one address probing `/wp-config.php.bak`, `/aws/*` and
   * Vite's `/@fs/`, spoofing four AI-crawler user agents.
   *
   * **A country gets one line and not a pair**, because the report's geo
   * sections tally every line by address, monitoring included — there is no
   * per-country monitor figure to subtract, and inventing the pair by
   * subtracting the *global* one would attribute every poll to whichever
   * country was selected. The key says which quantity is on screen.
   *
   * A country absent from a snapshot's top-20 is **skipped rather than counted
   * as zero** — the report ranks and truncates, so "not in the top twenty" is
   * not "no traffic", and drawing it as a zero would invent a collapse. Same
   * rule for a snapshot with no monitor figure, which is one written before
   * `12_traffic_report.sh` counted them. Every one of those rules is
   * `rateChartSeries`' in `traffic-report-core`, beside the payload's own rates,
   * so the clamp, the skip and the choice of pair cannot drift between what the
   * page draws and what the payload says. The page adds only the label.
   */
  const rate = useMemo(() => {
    const series = rateChartSeries(timeline, country);
    return {
      primary: series.primary,
      context: series.context ? { points: series.context, label: LABEL_PHYSICAL } : undefined,
      filtered: series.filtered,
    };
  }, [timeline, country]);

  const heading = (
    <>
      <button type="button" onClick={onBack} className={BACK_LINK}>
        ← Voltar
      </button>
      <h2 className="mt-3 text-title-large font-bold">Tráfego</h2>
    </>
  );

  if (failed) {
    return (
      <section aria-labelledby="trafego-titulo" className="max-w-5xl">
        {heading}
        <p className="mt-2 text-body-medium text-ink-muted">
          Não foi possível ler os instantâneos de tráfego.
        </p>
      </section>
    );
  }

  if (!payload) {
    return (
      <section aria-labelledby="trafego-titulo" className="max-w-5xl">
        {heading}
        <p className="mt-2 text-body-medium text-ink-muted">Lendo os instantâneos…</p>
      </section>
    );
  }

  const latest: TrafficSnapshot | null = payload.data.latest;

  if (!latest) {
    return (
      <section aria-labelledby="trafego-titulo" className="max-w-5xl">
        {heading}
        <p className="mt-2 text-body-medium text-ink-muted">{payload.note}</p>
        <Surface filled className="mt-4 px-4 py-3">
          <p className="text-body-medium text-ink-muted">
            Os instantâneos são escritos no próprio servidor, de hora em hora, por{" "}
            <code className="text-body-small">shell_scripts/12_traffic_report.sh</code>. Num
            checkout de desenvolvimento não existe nenhum, e esta é a resposta esperada — não
            um erro.
          </p>
        </Surface>
      </section>
    );
  }

  const read = new Date(latest.generated);
  // Both geo blocks are conditional, and the country one has to be for the same
  // reason the city one already was: without a GeoLite2 database on the host
  // there is nothing to draw, and two cards reading "Sem dados." side by side
  // report an absence of *visitors* where the truth is an absence of a
  // *lookup table*. The rodapé below says exactly that, and until this gate
  // existed it said it while both cards were on the page — the sentence "não há
  // seções de país nem de cidade" is written for a page where they are hidden.
  //
  // Gated on the rows rather than on `geoSource`, mirroring the cities: a
  // country-level database answers the country sections and not the city ones,
  // so `geoSource` is set while `citiesBy*` is empty, and one rule that reads
  // "draw a panel when it has rows" covers both without a second condition to
  // keep true.
  const hasCountries = latest.countriesByVisitor.length > 0 || latest.countriesByVolume.length > 0;
  const hasCities = latest.citiesByVisitor.length > 0 || latest.citiesByVolume.length > 0;

  return (
    <section aria-labelledby="trafego-titulo" className="max-w-5xl">
      {heading}

      {/* The instant of the reading, never "agora" — the timer writes once an
          hour, so this page is stale by construction and says so, exactly as
          the estádio weather card does. */}
      <p className="mt-2 text-body-medium text-ink-muted">
        {payload.note} Leitura das{" "}
        {read.toLocaleString("pt-BR", {
          day: "2-digit",
          month: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
        })}
        , sobre a janela {latest.dateRange ?? "do log"}.
      </p>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        <Kpi label="Requisições" value={countLabel(latest.requests)} hint="acumulado na janela" />
        <Kpi label="Endereços" value={countLabel(latest.uniqueIps)} hint="distintos, não visitantes" />
        <Kpi
          label="Ritmo médio"
          value={countLabel(payload.data.windowRatePerMin)}
          hint="req/min entre instantâneos"
        />
        <Kpi
          label="Robôs"
          value={botShareLabel(latest) ?? "—"}
          hint={`${countLabel(latest.bots)} de ${countLabel(latest.requests)}`}
        />
        <Kpi
          label="Visitantes"
          value={countLabel(latest.visitorHits)}
          hint="acessos causados por um navegador"
        />
      </div>

      <div className="mt-4 flex flex-col gap-4">
        <Panel
          title="Tráfego acumulado"
          caption="Cada ponto é um instantâneo. A linha sobe porque cada leitura relê o log inteiro — não é o movimento da hora."
        >
          <TimeLine
            points={timeline.flatMap((p) => (p.requests === null ? [] : [{ x: p.t, y: p.requests }]))}
            label="Requisições acumuladas, instantâneo a instantâneo"
          />
        </Panel>

        <Panel
          title="Ritmo de requisições"
          caption={
            rate.filtered
              ? "A diferença entre instantâneos consecutivos, dividida pelo tempo entre eles. Por país é o tráfego físico: o relatório conta cada linha por endereço e não separa robô de pessoa."
              : "A diferença entre instantâneos consecutivos, dividida pelo tempo entre eles. Duas leituras da mesma hora: tudo que o servidor serviu, e o que um navegador neste site causou. A distância entre as linhas é o que não era gente."
          }
          action={
            latest.countriesByVolume.length > 0 ? (
              <label className="flex items-center gap-2 text-body-small text-ink-muted">
                <span>País</span>
                {/* `controlClasses`, like the round picker: a picker is a
                    control, and this one measured 133x26 at 375dp with
                    hand-written chrome and no touch target. */}
                <select
                  value={country}
                  onChange={(event) => setCountry(event.target.value)}
                  className={controlClasses("sm")}
                >
                  <option value="">Todos</option>
                  {latest.countriesByVolume.map((row) => (
                    <option key={row.label} value={row.label}>
                      {row.label}
                    </option>
                  ))}
                </select>
              </label>
            ) : undefined
          }
        >
          <TimeLine
            points={rate.primary}
            context={rate.context}
            label={rate.filtered ? `${LABEL_PHYSICAL} — ${country}` : LABEL_VISITOR}
            // A country with no pair of snapshots naming it is not "too few
            // snapshots", which is what the default says and what the page said
            // for every country on the day the geo database was installed:
            // 41 of 42 summaries predated it, so every selection drew an empty
            // box blaming the timer. The series fills in as snapshots accrue,
            // and until it does the page owes the reason rather than a shrug.
            empty={
              rate.filtered
                ? `Nenhum par de instantâneos consecutivos nomeia ${country}. Um país fora das vinte primeiras linhas de um instantâneo é omitido — e um instantâneo anterior à base de geolocalização não nomeia país nenhum.`
                : undefined
            }
          />
          <LineKey
            entries={
              rate.filtered
                ? [{ label: `Físico — ${country}, robôs e monitoramento incluídos` }]
                : rate.context
                  ? [
                      { label: "Visitantes reais" },
                      { label: "Físico (todos os acessos)", dashed: true },
                    ]
                  : [{ label: "Físico (todos os acessos)" }]
            }
          />
        </Panel>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Panel
            title="Páginas mais pedidas"
            caption="Sem /api/health, que é monitoramento e não leitura — o número dele está no cartão acima."
          >
            <Bars rows={latest.topPaths} max={12} />
          </Panel>
          <Panel title="Requisições por hora" caption="Hora do servidor, somando toda a janela.">
            <Hours byHour={latest.byHour} />
          </Panel>
        </div>

        <Panel title="Códigos de resposta" caption="Agrupados por classe; os códigos exatos ficam abaixo.">
          <Statuses statusCodes={latest.statusCodes} />
        </Panel>

        {hasCountries ? (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Panel
              title="Países por endereço"
              caption="Quantos endereços distintos vieram de cada país."
            >
              <Bars rows={latest.countriesByVisitor} max={10} />
            </Panel>
            <Panel
              title="Países por volume"
              caption="Quantas requisições. Difere do cartão ao lado onde poucos leem muito."
            >
              <Bars rows={latest.countriesByVolume} max={10} />
            </Panel>
          </div>
        ) : null}

        {hasCities ? (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Panel
              title="Cidades por endereço"
              caption="Bem menos precisa que o país, sobretudo em rede móvel — daí o balde (unknown)."
            >
              <Bars rows={latest.citiesByVisitor} max={10} />
            </Panel>
            <Panel title="Cidades por volume" caption="A mesma ressalva de precisão.">
              <Bars rows={latest.citiesByVolume} max={10} />
            </Panel>
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Panel title="Requisições por dia" caption="A janela inteira, dia a dia.">
            <Bars rows={chronologicalDays(latest.byDay)} max={31} />
          </Panel>
          <Panel
            title="Endereços por dia"
            caption="Endereços distintos por dia. Só as contagens saem do servidor."
          >
            <Bars rows={chronologicalDays(latest.uniqueIpsByDay)} max={31} />
          </Panel>
        </div>

        <Panel
          title="De onde vêm"
          caption="Sem as visitas diretas, que o nginx registra como “-” e seriam a maior barra e a menos informativa."
        >
          <Bars rows={latest.referrers} max={12} />
        </Panel>
      </div>

      <p className="mt-4 text-body-small text-ink-faint">
        {latest.geoSource
          ? `Geolocalização por base local (${latest.geoSource}) — nenhum endereço sai do servidor.`
          : "Sem base de geolocalização no servidor, então não há seções de país nem de cidade — rode shell_scripts/14_install_geoip.sh no host para tê-las."}{" "}
        Instantâneo {latest.file}, de {countLabel(latest.logLines)} linhas de log.
        {/* The credit is a condition of the licence, not a courtesy: DB-IP's
            Lite editions are CC BY 4.0 and permit this use only while it is
            shown. It is rendered verbatim from what the report read out of the
            database in use — this component neither composes it nor knows which
            vendor it is crediting, which is what stops the page naming the
            wrong one after somebody swaps the file. If the credit goes, the
            country sections have to go with it. */}
        {latest.geoAttribution ? ` ${latest.geoAttribution}.` : ""}
      </p>
    </section>
  );
}
