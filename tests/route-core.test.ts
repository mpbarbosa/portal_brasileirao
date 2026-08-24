import assert from "node:assert/strict";
import { test } from "node:test";

import { formatRoute, HOME, parseRoute, sameRoute, type Route } from "@/route-core";

test("the root path is the table", () => {
  assert.deepEqual(parseRoute("/"), HOME);
  assert.deepEqual(parseRoute(""), HOME);
  assert.deepEqual(parseRoute("/classificacao"), HOME);
});

test("jogos without a round means the current one", () => {
  assert.deepEqual(parseRoute("/jogos"), { section: "jogos", round: null });
});

test("jogos with a round carries it", () => {
  assert.deepEqual(parseRoute("/jogos/24"), { section: "jogos", round: 24 });
  assert.deepEqual(parseRoute("/jogos/1"), { section: "jogos", round: 1 });
});

test("a nonsense round degrades to the current one rather than erroring", () => {
  for (const path of ["/jogos/abc", "/jogos/0", "/jogos/-3", "/jogos/2.5"]) {
    assert.deepEqual(parseRoute(path), { section: "jogos", round: null }, path);
  }
});

test("a club path carries its code", () => {
  assert.deepEqual(parseRoute("/clube/1783"), { section: "clube", code: "1783" });
});

test("a club path with no code falls back home", () => {
  assert.deepEqual(parseRoute("/clube"), HOME);
  assert.deepEqual(parseRoute("/clube/"), HOME);
});

test("an unknown path falls back home instead of erroring", () => {
  assert.deepEqual(parseRoute("/nao-existe"), HOME);
  assert.deepEqual(parseRoute("/jogos/24/extra/segments"), { section: "jogos", round: 24 });
});

test("trailing and duplicate slashes are tolerated", () => {
  assert.deepEqual(parseRoute("/artilharia/"), { section: "artilharia" });
  assert.deepEqual(parseRoute("//jogos//7//"), { section: "jogos", round: 7 });
});

test("formatting produces the canonical path", () => {
  assert.equal(formatRoute(HOME), "/");
  assert.equal(formatRoute({ section: "jogos", round: null }), "/jogos");
  assert.equal(formatRoute({ section: "jogos", round: 12 }), "/jogos/12");
  assert.equal(formatRoute({ section: "artilharia" }), "/artilharia");
  assert.equal(formatRoute({ section: "clube", code: "1783" }), "/clube/1783");
});

test("a club code needing escaping survives a round trip", () => {
  const route: Route = { section: "clube", code: "a/b c" };
  assert.deepEqual(parseRoute(formatRoute(route)), route);
});

test("parse and format round-trip for every shape", () => {
  const routes: Route[] = [
    HOME,
    { section: "jogos", round: null },
    { section: "jogos", round: 38 },
    { section: "artilharia" },
    { section: "clube", code: "4241" },
  ];

  for (const route of routes) {
    assert.deepEqual(parseRoute(formatRoute(route)), route, formatRoute(route));
  }
});

test("sameRoute compares by canonical path", () => {
  assert.equal(sameRoute(HOME, parseRoute("/classificacao")), true);
  assert.equal(sameRoute({ section: "jogos", round: 3 }, { section: "jogos", round: 3 }), true);
  assert.equal(sameRoute({ section: "jogos", round: 3 }, { section: "jogos", round: 4 }), false);
});
