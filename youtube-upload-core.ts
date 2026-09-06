/**
 * youtube-upload-core.ts
 * ----------------------
 * The judgement half of publishing a rendered vídeo: reading the copy out of a
 * `docs/medias/<clube>/<cena>-<clube>-youtube.md`, refusing one YouTube would
 * reject, and reading back what the platform says about a video once it is up.
 *
 * Pure, like every other `*-core.ts` here — data in, data out — so the parsing
 * and the refusals are unit-tested without a network, a token or a channel.
 * `scripts/youtube-api.ts` does the I/O and holds no judgement at all, which is
 * the split `commons-core.ts` / `scripts/commons-api.ts` already draws.
 *
 * **The `-youtube.md` is the source and nothing regenerates it.** That file is
 * written by hand alongside the render and says so at its own head; this module
 * only reads it. So a wrong number in the copy is wrong here too — the file's
 * own instruction is to reconfirm against `scripts/manim/velas-<clube>.json`
 * before publishing, and no code can do that for you.
 *
 * **It refuses far more readily than it guesses**, which is `matchPlayerByName`'s
 * rule and matters for the same reason: what is at stake is not a build error
 * but a video published under the wrong words, in public, on a channel.
 */

/** Everything YouTube's form needs, as the `-youtube.md` states it. */
export interface VideoCopy {
  /** The recommended title — the first block under `## Título`. */
  title: string;
  /** The long description — the first block under `## Descrição`. */
  description: string;
  /** The tags, split from the single line under `## Tags`. */
  tags: string[];
}

/**
 * YouTube's own limits, and the one house convention among them.
 *
 * `TAGS` is measured over the block **as it is pasted** — joined by `", "` —
 * which is what every `-youtube.md` says it counts and what the numbers written
 * in those files were measured against. Do not "correct" it to the sum of the
 * tags' own lengths: that reads under the limit for a block that is over it,
 * which is the direction a gate must never fail in.
 */
export const LIMITS = { TITLE: 100, DESCRIPTION: 5000, TAGS: 500 } as const;

/** Esportes. The only category this series ever uses. */
export const CATEGORY_SPORTS = "17";

/**
 * Characters YouTube refuses outright in a title or a description, answering
 * `invalidTitle` / `invalidDescription` rather than escaping them.
 */
const REFUSED = ["<", ">"];

/**
 * Length in **code points**, not UTF-16 units.
 *
 * `"…".length` counts a surrogate pair twice, so a description carrying the
 * emoji these files use for their link lines (🔗, 💻) measures longer here than
 * at YouTube — a gate refusing copy the platform would have accepted. The
 * failure is quiet: nothing is wrong with the video, the tool just declines.
 */
export const glyphs = (value: string): number => [...value].length;

/** The tags line as it is pasted, which is what `LIMITS.TAGS` measures. */
export const tagsLine = (tags: readonly string[]): string => tags.join(", ");

const heading = (line: string): string | null =>
  line.startsWith("## ") ? line.slice(3).trim() : null;

/**
 * The lines of the section introduced by an exact level-2 heading, up to the
 * next level-2 heading — so `### Versão curta` stays **inside** `## Descrição`,
 * which is what makes the long description the section's first block and the
 * short one its second.
 *
 * The match is exact equality and not a prefix, because every one of these
 * files ends with a `## Título do arquivo` section about naming the mp4. A
 * `startsWith` reads that as the title and publishes a sentence about a
 * filename.
 */
const section = (markdown: string, name: string): string[] | null => {
  const lines = markdown.split("\n");
  const start = lines.findIndex((line) => heading(line) === name);
  if (start === -1) return null;
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => heading(line) !== null);
  return end === -1 ? rest : rest.slice(0, end);
};

/**
 * The first fenced block of a section, or null.
 *
 * A fence carrying a language is **not** a candidate: the only such block in
 * these files is the `ffmpeg` command under `## Miniatura`, and a section whose
 * first block is code is a section shaped differently from the one this reads.
 * Refusing is how that arrives as a message rather than as an `ffmpeg` line in
 * a video's description.
 */
const firstBlock = (lines: readonly string[]): string | null => {
  const open = lines.findIndex((line) => line.trimEnd() === "```");
  if (open === -1) return null;
  const rest = lines.slice(open + 1);
  const close = rest.findIndex((line) => line.trimEnd() === "```");
  if (close === -1) return null;
  return rest.slice(0, close).join("\n").trim();
};

const blockOf = (markdown: string, name: string): string => {
  const found = section(markdown, name);
  if (found === null) throw new Error(`o arquivo não tem uma seção "## ${name}"`);
  const block = firstBlock(found);
  if (block === null) throw new Error(`a seção "## ${name}" não tem um bloco \`\`\` sem linguagem`);
  if (block === "") throw new Error(`o bloco da seção "## ${name}" está vazio`);
  return block;
};

/**
 * The copy for one video, read out of its `-youtube.md`.
 *
 * Throws — never returns a partial `VideoCopy`. A missing description is not a
 * video published without one; it is a file this function does not understand,
 * and the only safe thing to do with an unrecognised shape is to stop.
 */
export const parseVideoCopy = (markdown: string): VideoCopy => {
  const title = blockOf(markdown, "Título");
  if (title.includes("\n")) {
    throw new Error('o bloco de "## Título" tem mais de uma linha — é um título só');
  }

  const description = blockOf(markdown, "Descrição");

  const line = blockOf(markdown, "Tags");
  if (line.includes("\n")) {
    throw new Error('o bloco de "## Tags" tem mais de uma linha — as tags vêm numa linha só');
  }
  const tags = line
    .split(",")
    .map((tag) => tag.trim())
    .filter((tag) => tag !== "");
  if (tags.length === 0) throw new Error('o bloco de "## Tags" não tem nenhuma tag');

  const seen = new Set<string>();
  const repeated = tags.filter((tag) => {
    const key = tag.toLowerCase();
    if (seen.has(key)) return true;
    seen.add(key);
    return false;
  });
  if (repeated.length > 0) {
    throw new Error(`tags repetidas: ${[...new Set(repeated)].join(", ")}`);
  }

  return { title, description, tags };
};

/**
 * Every reason this copy would be refused, in pt-BR — empty when there is none.
 *
 * A list rather than a first failure, because the caller prints all of them and
 * the person fixing the `-youtube.md` would otherwise learn about the tags only
 * after shortening the title.
 */
export const copyProblems = (copy: VideoCopy): string[] => {
  const problems: string[] = [];

  const titleLength = glyphs(copy.title);
  if (titleLength > LIMITS.TITLE) {
    problems.push(`título com ${titleLength} caracteres, o limite é ${LIMITS.TITLE}`);
  }

  const descriptionLength = glyphs(copy.description);
  if (descriptionLength > LIMITS.DESCRIPTION) {
    problems.push(`descrição com ${descriptionLength} caracteres, o limite é ${LIMITS.DESCRIPTION}`);
  }

  const tagsLength = glyphs(tagsLine(copy.tags));
  if (tagsLength > LIMITS.TAGS) {
    problems.push(
      `tags com ${tagsLength} caracteres somados (com as vírgulas), o limite é ${LIMITS.TAGS}`,
    );
  }

  for (const character of REFUSED) {
    if (copy.title.includes(character)) problems.push(`o título tem um "${character}", que o YouTube recusa`);
    if (copy.description.includes(character)) {
      problems.push(`a descrição tem um "${character}", que o YouTube recusa`);
    }
  }

  return problems;
};

/** What `videos.insert` is asked for, minus the bytes. */
export interface InsertBody {
  snippet: { title: string; description: string; tags: string[]; categoryId: string };
  status: { privacyStatus: "private" | "unlisted" | "public"; selfDeclaredMadeForKids: boolean };
}

/**
 * The `videos.insert` request body.
 *
 * `selfDeclaredMadeForKids` is written explicitly and always. The API does not
 * default it — an insert omitting it fails — and the answer for this series is
 * the one the `-youtube.md` files already give under **O resto do formulário**:
 * *"Não, não é conteúdo para crianças"*.
 */
export const insertBody = (
  copy: VideoCopy,
  privacy: InsertBody["status"]["privacyStatus"],
): InsertBody => ({
  snippet: {
    title: copy.title,
    description: copy.description,
    tags: [...copy.tags],
    categoryId: CATEGORY_SPORTS,
  },
  status: { privacyStatus: privacy, selfDeclaredMadeForKids: false },
});

/** What oEmbed reports about a video that is public. */
export interface OembedFacts {
  title: string;
  channel: string;
}

/**
 * oEmbed's answer, narrowed field by field like `parseHealth` — **null** where
 * it is not the shape this expects.
 *
 * This is the check `src/data/club-videos.ts` demands before an id may be
 * written down, and the reason it cannot be skipped is stated there: a video
 * that is not public yet answers **403**, which is exactly the state a freshly
 * uploaded render sits in. So a successful parse here is evidence the video is
 * actually published, and the title and channel it carries are the platform's
 * own strings rather than anything retyped off the upload page.
 */
export const parseOembed = (payload: unknown): OembedFacts | null => {
  if (typeof payload !== "object" || payload === null) return null;
  const record = payload as Record<string, unknown>;
  const title = record.title;
  const channel = record.author_name;
  if (typeof title !== "string" || title.trim() === "") return null;
  if (typeof channel !== "string" || channel.trim() === "") return null;
  return { title: title.trim(), channel: channel.trim() };
};

/** A YouTube video id: 11 characters of the URL-safe alphabet. */
export const isVideoId = (value: string): boolean => /^[A-Za-z0-9_-]{11}$/.test(value);

const quote = (value: string): string => JSON.stringify(value);

/**
 * The `ClubVideo` literal to paste into `src/data/club-videos.ts`, built from
 * **oEmbed's** strings.
 *
 * It is rendered rather than written into the file, and that is a decision. Every
 * entry there carries a hand-written comment saying why that video belongs to
 * that club — a comparação naming two clubs appears under both, and the file's
 * doc comment argues the point at length. A generated comment would be filler
 * standing where a reason is supposed to be, and choosing where a new key goes
 * among those paragraphs is editing prose, not data.
 */
export const clubVideoEntry = (id: string, facts: OembedFacts): string =>
  [
    "    {",
    `      id: ${quote(id)},`,
    `      title: ${quote(facts.title)},`,
    `      channel: ${quote(facts.channel)},`,
    "    },",
  ].join("\n");
