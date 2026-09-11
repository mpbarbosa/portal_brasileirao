import assert from "node:assert/strict";
import { test } from "node:test";

import {
  decodable,
  formatRoute,
  HOME,
  namesSubject,
  parseRoute,
  pathSegments,
  sameRoute,
  type Route,
} from "@/route-core";

test("the root path is the table", () => {
  assert.deepEqual(parseRoute("/"), HOME);
  assert.deepEqual(parseRoute(""), HOME);
  assert.deepEqual(parseRoute("/classificacao"), HOME);
});

test("ao vivo has its own address", () => {
  assert.deepEqual(parseRoute("/ao-vivo"), { section: "ao-vivo" });
  assert.equal(formatRoute({ section: "ao-vivo" }), "/ao-vivo");
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

test("a club path carries its key, slug or code", () => {
  assert.deepEqual(parseRoute("/clube/1783"), { section: "clube", key: "1783" });
  assert.deepEqual(parseRoute("/clube/flamengo"), { section: "clube", key: "flamengo" });
});

test("a club path with no key falls back home", () => {
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
  assert.equal(formatRoute({ section: "ao-vivo" }), "/ao-vivo");
  assert.equal(formatRoute({ section: "jogos", round: null }), "/jogos");
  assert.equal(formatRoute({ section: "jogos", round: 12 }), "/jogos/12");
  assert.equal(formatRoute({ section: "artilharia" }), "/artilharia");
  assert.equal(formatRoute({ section: "clube", key: "1783" }), "/clube/1783");
});

test("a club code needing escaping survives a round trip", () => {
  const route: Route = { section: "clube", key: "a/b c" };
  assert.deepEqual(parseRoute(formatRoute(route)), route);
});

test("parse and format round-trip for every shape", () => {
  const routes: Route[] = [
    HOME,
    { section: "ao-vivo" },
    { section: "jogos", round: null },
    { section: "jogos", round: 38 },
    { section: "artilharia" },
    { section: "clube", key: "4241" },
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

test("a match has its own address", () => {
  assert.deepEqual(parseRoute("/partida/554970"), { section: "partida", id: "554970" });
  assert.equal(formatRoute({ section: "partida", id: "554970" }), "/partida/554970");
});

test("a match path with no id falls back home", () => {
  assert.deepEqual(parseRoute("/partida"), HOME);
  assert.deepEqual(parseRoute("/partida/"), HOME);
});

test("a match route round-trips", () => {
  const route: Route = { section: "partida", id: "554970" };
  assert.deepEqual(parseRoute(formatRoute(route)), route);
});

test("a stadium has its own address", () => {
  assert.deepEqual(parseRoute("/estadio/maracana"), { section: "estadio", key: "maracana" });
  assert.equal(formatRoute({ section: "estadio", key: "maracana" }), "/estadio/maracana");
});

test("a stadium path with no slug falls back home", () => {
  assert.deepEqual(parseRoute("/estadio"), HOME);
  assert.deepEqual(parseRoute("/estadio/"), HOME);
});

test("a stadium route round-trips", () => {
  const route: Route = { section: "estadio", key: "arena-do-gremio" };
  assert.deepEqual(parseRoute(formatRoute(route)), route);
});

test("a malformed percent escape resolves rather than throwing", () => {
  // decodeURIComponent throws URIError on these, and a crawler will send one.
  // Unhandled it surfaced as a 500 from the SPA handler — the one failure shape
  // this module exists to rule out. `pageStatus` gives it the 404.
  for (const path of ["/clube/%", "/clube/%E0%A4%A", "/jogos/%zz"]) {
    assert.deepEqual(parseRoute(path), HOME, path);
  }
});

test("jogadores is a section that takes no argument", () => {
  assert.deepEqual(parseRoute("/jogadores"), { section: "jogadores" });
  assert.equal(formatRoute({ section: "jogadores" }), "/jogadores");
  // An argument under it addresses nothing, so it is not a deeper page.
  assert.deepEqual(parseRoute("/jogadores/flamengo"), { section: "jogadores" });
});

test("/trafego parses and formats round-trip", () => {
  assert.deepEqual(parseRoute("/trafego"), { section: "trafego" });
  assert.equal(formatRoute({ section: "trafego" }), "/trafego");
  // Takes no argument. The extra segment is ignored here and 404s in
  // `pageStatus` — the router's job is to land somewhere useful, and the
  // crawler's answer is that module's.
  assert.deepEqual(parseRoute("/trafego/qualquer-coisa"), { section: "trafego" });
});

test("a route names a subject exactly when its page has to look something up", () => {
  const subjects: Route[] = [
    { section: "clube", key: "flamengo" },
    { section: "painel", key: "flamengo" },
    { section: "partida", id: "554977" },
    { section: "estadio", key: "maracana" },
    { section: "jogos", round: 24 },
  ];
  const plain: Route[] = [
    HOME,
    { section: "ao-vivo" },
    // The current round is whatever the data says it is, and cannot be missing.
    { section: "jogos", round: null },
    { section: "artilharia" },
    { section: "jogadores" },
    { section: "conta" },
    { section: "entrar" },
    { section: "trafego" },
    { section: "privacidade" },
  ];

  for (const route of subjects) assert.equal(namesSubject(route), true, formatRoute(route));
  for (const route of plain) assert.equal(namesSubject(route), false, formatRoute(route));
});

const READABLE = ["/", "/clube/flamengo", "/estadio/Maracan%C3%A3", "/clube/%2F", "/jogos/24?x=%20"];
const MALFORMED = ["/clube/%", "/clube/%E0%A4%A", "/jogos/%zz", "/?q=%", "/%E0%A4/%A4"];

test("a URL is decodable unless an escape in it is malformed", () => {
  for (const url of READABLE) assert.equal(decodable(url), true, url);
  for (const url of MALFORMED) assert.equal(decodable(url), false, url);
});

test("a pathname splits into decoded segments, all or nothing", () => {
  assert.deepEqual(pathSegments("/estadio/Maracan%C3%A3"), ["estadio", "Maracanã"]);
  assert.deepEqual(pathSegments("//clube///flamengo/"), ["clube", "flamengo"]);
  assert.deepEqual(pathSegments("/"), []);

  // One unreadable segment and none are returned: a route read from the rest
  // would be a different address from the one requested.
  assert.equal(pathSegments("/clube/%E0%A4%A"), null);
  assert.equal(pathSegments("/%zz/flamengo"), null);
});

// The guard in front of the router asks `decodable` about the whole URL while
// the router and `pageStatus` read `pathSegments`. A literal `/` cannot sit
// inside an escape, so the two cannot disagree — and if that ever stopped being
// true, the guard would wave through a path the router then refuses.
test("the guard and the router agree on what is readable", () => {
  for (const path of [...READABLE, ...MALFORMED]) {
    const pathOnly = path.split("?")[0];
    assert.equal(decodable(pathOnly), pathSegments(pathOnly) !== null, path);
  }
});
