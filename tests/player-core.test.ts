import assert from "node:assert/strict";
import { test } from "node:test";

import { ageOn, mergePlayer, positionLabel } from "@/player-core";
import type { Player } from "@/src/types";

test("broad positions are translated", () => {
  assert.equal(positionLabel("Goalkeeper"), "Goleiro");
  assert.equal(positionLabel("Defence"), "Defesa");
  assert.equal(positionLabel("Midfield"), "Meio-campo");
  assert.equal(positionLabel("Offence"), "Ataque");
});

test("specific roles are translated too", () => {
  assert.equal(positionLabel("Centre-Back"), "Zagueiro");
  assert.equal(positionLabel("Defensive Midfield"), "Volante");
  assert.equal(positionLabel("Centre-Forward"), "Centroavante");
});

test("an unmapped position is shown verbatim rather than guessed at", () => {
  assert.equal(positionLabel("Sweeper"), "Sweeper");
});

test("a missing position yields null, not an empty label", () => {
  assert.equal(positionLabel(undefined), null);
  assert.equal(positionLabel(""), null);
  assert.equal(positionLabel("   "), null);
});

const at = (iso: string) => new Date(iso);

test("age counts whole years", () => {
  assert.equal(ageOn("1997-06-20", at("2026-08-24T00:00:00Z")), 29);
});

test("a birthday counts on the day itself, not before", () => {
  assert.equal(ageOn("1997-06-20", at("2026-06-19T23:00:00Z")), 28);
  assert.equal(ageOn("1997-06-20", at("2026-06-20T00:00:00Z")), 29);
});

test("a birthday later in the year has not happened yet", () => {
  assert.equal(ageOn("1997-12-31", at("2026-01-01T00:00:00Z")), 28);
});

test("a leap-day birth is handled without going backwards", () => {
  assert.equal(ageOn("2000-02-29", at("2026-02-28T00:00:00Z")), 25);
  assert.equal(ageOn("2000-02-29", at("2026-03-01T00:00:00Z")), 26);
});

test("a missing or unparseable date yields null", () => {
  assert.equal(ageOn(undefined, at("2026-08-24T00:00:00Z")), null);
  assert.equal(ageOn("not-a-date", at("2026-08-24T00:00:00Z")), null);
});

test("a date in the future yields null rather than a negative age", () => {
  assert.equal(ageOn("2030-01-01", at("2026-08-24T00:00:00Z")), null);
});

const base: Player = { id: "1", name: "Pedro" };

test("enrichment fills gaps without blanking what is known", () => {
  const merged = mergePlayer(
    { ...base, position: "Offence" },
    { id: "1", name: "Pedro", shirtNumber: 9 },
  );

  assert.equal(merged.shirtNumber, 9);
  assert.equal(merged.position, "Offence");
  assert.equal(merged.name, "Pedro");
});

test("enrichment wins where both have a value", () => {
  const merged = mergePlayer(
    { ...base, shirtNumber: 1 },
    { id: "1", name: "Pedro", shirtNumber: 9 },
  );

  assert.equal(merged.shirtNumber, 9);
});

test("a failed enrichment leaves the card as it was", () => {
  const withData = { ...base, shirtNumber: 9, position: "Offence" };

  assert.deepEqual(mergePlayer(withData, null), withData);
});
