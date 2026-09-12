/**
 * Read a response's body to the end and throw it away.
 *
 * For every branch that does not want the body — an error status, a reply
 * nobody reads, a 204. **A discarded body is not a closed one**: Chromium keeps
 * the stream open until something reads it, so the request never reaches
 * "finished", and anything waiting for the network to go idle waits for ever.
 * `useAccount`'s 404 did exactly that and hung every screenshot capture while
 * the page rendered perfectly.
 *
 * Read rather than `body.cancel()`. Cancelling closes the stream too, but it
 * lands in devtools as a *failed* request, which is a false lead for whoever
 * next debugs the page. A read that fails is swallowed: nothing in the body was
 * wanted, and the caller has already decided what the status means.
 *
 * One function rather than an inline `response.text()` at each branch, because
 * the branch that forgets is always the one nobody exercises — the error path,
 * or the reply whose content the caller does not use.
 */
export const drainBody = async (response: Response): Promise<void> => {
  await response.text().catch(() => undefined);
};
