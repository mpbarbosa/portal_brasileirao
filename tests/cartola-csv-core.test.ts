import assert from "node:assert/strict";
import { test } from "node:test";

import { counterValue, parseCsv } from "@/cartola-csv-core";

const HEADER = "atletas.atleta_id,atletas.clube.id.full.name,atletas.nome,atletas.jogos_num,G,DS";

test("a round file parses into one record per player, quoted commas included", () => {
  const snapshot = parseCsv(
    `${HEADER}\n101,FLA,"Arrascaeta, Giorgian",20,5,\n202,PAL,"Raphael ""Veiga""",19,,12\n`,
    ["atletas.jogos_num", "G", "DS"],
  );

  assert.equal(snapshot.size, 2);
  assert.equal(snapshot.get("101")?.["atletas.nome"], "Arrascaeta, Giorgian");
  assert.equal(snapshot.get("202")?.["atletas.nome"], 'Raphael "Veiga"');
  assert.equal(snapshot.get("202")?.DS, "12");
});

test("a file missing a counter the sync reads is refused, not read as zeros", () => {
  // The defect: DS renamed upstream. Read as blank it is 0 desarmes for every
  // club in the division — twenty plausible rows that nothing checks.
  const renamed = "atletas.atleta_id,atletas.clube.id.full.name,atletas.jogos_num,G,DESARMES\n101,FLA,20,5,7\n";

  assert.throws(() => parseCsv(renamed, ["atletas.jogos_num", "G", "DS"]), /missing DS\./);
});

test("every missing column is named at once", () => {
  assert.throws(
    () => parseCsv("atletas.atleta_id,atletas.clube.id.full.name\n101,FLA\n", ["G", "DS", "DE"]),
    /missing G, DS, DE\./,
  );
});

test("the id and club columns are required whatever the caller asks for", () => {
  assert.throws(() => parseCsv("atletas.nome,G\nX,1\n", []), /atletas\.atleta_id, atletas\.clube\.id\.full\.name/);
  assert.throws(() => parseCsv("", []), /Empty CSV/);
});

test("a blank counter is 0, and so is a player absent from the snapshot", () => {
  // Measured: every 2026 round file carries thousands of blank counter cells,
  // which is caRtola writing "none".
  assert.equal(counterValue({ G: "", DS: "  " }, "G"), 0);
  assert.equal(counterValue({ G: "", DS: "  " }, "DS"), 0);
  assert.equal(counterValue(undefined, "G"), 0);
});

test("a number is itself", () => {
  assert.equal(counterValue({ G: "3" }, "G"), 3);
  assert.equal(counterValue({ G: " 12 " }, "G"), 12);
  assert.equal(counterValue({ G: "2.0" }, "G"), 2);
});

test("a present cell that is not a number is refused", () => {
  assert.throws(() => counterValue({ DS: "n/d" }, "DS"), /DS holds "n\/d", which is not a count/);
  assert.throws(() => counterValue({ DS: "NaN" }, "DS"), /not a count/);
  assert.throws(() => counterValue({ DS: "Infinity" }, "DS"), /not a count/);
});

test("reading a column the record does not have is refused", () => {
  // parseCsv only guarantees the columns it was asked for.
  assert.throws(() => counterValue({ G: "1" }, "DS"), /DS is not a column of this file/);
});
