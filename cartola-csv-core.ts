/**
 * Reading one caRtola round file — the CSV half of `scripts/sync-cartola-scouts.ts`,
 * moved here so its refusals can be tested. The script starts a sync the moment it
 * is imported, so nothing inside it could be.
 *
 * **A column the sync needs and the file does not carry is refused, never read as
 * zeros**, and that is why this module exists. The sync differences nine counter
 * columns between rounds, and it used to check that only three columns were
 * present. A missing column read as blank, so every counter in it was 0: a caRtola
 * rename of `DS` would have published 0 desarmes a game for all twenty clubs —
 * twenty identical, well-formed rows, which is the plausible zero rule 7 of
 * `docs/guides/DEFENSIVE_CODING_GUIDE.md` warns about — and nothing downstream
 * compares tackles with anything. The shots and goals bands would have caught a
 * rename of those columns and of no others.
 *
 * **An empty cell is still 0, and that is measured rather than tolerated.** caRtola
 * leaves a scout blank where a player has none: every 2026 round file read on
 * 2026-09-11 (rodadas 1–26) carries every column, with between 4,293 and 5,657
 * blank counter cells and not one non-numeric cell. So blank means "none", and a
 * cell that is present and not a number means the format changed — refused.
 *
 * Hand-written rather than a dependency: this is the only CSV the repository reads,
 * and the app ships no parsing library. Quotes matter — a player's `atletas.nome`
 * carries commas.
 */

/** One round: every player row keyed by `atletas.atleta_id`, as column → cell. */
export type Snapshot = Map<string, Record<string, string>>;

const ID = "atletas.atleta_id";
const CLUB = "atletas.clube.id.full.name";

/**
 * Parse one round file, refusing it unless every column in `required` is there.
 *
 * The id and club columns are always required. Every missing column is named at
 * once, so a rename that took three of them reads as one fix rather than three
 * runs of a sync that paces itself to be polite.
 */
export const parseCsv = (text: string, required: readonly string[]): Snapshot => {
  const rows = splitRows(text);
  const header = rows[0];
  if (!header) throw new Error("Empty CSV.");

  const missing = [ID, CLUB, ...required].filter((name) => !header.includes(name));
  if (missing.length > 0) {
    throw new Error(`CSV is missing ${missing.join(", ")}.`);
  }

  const idIndex = header.indexOf(ID);
  const out: Snapshot = new Map();
  for (const row of rows.slice(1)) {
    if (row.length <= idIndex) continue;
    const record: Record<string, string> = {};
    header.forEach((name, index) => {
      record[name] = row[index] ?? "";
    });
    out.set(row[idIndex] ?? "", record);
  }
  return out;
};

/**
 * A counter's value in one player's row: blank is 0, a number is itself, and
 * anything else is refused.
 *
 * `record` is absent when the player is not in that snapshot at all, and somebody
 * who had not appeared yet has counted nothing there — 0 by the same reading. A
 * column the record does not have is refused rather than read as blank: `parseCsv`
 * only guarantees the columns it was asked for, so reading one it was not asked
 * for is the missing-column bug arriving through a different caller.
 */
export const counterValue = (
  record: Record<string, string> | undefined,
  column: string,
): number => {
  if (record === undefined) return 0;
  if (!(column in record)) {
    throw new Error(`${column} is not a column of this file — pass it to parseCsv as required.`);
  }

  const raw = record[column].trim();
  if (raw === "") return 0;
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    throw new Error(`${column} holds ${JSON.stringify(raw)}, which is not a count.`);
  }
  return value;
};

function splitRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];

    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') quoted = true;
    else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char !== "\r") field += char;
  }

  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((entry) => entry.some((value) => value !== ""));
}
