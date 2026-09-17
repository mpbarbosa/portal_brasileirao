import assert from "node:assert/strict";
import { test } from "node:test";

import { isNewsUrl, newsFor } from "@/club-core";
import { dayLabel } from "@/events-core";
import { CLUBS_BY_CODE } from "@/src/data/clubs";
import { CLUB_NEWS } from "@/src/data/club-news";
import type { ClubNewsItem } from "@/src/types";

const item = (url: string, date: string, title = "Manchete"): ClubNewsItem => ({ url, date, title });

test("isNewsUrl accepts a bare https article address", () => {
  assert.equal(isNewsUrl("https://ge.globo.com/futebol/times/botafogo/noticia/2026/09/16/x.ghtml"), true);
});

test("isNewsUrl refuses the tracked form a reader pastes out of an app share", () => {
  assert.equal(
    isNewsUrl("https://ge.globo.com/a.ghtml?utm_source=push&utm_medium=app&utm_campaign=pushge"),
    false,
  );
  assert.equal(isNewsUrl("https://ge.globo.com/a.ghtml#comentarios"), false);
  assert.equal(isNewsUrl("https://ge.globo.com/a.ghtml?"), false);
});

test("isNewsUrl refuses plaintext, non-URLs and an address that is not its own canonical form", () => {
  assert.equal(isNewsUrl("http://ge.globo.com/a.ghtml"), false);
  assert.equal(isNewsUrl("ge.globo.com/a.ghtml"), false);
  assert.equal(isNewsUrl(""), false);
  assert.equal(isNewsUrl("https://GE.globo.com/a.ghtml"), false);
});

test("newsFor orders newest first, breaks ties on the address, and drops what it cannot link", () => {
  const got = newsFor(
    {
      "1": [
        item("https://a.example/old", "2026-01-02"),
        item("https://a.example/bad?utm_source=x", "2026-12-31"),
        item("https://a.example/z", "2026-05-01"),
        item("https://a.example/b", "2026-05-01"),
      ],
    },
    "1",
  );
  assert.deepEqual(
    got.map((n) => n.url),
    ["https://a.example/b", "https://a.example/z", "https://a.example/old"],
  );
  assert.deepEqual(newsFor({}, "1"), []);
});

// ── The data ─────────────────────────────────────────────────────────────

test("the table is not empty, so the end-to-end spec cannot pass vacuously", () => {
  assert.ok(Object.values(CLUB_NEWS).flat().length > 0);
});

test("every entry is keyed by a real club, linkable, dated and headlined", () => {
  for (const [code, items] of Object.entries(CLUB_NEWS)) {
    assert.ok(CLUBS_BY_CODE.get(code), `${code} is not a club code`);
    for (const n of items) {
      assert.ok(isNewsUrl(n.url), `${code}: ${n.url} carries a query, fragment or plaintext scheme`);
      assert.ok(dayLabel(n.date), `${code}: ${n.date} is not a YYYY-MM-DD day`);
      assert.ok(n.title.trim(), `${code}: empty headline for ${n.url}`);
      if (n.summary !== undefined) assert.ok(n.summary.trim(), `${code}: empty summary for ${n.url}`);
    }
  }
});

test("no report is recorded twice", () => {
  const urls = Object.values(CLUB_NEWS).flat().map((n) => n.url);
  assert.equal(new Set(urls).size, urls.length);
});
