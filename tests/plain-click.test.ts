import assert from "node:assert/strict";
import test from "node:test";

import { isPlainClick } from "@/src/components/plainClick";

const plain = { metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, button: 0 };

test("a plain primary-button click is the app's to route", () => {
  assert.equal(isPlainClick(plain), true);
});

for (const key of ["metaKey", "ctrlKey", "shiftKey", "altKey"] as const) {
  test(`${key} hands the click to the browser`, () => {
    assert.equal(isPlainClick({ ...plain, [key]: true }), false);
  });
}

/**
 * The case two of the hand-written copies this replaced did not test. Browsers
 * mostly report a middle button as `auxclick` rather than `click`, so the gap
 * rarely showed — which is exactly why it survived.
 */
test("any button but the primary one hands the click to the browser", () => {
  for (const button of [1, 2, 3, 4]) {
    assert.equal(isPlainClick({ ...plain, button }), false, `button ${button}`);
  }
});
