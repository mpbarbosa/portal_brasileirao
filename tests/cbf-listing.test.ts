import assert from "node:assert/strict";
import test from "node:test";

import { walkListing } from "@/scripts/cbf-api";

/** A fake listing of `pages` pages, one fixture on each, recording which pages were read. */
const listing = (pages: number) => {
  const read: number[] = [];
  const readPage = async (page: number) => {
    read.push(page);
    return { jogos: [`fixture-${page}`], meta: { last_page: pages } };
  };
  return { read, readPage };
};

test("every page of the listing is read, in order, and concatenated", async () => {
  const { read, readPage } = listing(3);
  const result = await walkListing(readPage, { pauseMs: 0 });

  assert.deepEqual(read, [1, 2, 3]);
  assert.deepEqual(result, { jogos: ["fixture-1", "fixture-2", "fixture-3"], lastPage: 3 });
});

test("a one-page listing is read once", async () => {
  const { read, readPage } = listing(1);
  await walkListing(readPage, { pauseMs: 0 });

  assert.deepEqual(read, [1]);
});

test("a page naming no last page is the only page", async () => {
  const read: number[] = [];
  const result = await walkListing(
    async (page) => {
      read.push(page);
      return { jogos: ["only"] };
    },
    { pauseMs: 0 },
  );

  assert.deepEqual(read, [1]);
  assert.deepEqual(result, { jogos: ["only"], lastPage: 1 });
});

test("a listing exactly at the cap is read whole", async () => {
  const { read, readPage } = listing(3);
  const result = await walkListing(readPage, { maxPages: 3, pauseMs: 0 });

  assert.deepEqual(read, [1, 2, 3]);
  assert.equal(result.jogos.length, 3);
});

/**
 * A short read is indistinguishable from a quiet weekend, so it is refused —
 * and refused on the first page, which already says how many there are, rather
 * than after fetching pages the refusal then throws away. Against a host that
 * bans at the socket those are the requests worth not making.
 */
test("a listing longer than the cap is refused before the pages it would drop are fetched", async () => {
  const { read, readPage } = listing(5);

  await assert.rejects(walkListing(readPage, { maxPages: 3, pauseMs: 0 }), /5 pages but the cap is 3/);
  assert.deepEqual(read, [1]);
});
