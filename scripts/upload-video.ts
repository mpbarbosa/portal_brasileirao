/**
 * scripts/upload-video.ts
 * -----------------------
 * Publishes one rendered vídeo to YouTube, taking the título, a descrição and
 * as tags from the `-youtube.md` written beside it.
 *
 * ```sh
 * npm run upload-video -- authorize                  # uma vez, por projeto
 * npm run upload-video -- velas-vitoria --dry-run    # lê, mede e não envia nada
 * npm run upload-video -- velas-vitoria
 * npm run upload-video -- register <videoId>         # depois que ficar público
 * ```
 *
 * **It runs on a workstation and never in production**, like `sync-goals` and
 * `sync-broadcasts`: the deployed app has no credential and no reason to have
 * one.
 *
 * **It does not write `src/data/club-videos.ts`, and that is the design rather
 * than a gap.** That file requires an id to be confirmed through oEmbed before
 * it is written down, and records why: a video that is not public yet answers
 * **403**, which is exactly the state a freshly uploaded render sits in — so
 * the id straight off the upload is precisely the one it refuses. `register` is
 * the second step, run once the video is actually public, and it prints an
 * entry built from oEmbed's own strings. Where it stops is at the file: every
 * entry there carries a hand-written comment saying why that video belongs to
 * that club, and a generated one would be filler standing where a reason goes.
 */
import { readFile, stat } from "node:fs/promises";
import { globSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import {
  clubVideoEntry,
  copyProblems,
  glyphs,
  insertBody,
  isVideoId,
  parseOembed,
  parseVideoCopy,
  tagsLine,
  LIMITS,
  type InsertBody,
} from "@/youtube-upload-core";
import {
  accessToken,
  authorize,
  oembed,
  readCredentials,
  setThumbnail,
  tokenFile,
  uploadVideo,
} from "@/scripts/youtube-api";

const die = (message: string): never => {
  console.error(`\n✗ ${message}\n`);
  process.exit(1);
};

const exists = async (path: string): Promise<boolean> => {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
};

/**
 * The three artefacts of one render, found from its base name.
 *
 * **An ambiguous base is refused, not resolved by taking the first.** The
 * comparação lives under `docs/medias/`, `docs/medias/flamengo/` and
 * `docs/medias/palmeiras/` — three byte-identical copies today, and picking one
 * silently is a habit that publishes the wrong one the day they stop being
 * identical.
 */
const locate = async (base: string, dir: string | null) => {
  const pattern = dir === null ? `docs/medias/**/${base}-youtube.md` : join(dir, `${base}-youtube.md`);
  const found = globSync(pattern).sort();
  if (found.length === 0) die(`não achei nenhum \`${base}-youtube.md\` em docs/medias/`);
  if (found.length > 1) {
    die(
      `\`${base}-youtube.md\` existe em mais de um lugar — escolha com --dir:\n  ` +
        found.map((path) => dirname(path)).join("\n  "),
    );
  }

  const copy = found[0]!;
  const folder = dirname(copy);
  const mp4 = join(folder, `${base}.mp4`);
  const thumbnail = join(folder, `${base}-miniatura.png`);
  if (!(await exists(mp4))) die(`o \`-youtube.md\` está em ${folder} mas não há ${basename(mp4)} ao lado`);
  return { copy, mp4, thumbnail, folder };
};

const megabytes = (bytes: number): string => `${(bytes / 1_000_000).toFixed(1)} MB`;

const report = (body: InsertBody, tags: readonly string[]): void => {
  console.log(`  título      ${body.snippet.title}`);
  console.log(`              ${glyphs(body.snippet.title)}/${LIMITS.TITLE} caracteres`);
  console.log(`  descrição   ${glyphs(body.snippet.description)}/${LIMITS.DESCRIPTION} caracteres`);
  console.log(`  tags        ${tags.length} tags, ${glyphs(tagsLine(tags))}/${LIMITS.TAGS} caracteres`);
  console.log(`  categoria   ${body.snippet.categoryId} (Esportes)`);
  console.log(`  privacidade ${body.status.privacyStatus}`);
  console.log(`  crianças    não é conteúdo para crianças`);
};

const runAuthorize = async (): Promise<void> => {
  const credentials = readCredentials();
  if (credentials === null) {
    die(
      `não achei credenciais em ${tokenFile()}.\n` +
        "  Crie o cliente OAuth do tipo «App para computador» no console do Google e escreva:\n\n" +
        `    mkdir -p $(dirname ${tokenFile()})\n` +
        `    cat > ${tokenFile()} <<'JSON'\n` +
        '    { "clientId": "…apps.googleusercontent.com", "clientSecret": "…" }\n' +
        "    JSON",
    );
  }
  await authorize(credentials!);
  console.log(`\n✓ refresh token guardado em ${tokenFile()}`);
  console.log(
    "  Se a tela de permissão OAuth está em «Teste», ele expira em 7 dias.\n" +
      "  Publicar o app (mesmo sem verificação) é o que o torna duradouro.",
  );
};

const runRegister = async (videoId: string): Promise<void> => {
  if (!isVideoId(videoId)) die(`\`${videoId}\` não tem a forma de um id do YouTube (11 caracteres)`);

  const { status, payload } = await oembed(videoId);
  if (status === 403) {
    die(
      `o oEmbed respondeu 403: o vídeo existe e ainda NÃO está público.\n` +
        "  É o estado normal logo depois do upload. Publique-o e rode de novo —\n" +
        "  `src/data/club-videos.ts` recusa um id confirmado de outro jeito.",
    );
  }
  if (status !== 200) die(`o oEmbed respondeu ${status} para ${videoId}`);

  const facts = parseOembed(payload);
  if (facts === null) die("o oEmbed respondeu 200 com um payload que não tem `title` e `author_name`");

  console.log(`\n✓ público, confirmado pelo oEmbed:\n`);
  console.log(`  título  ${facts!.title}`);
  console.log(`  canal   ${facts!.channel}\n`);
  console.log("Cole em `src/data/club-videos.ts`, sob o código do clube, com um comentário");
  console.log("dizendo por que este vídeo é daquele clube:\n");
  console.log(clubVideoEntry(videoId, facts!));
  console.log();
};

const runUpload = async (
  base: string,
  options: { dir: string | null; privacy: InsertBody["status"]["privacyStatus"]; dryRun: boolean; thumbnail: boolean },
): Promise<void> => {
  const paths = await locate(base, options.dir);

  let copy;
  try {
    copy = parseVideoCopy(await readFile(paths.copy, "utf8"));
  } catch (reason) {
    return void die(`${paths.copy}: ${(reason as Error).message}`);
  }

  const problems = copyProblems(copy);
  if (problems.length > 0) {
    die(`${paths.copy} tem texto que o YouTube recusaria:\n  ` + problems.join("\n  "));
  }

  const body = insertBody(copy, options.privacy);
  const bytes = (await stat(paths.mp4)).size;
  const hasThumbnail = await exists(paths.thumbnail);

  console.log(`\n${paths.folder}\n`);
  console.log(`  mp4         ${basename(paths.mp4)} (${megabytes(bytes)})`);
  console.log(
    `  miniatura   ${hasThumbnail ? basename(paths.thumbnail) : "ausente"}` +
      `${options.thumbnail ? "" : " (pulada por --no-thumbnail)"}`,
  );
  report(body, copy.tags);

  if (options.thumbnail && !hasThumbnail) {
    die(`não há ${basename(paths.thumbnail)} — gere a capa ou passe --no-thumbnail`);
  }

  if (options.dryRun) {
    console.log("\n✓ --dry-run: nada foi enviado.\n");
    console.log("  Reconfira os números contra `scripts/manim/" + base + ".json` antes de publicar —");
    console.log("  o `-youtube.md` é escrito à mão e nada o regenera.\n");
    return;
  }

  const credentials = readCredentials();
  if (credentials === null || credentials.refreshToken === undefined) {
    die("sem token — rode `npm run upload-video -- authorize` primeiro");
  }

  console.log("\n… renovando o token");
  const token = await accessToken(credentials!);

  console.log(`… enviando ${megabytes(bytes)} (videos.insert custa 1600 das 10.000 unidades/dia)`);
  const videoId = await uploadVideo(token, body, paths.mp4);
  console.log(`\n✓ no ar como https://www.youtube.com/watch?v=${videoId}`);

  if (options.thumbnail) {
    try {
      await setThumbnail(token, videoId, paths.thumbnail);
      console.log("✓ miniatura definida");
    } catch (reason) {
      // Reported and not fatal: the video is already up, and losing the id here
      // would cost far more than the capa. A channel without phone verification
      // answers 403 to this and 200 to the upload above.
      console.error(`\n⚠ a miniatura falhou, o vídeo está no ar: ${(reason as Error).message}`);
      console.error("  Defina-a à mão no Studio, ou verifique o canal por telefone.");
    }
  }

  console.log(
    `\nO vídeo está como «${options.privacy}».` +
      (options.privacy === "private"
        ? "\nSe o projeto ainda não passou pela auditoria do YouTube, uploads pela API ficam\n" +
          "travados em privado — conferir isso é o teste que decide se vale automatizar."
        : ""),
  );
  console.log(`\nDepois de publicar:\n  npm run upload-video -- register ${videoId}\n`);
};

const main = async (): Promise<void> => {
  const argv = process.argv.slice(2);
  const flag = (name: string): boolean => argv.includes(`--${name}`);
  const value = (name: string): string | null => {
    const at = argv.indexOf(`--${name}`);
    return at === -1 ? null : (argv[at + 1] ?? null);
  };
  const positional = argv.filter((token, index) => {
    if (token.startsWith("--")) return false;
    const previous = argv[index - 1];
    return !(previous === "--dir" || previous === "--privacy");
  });

  const command = positional[0];
  if (command === undefined || flag("help")) {
    console.log(
      [
        "",
        "  npm run upload-video -- authorize",
        "  npm run upload-video -- <base> [--dry-run] [--privacy private|unlisted|public]",
        "                                 [--dir docs/medias/<clube>] [--no-thumbnail]",
        "  npm run upload-video -- register <videoId>",
        "",
        "  <base> é o nome do render sem extensão, p.ex. velas-vitoria.",
        "",
      ].join("\n"),
    );
    return;
  }

  if (command === "authorize") return runAuthorize();
  if (command === "register") {
    const id = positional[1];
    if (id === undefined) die("register precisa do id do vídeo");
    return runRegister(id!);
  }

  const privacy = value("privacy") ?? "private";
  if (privacy !== "private" && privacy !== "unlisted" && privacy !== "public") {
    die(`--privacy aceita private, unlisted ou public — recebi \`${privacy}\``);
  }

  return runUpload(command, {
    dir: value("dir"),
    privacy: privacy as InsertBody["status"]["privacyStatus"],
    dryRun: flag("dry-run"),
    thumbnail: !flag("no-thumbnail"),
  });
};

await main();
