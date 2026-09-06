import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, globSync } from "node:fs";
import {
  CATEGORY_SPORTS,
  LIMITS,
  clubVideoEntry,
  copyProblems,
  glyphs,
  insertBody,
  isVideoId,
  parseOembed,
  parseVideoCopy,
  tagsLine,
} from "@/youtube-upload-core";

/**
 * A `-youtube.md` in the shape every real one has: the three sections this
 * reads, plus the two that exist to be *mis*-read — `### Versão curta` inside
 * Descrição, the ```sh block under Miniatura, and the `## Título do arquivo`
 * section at the foot.
 */
const FILE = [
  "# YouTube — velas do Exemplo",
  "",
  "- **Título:** até 100 caracteres.",
  "",
  "## Título",
  "",
  "Recomendado (24 caracteres):",
  "",
  "```",
  "Exemplo em velas: a saga",
  "```",
  "",
  "| | título | caracteres |",
  "|---|---|---|",
  "| 2 | `Outro título qualquer` | 21 |",
  "",
  "## Descrição",
  "",
  "```",
  "A campanha do Exemplo rodada a rodada.",
  "",
  "🔗 Portal Brasileirão: https://brasileirao.mpbarbosa.com",
  "```",
  "",
  "### Versão curta",
  "",
  "```",
  "A curta, que não é a que sobe.",
  "```",
  "",
  "## Tags",
  "",
  "Medido sobre o bloco como está — 42 caracteres, 3 tags.",
  "",
  "```",
  "brasileirão, exemplo, gráfico de velas",
  "```",
  "",
  "## Miniatura",
  "",
  "```sh",
  "ffmpeg -ss 20.6 -i velas-exemplo.mp4 -frames:v 1 velas-exemplo-miniatura.png",
  "```",
  "",
  "## Título do arquivo",
  "",
  "O YouTube usa o nome do arquivo como título provisório.",
  "",
].join("\n");

test("reads the three blocks out of a -youtube.md", () => {
  const copy = parseVideoCopy(FILE);
  assert.equal(copy.title, "Exemplo em velas: a saga");
  assert.match(copy.description, /^A campanha do Exemplo rodada a rodada\./);
  assert.deepEqual(copy.tags, ["brasileirão", "exemplo", "gráfico de velas"]);
});

/**
 * The heading match is exact equality and not a prefix, and this fixture puts
 * `## Título do arquivo` **first** — because that is the only arrangement in
 * which the difference is observable.
 *
 * The first version of this test used the ordinary file above and passed
 * against a `startsWith`, confirmed by mutation: `findIndex` reaches the exact
 * `## Título` before the longer heading, so the ordering hid the bug and the
 * test certified nothing. A section order is not something this parser gets to
 * assume, and a prefix match publishes a sentence about naming an mp4 as the
 * video's title — type-checked, rendered and uploaded perfectly.
 */
const REORDERED = [
  "## Título do arquivo",
  "",
  "O YouTube usa o nome do arquivo como título provisório.",
  "",
  "```",
  "velas-exemplo.mp4",
  "```",
  "",
  "## Título",
  "",
  "```",
  "Exemplo em velas: a saga",
  "```",
  "",
  "## Descrição",
  "",
  "```",
  "A campanha do Exemplo.",
  "```",
  "",
  "## Tags",
  "",
  "```",
  "exemplo",
  "```",
  "",
].join("\n");

test("`## Título do arquivo` is not the title, whatever the section order", () => {
  assert.equal(parseVideoCopy(FILE).title, "Exemplo em velas: a saga");
  assert.equal(parseVideoCopy(REORDERED).title, "Exemplo em velas: a saga");
});

/**
 * `### Versão curta` is a level-3 heading, so it stays inside the Descrição
 * section and the long block is still the section's first. Reading the short
 * one would publish a summary in place of the description, silently.
 */
test("the long description wins over the versão curta", () => {
  const copy = parseVideoCopy(FILE);
  assert.doesNotMatch(copy.description, /que não é a que sobe/);
});

/**
 * A fenced block carrying a language is not copy, and a section whose first
 * block is code is a section shaped differently from the one this reads.
 *
 * Note what this does **not** defend, because the comment here said it did and
 * was wrong: the `ffmpeg` block of `## Miniatura` is excluded by the section
 * boundary, not by this rule, and a fence reader accepting languages still
 * parses every committed file correctly. The rule earns its place only on a
 * section written with a language fence, which is what this fixture is — so
 * this is the one arrangement where the strictness is observable at all.
 */
test("a copy section whose only block carries a language is refused", () => {
  const plain = "## Tags\n\n```\nexemplo\n```";
  const coded = "## Tags\n\n```text\nexemplo\n```";
  assert.ok(REORDERED.includes(plain));
  assert.throws(() => parseVideoCopy(REORDERED.replace(plain, coded)), /sem linguagem/);
});

/**
 * A section with no block of its own must refuse, never borrow the next
 * section's.
 *
 * That is the whole job of the boundary in `section`, and this is the only
 * arrangement that observes it: every committed file gives all three sections a
 * block, so dropping the boundary passes every other test here — confirmed by
 * mutation, twice. The first fixture emptied `## Tags` in `FILE` and stayed
 * green, because the section below it is fenced ```sh and the borrow found
 * nothing to take. It needs a **bare** block underneath to reach, which is what
 * `REORDERED` has.
 *
 * The stake is the failure mode rather than the tidiness: unbounded, a section
 * somebody left half-written silently publishes the text of the next one.
 */
test("a section with no block does not borrow the next section's", () => {
  const emptied = REORDERED.replace("## Descrição\n\n```\nA campanha do Exemplo.\n```", "## Descrição\n\na fazer");
  assert.ok(!emptied.includes("A campanha do Exemplo."));
  assert.throws(() => parseVideoCopy(emptied), /## Descrição/);
});

test("a missing section is refused rather than left empty", () => {
  const without = FILE.replace("## Descrição", "## Descricao");
  assert.throws(() => parseVideoCopy(without), /## Descrição/);
});

test("a title block of more than one line is refused", () => {
  const broken = FILE.replace("Exemplo em velas: a saga", "Uma linha\ne outra");
  assert.throws(() => parseVideoCopy(broken), /mais de uma linha/);
});

test("repeated tags are refused", () => {
  const repeated = FILE.replace(
    "brasileirão, exemplo, gráfico de velas",
    "brasileirão, exemplo, Exemplo",
  );
  assert.throws(() => parseVideoCopy(repeated), /repetidas/);
});

/**
 * Code points, not UTF-16 units. The real descriptions carry 🔗 and 💻, each a
 * surrogate pair — measured with `.length` they read two characters longer than
 * YouTube counts them, so a description near the limit is refused for length it
 * does not have. The failure is quiet: nothing is broken, the tool just declines.
 */
test("length is measured in code points", () => {
  assert.equal("🔗".length, 2);
  assert.equal(glyphs("🔗"), 1);
});

test("tags are measured as they are pasted, with the separators", () => {
  assert.equal(tagsLine(["um", "dois"]), "um, dois");
  const copy = { title: "t", description: "d", tags: ["a".repeat(249), "b".repeat(249)] };
  // 249 + 2 + 249 = 500 exactly: at the limit and not over it.
  assert.equal(glyphs(tagsLine(copy.tags)), LIMITS.TAGS);
  assert.deepEqual(copyProblems(copy), []);
  const over = { ...copy, tags: [...copy.tags, "c"] };
  assert.equal(copyProblems(over).length, 1);
  assert.match(copyProblems(over)[0]!, /tags com 503 caracteres/);
});

test("an over-long title is refused, and says by how much", () => {
  const problems = copyProblems({ title: "x".repeat(101), description: "d", tags: ["a"] });
  assert.equal(problems.length, 1);
  assert.match(problems[0]!, /101 caracteres/);
});

test("the characters YouTube refuses are refused here first", () => {
  const problems = copyProblems({ title: "a < b", description: "c > d", tags: ["a"] });
  assert.equal(problems.length, 2);
});

test("every problem is reported, not just the first", () => {
  const problems = copyProblems({
    title: "x".repeat(101),
    description: "y".repeat(5001),
    tags: ["z".repeat(501)],
  });
  assert.equal(problems.length, 3);
});

/**
 * `videos.insert` does not default `selfDeclaredMadeForKids` — an insert
 * omitting it fails — so it is written on every request rather than where
 * somebody remembers to.
 */
test("the insert body always declares the audience and the category", () => {
  const body = insertBody({ title: "t", description: "d", tags: ["a"] }, "private");
  assert.equal(body.status.selfDeclaredMadeForKids, false);
  assert.equal(body.snippet.categoryId, CATEGORY_SPORTS);
  assert.equal(body.status.privacyStatus, "private");
});

test("the insert body copies the tags rather than aliasing them", () => {
  const copy = { title: "t", description: "d", tags: ["a"] };
  const body = insertBody(copy, "public");
  body.snippet.tags.push("b");
  assert.deepEqual(copy.tags, ["a"]);
});

test("oEmbed is narrowed field by field", () => {
  assert.deepEqual(parseOembed({ title: " T ", author_name: " C " }), { title: "T", channel: "C" });
  assert.equal(parseOembed({ title: "T" }), null);
  assert.equal(parseOembed({ title: "", author_name: "C" }), null);
  assert.equal(parseOembed("T"), null);
  assert.equal(parseOembed(null), null);
});

test("a video id is eleven characters of the URL-safe alphabet", () => {
  assert.ok(isVideoId("doMq2ELvtrc"));
  assert.ok(!isVideoId("doMq2ELvtr"));
  assert.ok(!isVideoId("https://youtu.be/doMq2ELvtrc"));
});

test("the club-videos entry escapes what it quotes", () => {
  const entry = clubVideoEntry("doMq2ELvtrc", { title: 'Um "aspas" e \\ barra', channel: "C" });
  assert.match(entry, /id: "doMq2ELvtrc"/);
  assert.match(entry, /title: "Um \\"aspas\\" e \\\\ barra"/);
});

/**
 * The gate on the real files, which is the one that can go red on somebody
 * else's commit — and should. A `-youtube.md` whose copy YouTube would reject
 * is a defect nothing else here can see: the render is fine, the markdown is
 * fine, and the refusal arrives at upload time, by hand, months later.
 *
 * It is also what keeps the parser honest against the shapes people actually
 * write, rather than only against the fixture above.
 */
test("every committed -youtube.md parses and would be accepted", () => {
  const files = globSync("docs/medias/**/*-youtube.md").sort();
  assert.ok(files.length >= 20, `esperava ao menos 20 arquivos, achei ${files.length}`);
  for (const file of files) {
    const copy = parseVideoCopy(readFileSync(file, "utf8"));
    assert.deepEqual(copyProblems(copy), [], `${file} tem texto que o YouTube recusaria`);
    assert.ok(copy.title.length > 0, `${file} sem título`);
    assert.ok(copy.tags.length > 0, `${file} sem tags`);
  }
});
