import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  outcomeOfShareError,
  shareFeedback,
  shareMethod,
  sharePayload,
} from "@/share-core";

const payload = { title: "Palmeiras · Portal Brasileirão", url: "https://example.test/clube/palmeiras" };
const fn = () => undefined;

describe("shareMethod", () => {
  it("prefers the platform sheet", () => {
    assert.equal(shareMethod({ share: fn, clipboard: { writeText: fn } }, payload), "native");
  });

  it("trusts canShare when it refuses the payload", () => {
    assert.equal(
      shareMethod({ share: fn, canShare: () => false, clipboard: { writeText: fn } }, payload),
      "clipboard",
    );
  });

  it("uses share alone where canShare does not exist", () => {
    assert.equal(shareMethod({ share: fn }, payload), "native");
  });

  it("falls back to the clipboard", () => {
    assert.equal(shareMethod({ clipboard: { writeText: fn } }, payload), "clipboard");
  });

  it("answers none where neither exists, so no button renders", () => {
    assert.equal(shareMethod({}, payload), "none");
    assert.equal(shareMethod({ clipboard: {} }, payload), "none");
    assert.equal(shareMethod(undefined, payload), "none");
  });

  it("does not mistake a non-function for the API", () => {
    assert.equal(shareMethod({ share: true, clipboard: { writeText: "yes" } }, payload), "none");
  });
});

describe("sharePayload", () => {
  it("keeps the address the reader is on", () => {
    assert.deepEqual(sharePayload("T", "https://example.test/clube/1783?x=1"), {
      title: "T",
      url: "https://example.test/clube/1783?x=1",
    });
  });

  it("drops a fragment", () => {
    assert.equal(sharePayload("T", "https://example.test/jogos/3#topo").url, "https://example.test/jogos/3");
    assert.equal(sharePayload("T", "https://example.test/#").url, "https://example.test/");
  });
});

describe("outcomeOfShareError", () => {
  it("reads the reader closing the sheet as a cancellation", () => {
    assert.equal(outcomeOfShareError(new DOMException("closed", "AbortError")), "cancelled");
    assert.equal(outcomeOfShareError({ name: "AbortError" }), "cancelled");
  });

  it("reads anything else as a failure", () => {
    assert.equal(outcomeOfShareError(new DOMException("no", "NotAllowedError")), "failed");
    assert.equal(outcomeOfShareError(new TypeError("bad")), "failed");
    assert.equal(outcomeOfShareError("string"), "failed");
    assert.equal(outcomeOfShareError(null), "failed");
  });
});

describe("shareFeedback", () => {
  it("says nothing after the platform sheet, or after a cancellation", () => {
    assert.equal(shareFeedback("native", "shared"), null);
    assert.equal(shareFeedback("native", "cancelled"), null);
  });

  it("confirms a copy, which is otherwise silent", () => {
    assert.equal(shareFeedback("clipboard", "copied"), "Link copiado");
  });

  it("names the failure by the path that failed", () => {
    assert.equal(shareFeedback("native", "failed"), "Não foi possível compartilhar");
    assert.equal(shareFeedback("clipboard", "failed"), "Não foi possível copiar o link");
  });
});
