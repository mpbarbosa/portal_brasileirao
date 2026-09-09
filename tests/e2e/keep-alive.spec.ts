import { connect } from "node:net";

import { expect, test } from "@/tests/e2e/clock";

/**
 * The server must not close an idle keep-alive connection before its client does.
 *
 * **Node's default `keepAliveTimeout` is 5 seconds, which is shorter than the
 * gap a pooling client leaves between two requests** — so the close instant is
 * a race, and a client writing to the connection at that millisecond gets a TCP
 * reset instead of a response. It surfaces as `socket hang up` or
 * `read ECONNRESET` from a `page.request` call, at transport level and never as
 * an assertion, and it moves around the suite because the route is irrelevant:
 * `contas.spec.ts`, `contas-preferencias.spec.ts`, `goals.spec.ts`,
 * `seo.spec.ts` and `match-page.spec.ts` have each carried the blame for it.
 *
 * `server.ts` sets the timeout past any gap a client here waits, and this is
 * the gate on that value. It asserts the **behaviour** rather than the number,
 * so it does not have to be edited if the value ever moves — it fails only if
 * the server goes back to closing connections out from under its clients.
 *
 * Ten seconds is chosen against the measured failure: with the default the
 * server closes at ~6.01s, so a wait comfortably past that is what separates
 * the two. It is deliberately not a test of the exact timeout — waiting 65
 * seconds to watch a connection die would cost more than it proves.
 *
 * A raw socket rather than `page.request`, because the whole point is to hold
 * one connection open and watch it: an API client is free to open a second one,
 * which is exactly how this defect stayed invisible.
 */
test("an idle keep-alive connection outlives the client's own reuse window", async ({
  baseURL,
}) => {
  const { port, hostname } = new URL(baseURL!);
  const socket = connect(Number(port), hostname);

  const closedEarly = await new Promise<boolean>((resolve) => {
    const timer = setTimeout(() => resolve(false), 10_000);
    socket.on("connect", () => {
      socket.write(
        `GET /api/health HTTP/1.1\r\nHost: ${hostname}:${port}\r\nConnection: keep-alive\r\n\r\n`,
      );
    });
    // The response has to arrive first, or "still open" would be a connection
    // the server has not got round to serving rather than one it is keeping.
    socket.once("data", () => {});
    socket.on("close", () => {
      clearTimeout(timer);
      resolve(true);
    });
    socket.on("error", () => {
      clearTimeout(timer);
      resolve(true);
    });
  });

  socket.destroy();
  expect(closedEarly).toBe(false);
});
