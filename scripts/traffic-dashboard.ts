/**
 * traffic-dashboard.ts
 * --------------------
 * A local dashboard window for the traffic snapshots — one page, served from
 * this machine, with no build step and nothing to install.
 *
 *   npm run traffic-dashboard                      # a local ./traffic-reports
 *   npm run traffic-dashboard -- ./some/dir        # …or another directory
 *   npm run traffic-dashboard -- --url https://brasileirao.mpbarbosa.com
 *   PORT=8080 npm run traffic-dashboard
 *
 * ── Why this exists beside the in-app /trafego page ─────────────────────────
 *
 * Because the two are read in different situations, which is the same reason
 * the sibling this was ported from has both. `/trafego` is the deployed page
 * and needs the deploy to be up. This is a window you can open against a
 * directory of summaries on your own disk — including one from a host that is
 * currently down, which is exactly when somebody wants to look at a traffic
 * chart.
 *
 * ── The --url mode, which is the half the sibling does not have ─────────────
 *
 * It reads `/api/traffic-dashboard` from a running deploy instead of a local
 * directory. That is not a convenience here, it is the only way this window
 * gets real data on this workstation: the snapshots live on the host, and this
 * machine has no SSH, no SSM and no S3 access to fetch them with. The sibling
 * does not need it because its host carries a git checkout and its snapshots
 * are committed.
 *
 * ── One parser, and deliberately not a second ──────────────────────────────
 *
 * This imports `traffic-report-core` rather than re-parsing the summaries, so
 * this window and the deployed page cannot come to disagree about what a
 * summary says. The sibling's dashboard is a standalone `.mjs` that carried its
 * own copy of the parsing, and the copy was extracted into a core module later
 * precisely because two of them is where drift starts — `commons-core.ts` and
 * `scripts/commons-api.ts` draw the same line. Being a `.ts` run through tsx is
 * what buys that; nothing about the page needs it.
 */
import { createServer } from "node:http";
import { readdirSync, readFileSync } from "node:fs";
import { resolve, join } from "node:path";

import { buildTrafficDashboard } from "@/traffic-report-core";
import type { ApiEnvelope, TrafficCountRow, TrafficDashboard } from "@/src/types";

const args = process.argv.slice(2);
const urlFlag = args.indexOf("--url");
const REMOTE = urlFlag >= 0 ? args[urlFlag + 1]?.replace(/\/+$/, "") : null;
const DIR = resolve(args.find((a) => !a.startsWith("--") && a !== REMOTE) ?? "traffic-reports");
const PORT = Number(process.env.PORT) || 4317;

if (urlFlag >= 0 && !REMOTE) {
  console.error("--url needs an address, e.g. --url https://brasileirao.mpbarbosa.com");
  process.exit(1);
}

const load = async (): Promise<ApiEnvelope<TrafficDashboard>> => {
  if (REMOTE) {
    const response = await fetch(`${REMOTE}/api/traffic-dashboard`);
    if (!response.ok) throw new Error(`${REMOTE} respondeu ${response.status}`);
    return (await response.json()) as ApiEnvelope<TrafficDashboard>;
  }
  let files: { file: string; text: string }[] = [];
  try {
    files = readdirSync(DIR)
      .filter((file) => /^summary-.*\.txt$/.test(file))
      .map((file) => ({ file, text: readFileSync(join(DIR, file), "utf8") }));
  } catch {
    // An absent directory is the ordinary state of a fresh checkout, and the
    // page says so rather than the server refusing to start.
    files = [];
  }
  return buildTrafficDashboard(files, new Date().toISOString());
};

// ── Rendering ───────────────────────────────────────────────────────────────

const esc = (value: string): string =>
  value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const fmt = (n: number | null | undefined): string =>
  n == null ? "—" : n.toLocaleString("pt-BR");

/**
 * The page's own colours, and the one place in this repository where writing a
 * hex is right. The design-token gate forbids them under `src/`, because that
 * is the app, where `src/index.css` is the single source and a second copy
 * drifts. This page is not the app: it never loads that stylesheet, so it has
 * no tokens to reach for and a hard-coded value is the only kind there is.
 */
const INK = { bg: "#111318", panel: "#191c20", line: "#43474e", text: "#e1e2e9", muted: "#a8abb4", faint: "#8d9199" };
/** One accent for every mark, and the status classes as the single exception —
 *  the same rule `TrafficView` states at length and for the same reason: every
 *  bar list here is one series, so a hue per panel would encode nothing while
 *  looking as though it did. */
const ACCENT = "#6fdba9";
const STATUS = { "2xx": "#51be8f", "3xx": "#a5cdde", "4xx": "#ee9800", "5xx": "#ff5448", outros: "#8d9199" };

const bars = (rows: TrafficCountRow[], max: number, color: string): string => {
  const shown = rows.slice(0, max);
  if (shown.length === 0) return `<p class="empty">Sem dados.</p>`;
  const top = Math.max(1, ...shown.map((r) => r.count));
  return shown
    .map(
      (r) => `<div class="bar">
        <div class="bar-label" title="${esc(r.label)}">${esc(r.label)}</div>
        <div class="bar-track"><div class="bar-fill" style="width:${(r.count / top) * 100}%;background:${color}"></div></div>
        <div class="bar-count">${fmt(r.count)}</div>
      </div>`,
    )
    .join("");
};

const line = (points: { x: number; y: number }[], color: string): string => {
  if (points.length < 2) return `<p class="empty">Poucos instantâneos para uma linha.</p>`;
  const w = 900;
  const h = 220;
  const pad = 8;
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const minX = Math.min(...xs);
  const spanX = Math.max(...xs) - minX || 1;
  // Zero-based, like the in-app chart: these are counts, and a floor at the
  // minimum makes a flat week look like a cliff.
  const spanY = Math.max(...ys) || 1;
  const d = points
    .map((p, i) => {
      const x = pad + ((p.x - minX) / spanX) * (w - pad * 2);
      const y = h - pad - (p.y / spanY) * (h - pad * 2);
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
  const when = (ms: number) =>
    new Date(ms).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  return `<div class="chart">
      <div class="y-axis"><span>${fmt(Math.max(...ys))}</span><span>0</span></div>
      <svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" role="img" aria-label="série temporal">
        <path d="${d}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round"
              stroke-linecap="round" vector-effect="non-scaling-stroke" />
      </svg>
    </div>
    <div class="x-axis"><span>${when(minX)}</span><span>${when(Math.max(...xs))}</span></div>`;
};

const hours = (byHour: Record<string, number>): string => {
  const keys = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
  const values = keys.map((k) => byHour[k] ?? 0);
  const top = Math.max(1, ...values);
  return `<div class="hours">${keys
    .map(
      (k, i) =>
        `<div class="hour" title="${k}h · ${fmt(values[i])}"><div style="height:${
          values[i] === 0 ? 0 : Math.max(1, (values[i] / top) * 100)
        }%;background:${ACCENT}"></div></div>`,
    )
    .join("")}</div>
    <div class="x-axis"><span>00h</span><span>06h</span><span>12h</span><span>18h</span><span>23h</span></div>`;
};

const statusClass = (code: string): keyof typeof STATUS => {
  const n = Number(code);
  if (n >= 200 && n < 300) return "2xx";
  if (n >= 300 && n < 400) return "3xx";
  if (n >= 400 && n < 500) return "4xx";
  if (n >= 500 && n < 600) return "5xx";
  return "outros";
};

const statuses = (rows: TrafficCountRow[]): string => {
  const byClass = new Map<string, number>();
  for (const row of rows) {
    const key = statusClass(row.label);
    byClass.set(key, (byClass.get(key) ?? 0) + row.count);
  }
  const total = [...byClass.values()].reduce((sum, n) => sum + n, 0);
  if (total === 0) return `<p class="empty">Sem dados.</p>`;
  const present = [...byClass.entries()].sort((a, b) => b[1] - a[1]);
  return `<div class="stack">${present
    .map(
      ([key, count]) =>
        `<div style="width:${(count / total) * 100}%;background:${STATUS[key as keyof typeof STATUS]}" title="${key} · ${fmt(count)}"></div>`,
    )
    .join("")}</div>
    <div class="chips">${present
      .map(
        ([key, count]) =>
          `<span class="chip"><i style="background:${STATUS[key as keyof typeof STATUS]}"></i>${key} · ${fmt(count)}</span>`,
      )
      .join("")}</div>`;
};

const MONTHS: Record<string, number> = {
  Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
  Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
};
const chronological = (rows: TrafficCountRow[]): TrafficCountRow[] =>
  rows.slice().sort((a, b) => {
    const key = (label: string) => {
      const m = label.match(/(\d+)\/(\w+)\/(\d+)/);
      return m ? Date.UTC(Number(m[3]), MONTHS[m[2]] ?? 0, Number(m[1])) : 0;
    };
    return key(a.label) - key(b.label);
  });

const page = (payload: ApiEnvelope<TrafficDashboard>): string => {
  const { data } = payload;
  const latest = data.latest;
  const origin = REMOTE ? `${REMOTE}/api/traffic-dashboard` : DIR;

  if (!latest) {
    return shell(`<h1>Tráfego</h1>
      <p class="muted">${esc(payload.note)}</p>
      <div class="panel"><p class="muted">Lendo de <code>${esc(origin)}</code>. Os instantâneos
      são escritos no servidor por <code>shell_scripts/12_traffic_report.sh</code>; num checkout
      de desenvolvimento não existe nenhum, e esta é a resposta esperada.<br><br>
      Para ver os do servidor sem acesso a ele:
      <code>npm run traffic-dashboard -- --url https://brasileirao.mpbarbosa.com</code></p></div>`);
  }

  const read = new Date(latest.generated).toLocaleString("pt-BR");
  const botShare =
    latest.requests && latest.bots != null ? ((latest.bots / latest.requests) * 100).toFixed(1) : null;
  const cities = latest.citiesByVisitor.length > 0 || latest.citiesByVolume.length > 0;

  return shell(`<h1>Tráfego</h1>
    <p class="muted">${esc(payload.note)} Leitura de ${esc(read)}, sobre a janela
      ${esc(latest.dateRange ?? "do log")}. Origem: <code>${esc(origin)}</code>.</p>

    <div class="kpis">
      ${kpi("Requisições", fmt(latest.requests), "acumulado na janela")}
      ${kpi("Endereços", fmt(latest.uniqueIps), "distintos, não visitantes")}
      ${kpi("Ritmo médio", fmt(data.windowRatePerMin), "req/min entre instantâneos")}
      ${kpi("Robôs", botShare == null ? "—" : `${botShare.replace(".", ",")}%`, `${fmt(latest.bots)} de ${fmt(latest.requests)}`)}
      ${kpi("Monitoramento", fmt(latest.monitorHits), "/api/health, fora do ranking")}
      ${kpi("Instantâneos", fmt(data.snapshotCount), "na janela lida")}
    </div>

    ${panel("Tráfego acumulado", "Cada ponto é um instantâneo; a linha sobe porque cada leitura relê o log inteiro.", line(data.timeline.map((p) => ({ x: p.t, y: p.requests })), ACCENT))}
    ${panel("Ritmo de requisições", "A diferença entre instantâneos, dividida pelo tempo entre eles.", line(data.timeline.filter((p) => p.ratePerMin != null).map((p) => ({ x: p.t, y: p.ratePerMin as number })), ACCENT))}

    <div class="grid">
      ${panel("Páginas mais pedidas", "Sem /api/health, que é monitoramento.", bars(latest.topPaths, 12, ACCENT))}
      ${panel("Requisições por hora", "Hora do servidor, somando toda a janela.", hours(latest.byHour))}
    </div>

    ${panel("Códigos de resposta", "Agrupados por classe.", statuses(latest.statusCodes))}

    <div class="grid">
      ${panel("Países por endereço", "Endereços distintos por país.", bars(latest.countriesByVisitor, 10, ACCENT))}
      ${panel("Países por volume", "Requisições por país.", bars(latest.countriesByVolume, 10, ACCENT))}
    </div>

    ${cities ? `<div class="grid">
      ${panel("Cidades por endereço", "Bem menos precisa que o país.", bars(latest.citiesByVisitor, 10, ACCENT))}
      ${panel("Cidades por volume", "A mesma ressalva.", bars(latest.citiesByVolume, 10, ACCENT))}
    </div>` : ""}

    <div class="grid">
      ${panel("Requisições por dia", "A janela inteira, dia a dia.", bars(chronological(latest.byDay), 31, ACCENT))}
      ${panel("Endereços por dia", "Só as contagens saem do servidor.", bars(chronological(latest.uniqueIpsByDay), 31, ACCENT))}
    </div>

    ${panel("De onde vêm", "Sem as visitas diretas, que o nginx registra como “-”.", bars(latest.referrers, 12, ACCENT))}

    <p class="muted small">${latest.geoSource
      ? `Geolocalização por base local (${esc(latest.geoSource)}) — nenhum endereço sai do servidor.`
      : "Sem base GeoLite2 no servidor."} Instantâneo ${esc(latest.file)}, de ${fmt(latest.logLines)} linhas.</p>`);
};

const kpi = (label: string, value: string, hint: string): string =>
  `<div class="kpi"><span class="kpi-label">${esc(label)}</span><span class="kpi-value">${esc(value)}</span><span class="kpi-hint">${esc(hint)}</span></div>`;

const panel = (title: string, caption: string, body: string): string =>
  `<section class="panel"><h2>${esc(title)}</h2><p class="caption">${esc(caption)}</p>${body}</section>`;

const shell = (body: string): string => `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Tráfego — Portal Brasileirão</title>
<style>
  :root { color-scheme: dark }
  * { box-sizing: border-box }
  body { margin:0; padding:24px; background:${INK.bg}; color:${INK.text};
         font:14px/1.5 system-ui,-apple-system,Segoe UI,Roboto,sans-serif }
  main { max-width: 1100px; margin: 0 auto }
  h1 { font-size:22px; margin:0 0 4px }
  h2 { font-size:14px; margin:0; font-weight:600 }
  code { font-size:12px; color:${INK.muted} }
  .muted { color:${INK.muted} } .small { font-size:12px; color:${INK.faint} }
  .empty { color:${INK.faint}; text-align:center; padding:16px 0; margin:0 }
  .caption { color:${INK.muted}; font-size:12px; margin:2px 0 12px }
  .kpis { display:grid; grid-template-columns:repeat(auto-fit,minmax(150px,1fr)); gap:8px; margin:16px 0 }
  .kpi { background:${INK.panel}; border:1px solid ${INK.line}; border-radius:8px; padding:8px 12px;
         display:flex; flex-direction:column; gap:2px }
  .kpi-label { font-size:11px; text-transform:uppercase; letter-spacing:.5px; color:${INK.faint} }
  .kpi-value { font-size:24px; font-weight:700; color:${ACCENT}; font-variant-numeric:tabular-nums }
  .kpi-hint { font-size:12px; color:${INK.muted} }
  .panel { background:${INK.panel}; border:1px solid ${INK.line}; border-radius:8px;
           padding:12px 16px; margin-bottom:16px }
  .grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(320px,1fr)); gap:16px }
  .grid > .panel { margin-bottom:0 }
  .grid + .panel, .grid + .grid { margin-top:16px }
  .bar { display:grid; grid-template-columns:minmax(0,1fr) auto; gap:2px 8px; margin-bottom:8px }
  .bar-label { grid-column:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
               font-size:12px; color:${INK.muted} }
  .bar-count { grid-column:2; grid-row:1/3; align-self:center; font-size:12px;
               font-variant-numeric:tabular-nums; color:${INK.muted} }
  .bar-track { grid-column:1; height:6px; background:#272a2f; border-radius:4px; overflow:hidden }
  .bar-fill { height:100%; border-radius:4px }
  .chart { display:flex; gap:8px; align-items:stretch }
  .chart svg { flex:1; min-width:0; height:180px }
  .y-axis { display:flex; flex-direction:column; justify-content:space-between;
            font-size:11px; color:${INK.faint}; font-variant-numeric:tabular-nums }
  .x-axis { display:flex; justify-content:space-between; font-size:11px; color:${INK.faint}; margin-top:4px }
  .hours { display:flex; align-items:flex-end; gap:2px; height:130px }
  .hour { flex:1; height:100%; display:flex; align-items:flex-end; background:#272a2f; border-radius:3px }
  .hour > div { width:100%; border-radius:3px }
  .stack { display:flex; height:16px; border-radius:4px; overflow:hidden }
  .chips { display:flex; flex-wrap:wrap; gap:12px; margin-top:12px; font-size:12px; color:${INK.muted} }
  .chip { display:inline-flex; align-items:center; gap:6px }
  .chip i { width:8px; height:8px; border-radius:50%; display:inline-block }
</style></head><body><main>${body}</main></body></html>`;

// ── Serving ─────────────────────────────────────────────────────────────────

const server = createServer(async (req, res) => {
  try {
    // Re-read on every request rather than caching: this is a local window you
    // leave open while the timer writes, and a refresh that shows the same
    // numbers is the one thing it must not do.
    const payload = await load();
    if (req.url?.startsWith("/api")) {
      res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
      res.end(JSON.stringify(payload, null, 2));
      return;
    }
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(page(payload));
  } catch (error) {
    res.writeHead(500, { "content-type": "text/html; charset=utf-8" });
    res.end(shell(`<h1>Tráfego</h1><p class="muted">${esc(String(error))}</p>`));
  }
});

server.listen(PORT, () => {
  console.log(`Tráfego: http://localhost:${PORT}`);
  console.log(REMOTE ? `  lendo ${REMOTE}/api/traffic-dashboard` : `  lendo ${DIR}`);
});
