import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildEnvelope,
  envelopeNote,
  seedSource,
  snapshotLabelFor,
  type EnvelopeSource,
} from "@/envelope-core";

const LABEL = "31/08/2026";

test("each live source names where its data came from", () => {
  assert.equal(
    envelopeNote("football-data", LABEL),
    "Dados do football-data.org (Campeonato Brasileiro Série A).",
  );
  assert.equal(envelopeNote("open-meteo", LABEL), "Condições atuais no estádio, do Open-Meteo.");
  assert.equal(envelopeNote("traffic-log", LABEL), "Instantâneos do log de acesso da produção.");
});

test("placeholder and fallback both name the frozen day, and say different things about why", () => {
  assert.equal(
    envelopeNote("placeholder", LABEL),
    "Dados congelados de 31/08/2026 — defina FOOTBALL_DATA_TOKEN para dados ao vivo.",
  );
  assert.equal(
    envelopeNote("fallback", LABEL),
    "Dados congelados de 31/08/2026 — a fonte ao vivo está indisponível no momento.",
  );
});

test("a page that never asked the provider is not told the provider is down", () => {
  const outage = envelopeNote("fallback", LABEL);
  for (const source of ["football-data", "open-meteo", "traffic-log", "placeholder"] as EnvelopeSource[]) {
    assert.notEqual(envelopeNote(source, LABEL), outage, source);
  }
});

test("seed data is a placeholder when never configured, and a fallback when configured and failing", () => {
  assert.equal(seedSource(false), "placeholder");
  assert.equal(seedSource(true), "fallback");
});

test("an envelope keeps the key order every route has always serialised", () => {
  const envelope = buildEnvelope({ rows: 20 }, "football-data", Date.UTC(2026, 7, 31, 12), LABEL);

  assert.deepEqual(Object.keys(envelope), ["source", "note", "updatedAt", "data"]);
  assert.equal(
    JSON.stringify(envelope),
    '{"source":"football-data","note":"Dados do football-data.org (Campeonato Brasileiro Série A).",' +
      '"updatedAt":"2026-08-31T12:00:00.000Z","data":{"rows":20}}',
  );
});

test("null data is carried, not dropped", () => {
  assert.equal(buildEnvelope(null, "fallback", 0, LABEL).data, null);
});

test("the snapshot day is printed as pt-BR writes it, and a non-day is printed as it came", () => {
  assert.equal(snapshotLabelFor("2026-08-31"), "31/08/2026");
  assert.equal(snapshotLabelFor("ontem"), "ontem");
});
