/**
 * thumbnail-barras.ts
 * -------------------
 * Draw the YouTube capas for the `barras` render, at 1280x720.
 *
 *   npx tsx scripts/manim/thumbnail-barras.ts
 *   npx tsx scripts/manim/thumbnail-barras.ts --variant lider
 *   npx tsx scripts/manim/thumbnail-barras.ts --focus 1783
 *
 * Two images, from one payload:
 *
 *   docs/medias/barras-20-clubes-miniatura.png            the division
 *   docs/medias/barras-20-clubes-miniatura-52-pontos.png  the story
 *
 * **A capa é devida aqui porque os primeiros segundos do vídeo são vazios** —
 * a cena abre com o título e o subtítulo sozinhos sobre o fundo e só monta o
 * desenho depois, então o quadro que o YouTube escolheria sozinho é uma faixa
 * de texto num campo preto. É a mesma razão das capas do `pontos` e do
 * `campanhas`, e é por isso que as velas deliberadamente não têm nenhuma.
 *
 * Compartilha com as duas irmãs o leitor de paleta e a captura do
 * `capa-shared.ts`, e **não** o traçado: uma barra deitada por clube e um leque
 * de vinte linhas são dois desenhos, não um laço com um parâmetro. É a linha
 * que o `thumbnail.ts` já recusa quando recusa um terceiro clube.
 *
 * **Tudo é derivado, nada é digitado.** Os clubes, as cores, os pontos, a
 * contagem de rodadas e o número da manchete saem do `pontos.json` — o mesmo
 * arquivo que a cena consome — então um re-export move a capa e o vídeo juntos.
 * O nome do arquivo da variante é construído do número que ela imprime, então
 * ela não tem como se chamar `52-pontos` dizendo outra coisa.
 *
 * **Oito clubes e não vinte**, que é a única decisão de desenho aqui: uma capa
 * é lida com cerca de 210px de largura na lista do YouTube, onde vinte linhas
 * de nome viram um cinza. Oito barras ainda são reconhecivelmente uma corrida.
 *
 * **`--focus <código>` é a capa do corte de TORCEDOR**, e é o mesmo
 * interruptor que o `BARRAS_FOCUS` da cena — o vocabulário do destaque tem de
 * ser o mesmo nos dois, ou a capa promete um vídeo que o vídeo não entrega.
 * Ela sai com o nome do vídeo dela (`barras-<slug>-miniatura.png`), e o slug
 * vem do `slugify` do app e não de uma string digitada aqui, pela razão que o
 * `venue-core.ts` dá: um segundo normalizador é onde duas grafias de um nome
 * passam a discordar.
 *
 * **O clube do foco entra nas oito linhas mesmo fora do G8.** Uma capa de
 * torcedor sem o clube do torcedor é o defeito inteiro desta variante, e ele
 * só aparece no dia em que o clube cai — nunca enquanto alguém está medindo,
 * porque o foco de hoje lidera. Quando ele não cabe, a última das oito dá o
 * lugar e as reticências dizem que o meio foi pulado.
 *
 * Não há modo `--check`, pela razão do `generate-og-image.ts`: os bytes variam
 * com a build do Chromium e com as fontes da máquina, então uma comparação
 * byte a byte ficaria vermelha num bump de browser sem relação nenhuma.
 *
 * Exit codes:
 *   0  as capas foram escritas.
 *   1  o payload ou a paleta não puderam ser lidos, ou a captura falhou.
 */
import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { slugify } from "@/slug-core";

import { capture, fail, readClubColours, readInk, shown as shownIn } from "./capa-shared";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../..");

// O mesmo payload da cena, e o mesmo interruptor: `BARRAS_JSON` aponta os dois
// para outra temporada de uma vez só.
const DATA_PATH = process.env.BARRAS_JSON ?? path.join(HERE, "pontos.json");
const SCENE_PATH = path.join(HERE, "barras.py");


/**
 * `--focus <código>`: o código numérico do provedor, nunca a `tla` — Corinthians
 * e Coritiba compartilham `COR`. Um código que o payload não tem **aborta**, que
 * é a regra do `BARRAS_FOCUS` da cena: uma capa de torcedor gerada em silêncio
 * sem destaque nenhum, com nome de arquivo de torcedor, só apareceria ao abrir
 * a imagem.
 */
const focusArg = process.argv.indexOf("--focus");
const FOCUS = focusArg === -1 ? null : (process.argv[focusArg + 1] ?? null);
if (focusArg !== -1 && !FOCUS) fail("--focus: falta o código do clube");

const WIDTH = 1280;
const HEIGHT = 720;
const SHOWN = 8;

type Entry = { round: number; points: number; position: number; played: number };
type Club = { code: string; name: string; rounds: Entry[] };

const shown = (target: string) => shownIn(ROOT, target);

const payload = (() => {
  try {
    return JSON.parse(readFileSync(DATA_PATH, "utf8")) as { snapshot: string; clubs: Club[] };
  } catch (cause) {
    return fail(`could not read ${shown(DATA_PATH)}: ${(cause as Error).message}`);
  }
})();

if (!Array.isArray(payload.clubs) || payload.clubs.length === 0) {
  fail(`${shown(DATA_PATH)} carries no clubs`);
}

const ink = readInk(ROOT, SCENE_PATH, ["INK", "INK_SOFT", "INK_FAINT", "SURFACE"] as const);
const clubColours = readClubColours(ROOT, SCENE_PATH);

const lastRound = Math.max(...payload.clubs.flatMap((club) => club.rounds.map((r) => r.round)));
const atLast = (club: Club) => {
  const entry = club.rounds.find((r) => r.round === lastRound);
  if (!entry) fail(`${club.name} has no entry for rodada ${lastRound}`);
  return entry!;
};

const standing = [...payload.clubs].sort((a, b) => atLast(a).position - atLast(b).position);
const leader = standing[0];
const second = standing[1];
const topPoints = Math.max(...payload.clubs.map((club) => atLast(club).points));

const focusClub = (() => {
  if (FOCUS === null) return null;
  const found = payload.clubs.find((club) => club.code === FOCUS);
  if (!found) fail(`--focus ${FOCUS}: não está em ${shown(DATA_PATH)}`);
  return found!;
})();

/** O vídeo que elas anunciam. As capas levam o nome dele, então o `ls` as arquiva juntas. */
const VIDEO_BASENAME = focusClub ? `barras-${slugify(focusClub.name)}` : "barras-20-clubes";

/**
 * A pasta é a do SUJEITO, exatamente como no `docs/medias/RENDERED`: um corte de
 * um clube mora em `docs/medias/<clube>/` e a corrida da divisão inteira em
 * `docs/medias/divisao/`. Derivar aqui em vez de escrever solto e mover à mão é
 * o que impede a capa de nascer no sítio errado — o mp4 vai para a pasta certa
 * pelo `cp` do README e a capa ia para o nível de cima, e só o
 * `tests/manim-renders.test.ts` acusava, depois do commit.
 */
const OUT_DIR = path.join(ROOT, "docs/medias", focusClub ? slugify(focusClub.name) : "divisao");

/**
 * As oito linhas da capa — e o clube do foco está sempre entre elas.
 *
 * Fora do G8 ele toma o lugar da OITAVA e não o da primeira, porque o topo é o
 * que diz que isto é uma corrida; e a lacuna ganha reticências, ou a capa
 * afirmaria que o clube é o oitavo colocado.
 */
const rows: Array<Club | null> = (() => {
  const top = standing.slice(0, SHOWN);
  if (!focusClub || top.some((club) => club.code === focusClub.code)) return top;
  const head = top.slice(0, SHOWN - 1);
  const skipped = atLast(focusClub).position > atLast(head[head.length - 1]).position + 1;
  // A lacuna OCUPA uma das oito, senão a capa cresce e transborda o quadro —
  // que é exatamente o que o `fitsTheFrame` abaixo recusa.
  return skipped ? [...top.slice(0, SHOWN - 2), null, focusClub] : [...head, focusClub];
})();

const isFocus = (club: Club) => focusClub !== null && club.code === focusClub.code;

const colourOf = (club: Club) => clubColours.get(club.code) ?? ink.INK_SOFT;
const escape = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const shell = (body: string) => `<!doctype html><meta charset="utf-8"><style>
  *{margin:0;padding:0;box-sizing:border-box}
  html,body{width:${WIDTH}px;height:${HEIGHT}px;background:${ink.SURFACE};
    font-family:Inter,system-ui,sans-serif;color:${ink.INK};overflow:hidden}
  .pad{padding:52px 60px;height:100%;display:flex;flex-direction:column;gap:26px}
  .kicker{font-size:23px;letter-spacing:.15em;text-transform:uppercase;color:${ink.INK_SOFT}}
  .headline{font-size:74px;font-weight:800;line-height:1.02;letter-spacing:-.02em}
  .chart{display:flex;flex-direction:column;gap:11px;flex:1;justify-content:center}
  .row{display:flex;align-items:center;gap:14px;padding:3px 10px;margin:0 -10px;border-radius:3px}
  /* O mesmo vocabulario da cena: faixa na cor do clube, nome em peso, e os
     outros recuados. Sem crase aqui: isto vive dentro de um template literal,
     entao uma crase no comentario FECHA a string e o erro sai como um TS1005
     trinta linhas adiante. Ver o cabecalho do arquivo para o porque do destaque. */
  .row.focus{font-weight:700}
  .row.muted .club,.row.muted .pts{color:${ink.INK_SOFT}}
  /* Nenhuma opacidade na barra: recuar derruba seis dos vinte tons abaixo do
     piso de 3 de uma marca, porque o mais escuro da paleta ja esta em 3,48 com
     opacidade cheia. Os numeros estao no barras.py, no BAND_OPACITY. */
  .gap{height:26px;display:flex;align-items:center;padding-left:54px;
    font-size:25px;color:${ink.INK_FAINT};letter-spacing:.3em}
  .pos{width:44px;text-align:right;font-size:23px;color:${ink.INK_SOFT};font-variant-numeric:tabular-nums}
  .club{width:210px;font-size:25px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .track{flex:1;display:flex;align-items:center;gap:12px}
  .bar{height:26px;border-radius:2px}
  .pts{font-size:25px;font-weight:700;font-variant-numeric:tabular-nums}
  .foot{display:flex;justify-content:space-between;align-items:flex-end;
    font-size:21px;color:${ink.INK_SOFT}}
</style><body><div class="pad">${body}</div></body>`;

/** A divisão: a corrida como ela se lê, oito barras e a manchete em cima. */
const divisao = shell(`
  <div>
    <div class="kicker">Brasileirão Série A · ${lastRound} rodadas</div>
    <div class="headline">A corrida do<br>Brasileirão</div>
  </div>
  <div class="chart" id="chart">
    ${rows
      .map((club) => {
        if (club === null) return `<div class="gap">···</div>`;
        const entry = atLast(club);
        const focused = isFocus(club);
        const cls = focusClub === null ? "row" : focused ? "row focus" : "row muted";
        const band = focused
          ? `background:color-mix(in srgb, ${colourOf(club)} 17%, transparent)`
          : "";
        return `<div class="${cls}" style="${band}">
        <div class="pos">${entry.position}º</div>
        <div class="club">${escape(club.name)}</div>
        <div class="track">
          <div class="bar" style="width:${(entry.points / topPoints) * 100}%;
            background:${colourOf(club)}"></div>
          <div class="pts">${entry.points}</div>
        </div>
      </div>`;
      })
      .join("")}
  </div>
  <div class="foot"><span>pontos rodada a rodada</span><span>brasileirao.mpbarbosa.com</span></div>
`);

/**
 * A história: quem lidera, por quanto, e sobre quantos jogos — e com `--focus`,
 * **o clube do foco e não o líder**, que é a mesma troca de sujeito que a nota
 * de fecho da cena faz, pela mesma razão: uma capa de torcedor que estampa o
 * líder estampa o rival em dezenove dos vinte clubes.
 */
const subject = focusClub ?? leader;
const subjectAt = atLast(subject);
const subjectPos = subjectAt.position;
// O rival é quem está imediatamente ACIMA, ou o vice quando o sujeito lidera.
const rival = subjectPos === 1 ? second : standing[subjectPos - 2];
const rivalAt = atLast(rival);
const margin = subjectPos === 1 ? subjectAt.points - rivalAt.points : rivalAt.points - subjectAt.points;
const relation = subjectPos === 1 ? "à frente do" : "atrás do";

const leaderShot = shell(`
  <div>
    <div class="kicker">Brasileirão Série A · ${lastRound} rodadas</div>
  </div>
  <div style="flex:1;display:flex;flex-direction:column;justify-content:center;gap:18px">
    <div style="font-size:232px;font-weight:800;line-height:.88;letter-spacing:-.04em;
      color:${colourOf(subject)}">${subjectAt.points}</div>
    <div style="font-size:86px;font-weight:800;line-height:1.02;letter-spacing:-.02em">
      ${escape(subject.name)} ${subjectPos === 1 ? "lidera" : `em ${subjectPos}º`}</div>
    <div style="font-size:38px;color:${ink.INK_SOFT}">
      ${margin === 0 ? `empatado com o ${escape(rival.name)}` : `${margin} ${relation} ${escape(rival.name)}`}
      · ${subjectAt.played} jogos
    </div>
  </div>
  <div class="foot"><span>a corrida do Brasileirão</span><span>brasileirao.mpbarbosa.com</span></div>
`);

/**
 * As duas conferências são geométricas porque as falhas de uma capa são
 * geométricas: nada aqui pode transbordar o quadro, e nenhuma barra pode
 * escapar da sua pista. `tsc` não vê nem uma nem outra.
 */
const fitsTheFrame = async (tab: import("@playwright/test").Page) =>
  tab.evaluate(
    ([w, h]) => {
      const doc = document.documentElement;
      if (doc.scrollWidth > w || doc.scrollHeight > h) {
        return `content overflows the frame: ${doc.scrollWidth}x${doc.scrollHeight} > ${w}x${h}`;
      }
      for (const bar of document.querySelectorAll(".bar")) {
        const box = bar.getBoundingClientRect();
        if (box.right > w - 1 || box.width < 1) {
          return `a bar leaves its track: right=${Math.round(box.right)} width=${Math.round(box.width)}`;
        }
      }
      return null;
    },
    [WIDTH, HEIGHT] as const,
  );

const variants = [
  { name: "divisão", file: `${VIDEO_BASENAME}-miniatura.png`, html: divisao, check: fitsTheFrame },
  {
    name: "líder",
    // Do próprio número que ela imprime, então o nome não pode discordar da imagem.
    file: `${VIDEO_BASENAME}-miniatura-${subjectAt.points}-pontos.png`,
    html: leaderShot,
    check: fitsTheFrame,
  },
];

/**
 * `--variant` compara com os acentos DOBRADOS, porque o nome da variante é
 * `líder` e ninguém digita o acento num argumento de linha de comando. A
 * primeira versão comparava a string crua e também tentava casar contra o nome
 * do arquivo — que é `…-52-pontos.png` e não contém "lider" —, então
 * `--variant lider` era recusado com uma mensagem mandando usar exatamente o
 * que acabara de ser digitado.
 */
const fold = (text: string) =>
  text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

const asked = process.argv.indexOf("--variant");
const wanted = asked === -1 ? null : process.argv[asked + 1];
const chosen = wanted ? variants.filter((v) => fold(v.name) === fold(wanted)) : variants;
if (wanted && chosen.length === 0) {
  fail(`--variant ${wanted}: use ${variants.map((v) => fold(v.name)).join(" or ")}`);
}

mkdirSync(OUT_DIR, { recursive: true });

await capture(chosen, {
  root: ROOT,
  outDir: OUT_DIR,
  width: WIDTH,
  height: HEIGHT,
  note: `rodada ${lastRound}, ${payload.snapshot}`,
});
