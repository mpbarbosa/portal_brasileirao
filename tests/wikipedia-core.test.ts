import assert from "node:assert/strict";
import { test } from "node:test";

import {
  wikipediaUrl,
} from "@/wikipedia-core";

test("an article link is the title, however it was pasted", () => {
  assert.equal(
    wikipediaUrl("Sociedade Esportiva Palmeiras"),
    "https://pt.wikipedia.org/wiki/Sociedade_Esportiva_Palmeiras",
  );
  // Underscores are what the address uses; either spelling names one article.
  assert.equal(
    wikipediaUrl("Sociedade_Esportiva_Palmeiras"),
    "https://pt.wikipedia.org/wiki/Sociedade_Esportiva_Palmeiras",
  );
  // What a person copies from the address bar, from a section, or from the
  // edit view. None of the three belongs in the file.
  assert.equal(
    wikipediaUrl("https://pt.wikipedia.org/wiki/Sociedade_Esportiva_Palmeiras"),
    "https://pt.wikipedia.org/wiki/Sociedade_Esportiva_Palmeiras",
  );
  assert.equal(
    wikipediaUrl("https://pt.wikipedia.org/wiki/Sociedade_Esportiva_Palmeiras#História"),
    "https://pt.wikipedia.org/wiki/Sociedade_Esportiva_Palmeiras",
  );
  assert.equal(
    wikipediaUrl("https://pt.wikipedia.org/wiki/Santos_Futebol_Clube?action=edit"),
    "https://pt.wikipedia.org/wiki/Santos_Futebol_Clube",
  );
});

test("an accented title is encoded, not transliterated", () => {
  // The opposite of a club slug: stripping the accent there keeps the address
  // typeable, but "Gremio Foot-Ball Porto Alegrense" is simply not an article.
  assert.equal(
    wikipediaUrl("Grêmio Foot-Ball Porto Alegrense"),
    "https://pt.wikipedia.org/wiki/Gr%C3%AAmio_Foot-Ball_Porto_Alegrense",
  );
  // Already-encoded input survives a round trip rather than being encoded twice.
  assert.equal(
    wikipediaUrl("https://pt.wikipedia.org/wiki/Gr%C3%AAmio_Foot-Ball_Porto_Alegrense"),
    "https://pt.wikipedia.org/wiki/Gr%C3%AAmio_Foot-Ball_Porto_Alegrense",
  );
});

test("anything that is not a pt article yields no link", () => {
  // Renders as no link at all, rather than one that lands on a 404. Another
  // edition is not rewritten: the pt title is rarely the en one, so an "en."
  // link rewritten to "pt." would look right and resolve to nothing.
  assert.equal(wikipediaUrl("https://en.wikipedia.org/wiki/Santos_FC"), null);
  assert.equal(wikipediaUrl("https://pt.wikipedia.org/w/index.php?title=Santos_Futebol_Clube"), null);
  assert.equal(wikipediaUrl("https://example.com/wiki/Santos_Futebol_Clube"), null);
  // Characters Wikipedia forbids in a title.
  assert.equal(wikipediaUrl("Santos [Futebol] Clube"), null);
  assert.equal(wikipediaUrl("not a url/"), null);
  assert.equal(wikipediaUrl("   "), null);
  assert.equal(wikipediaUrl(""), null);
  assert.equal(wikipediaUrl(undefined), null);
});
