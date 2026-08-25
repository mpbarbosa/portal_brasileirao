import assert from "node:assert/strict";
import test from "node:test";

import { creditMatches, deedFor, fold, plain, redistributable } from "@/commons-core";

test("Commons' HTML fields are compared as the plain text the page shows", () => {
  assert.equal(plain('<a href="/wiki/User:X" title="X">Erica Ramalho</a>'), "Erica Ramalho");
  assert.equal(plain("Portal&nbsp;da&nbsp;Copa"), "Portal da Copa");
  assert.equal(plain("A &amp; B"), "A & B");
});

test("folding ignores the ways one credit gets written", () => {
  assert.equal(
    fold("Erica Ramalho/Portal da Copa"),
    fold("Érica Ramalho / Portal da Copa"),
  );
  // Trailing punctuation the photographer left in is not a different credit.
  assert.equal(fold("Arne Müseler / www.arne-mueseler.com;"), fold("Arne Museler / www.arne-mueseler.com"));
});

test("a licence resolves to its own deed, jurisdiction and all", () => {
  assert.equal(deedFor("CC BY-SA 4.0"), "https://creativecommons.org/licenses/by-sa/4.0/");
  assert.equal(deedFor("CC BY 3.0"), "https://creativecommons.org/licenses/by/3.0/");
  // A ported licence carries its country, which is the detail a hand-copied
  // URL drops.
  assert.equal(deedFor("CC BY 3.0 BR"), "https://creativecommons.org/licenses/by/3.0/br/");
  assert.equal(deedFor("CC0"), "https://creativecommons.org/publicdomain/zero/1.0/");
});

test("a licence the rules cannot name yields null rather than a guess", () => {
  assert.equal(deedFor("GFDL"), null);
  assert.equal(deedFor(""), null);
  assert.equal(deedFor("All rights reserved"), null);
});

test("we may host what we can credit, and nothing we cannot name", () => {
  // Vendoring makes this app the publisher of its copy, so the question is not
  // "may the page show it" but "may we serve it" — CC BY and CC BY-SA both
  // allow that, because the credit renders as a condition of display.
  assert.equal(redistributable("CC BY-SA 4.0"), true);
  assert.equal(redistributable("CC BY 3.0 BR"), true);
  assert.equal(redistributable("CC0"), true);

  // Refused by not being recognised, rather than by matching a blocklist: an
  // unnamed licence is one nobody has checked.
  assert.equal(redistributable("CC BY-NC 4.0"), false);
  assert.equal(redistributable("CC BY-ND 4.0"), false);
  assert.equal(redistributable("Fair use"), false);
  assert.equal(redistributable(""), false);
});

test("the dictated attribution outranks the recorded artist", () => {
  const facts = { attribution: "Arne Müseler / www.arne-mueseler.com", artist: "Arne Müseler" };

  // Where the photographer dictated a form, that form is what is owed — even
  // though the artist's bare name looks like the tidier credit.
  assert.equal(creditMatches("Arne Müseler / www.arne-mueseler.com", facts), true);
  assert.equal(creditMatches("Arne Müseler", facts), false);
});

test("the artist is what is owed when no attribution was dictated", () => {
  const facts = { attribution: "", artist: "Erica Ramalho/Portal da Copa" };

  assert.equal(creditMatches("Erica Ramalho/Portal da Copa", facts), true);
  assert.equal(creditMatches("Érica Ramalho / Portal da Copa", facts), true);
  assert.equal(creditMatches("Somebody Else", facts), false);
});
