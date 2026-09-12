/**
 * useVersionWatch
 * ---------------
 * Notice that this host is serving a newer build than the one running, and take
 * it. The judgement is `version-core.ts`; this is the half that reads a clock,
 * touches `sessionStorage` and throws the page away, which is why the two are
 * separate files — the same split `account-core.ts` and `account-store.ts` draw.
 *
 * **The reading `App` already has is the first check, and it is free.** The
 * rodapé's `/api/health` fetch happens on every page view whatever this hook
 * does, so the reading is passed in rather than fetched again; a reader who
 * loads the page mid-deploy is therefore updated without this hook making a
 * single request of its own.
 *
 * The comment on that fetch in `App` used to say the payload was "not
 * refetched" because every fact in it is fixed for the life of the process, and
 * that a restart is "picked up on the next load, which is when a reader could
 * act on it anyway". The first half is still true and is the reason the rodapé
 * keeps reading its own single reading rather than this hook's. The second half
 * is the assumption this hook overturns: **the reader cannot act on it, because
 * the thing to do about a new version is not something a reader knows to do.**
 */

import { useEffect, useRef } from "react";

import { fetchHealth, type HealthReading } from "@/src/api";
import { shouldReload, versionVerdict } from "@/version-core";

/**
 * The commit of the process that served the document being looked at.
 *
 * Read from the shell — `injectMeta` writes it — rather than from a build-time
 * `define`, because a sha inside the client bundle lands in the bundle's own
 * content hash: every deploy would then issue a new asset filename and every
 * returning reader would re-download it, including for the 35 of 60 recent
 * commits that changed nothing the bundle contains. `page-meta-core.ts` carries
 * the measurement at the field.
 *
 * Read once at module scope. The tag is part of the document, so it cannot
 * change without the document being replaced — which is the event this whole
 * module exists to cause.
 */
const shellSha = (): string | null =>
  document.querySelector('meta[name="app-version"]')?.getAttribute("content") ?? null;

const CLIENT_SHA = shellSha();

/**
 * How often to ask, while the tab is being looked at.
 *
 * Five minutes rather than the 30–60s the fixture poll uses, and the reason is
 * not politeness to our own server — it is that **`/api/health` is counted**.
 * `traffic-report-core.ts` reports a `monitorHits` series off that path and a
 * `visitorHits` series off the Referer, and a browser poll lands in both: at
 * 60s an open tab would contribute 60 hits an hour to a chart whose whole
 * purpose is separating machines from readers. At five minutes it is 12, and
 * only while the tab is visible.
 *
 * Nothing is lost by the wait, because the case that matters is covered by an
 * event rather than by the timer: a reader who tabs away and comes back is
 * checked the instant they return, and that is when a stale bundle has had time
 * to become stale.
 */
export const VERSION_CHECK_MS = 300_000;

/**
 * The sha a reload has already been spent on, kept per tab.
 *
 * `sessionStorage` and not `localStorage`, because the question is "has *this*
 * page instance already tried?" — a sibling tab that reloaded successfully must
 * not talk this one out of its own attempt, and the marker is meaningless once
 * the tab is gone.
 */
const MARKER_KEY = "portal-brasileirao:reloaded-for";

/**
 * Storage is allowed to be unavailable, and both directions matter.
 *
 * A read that throws (private mode, a browser set to block site data) is an
 * absent marker, which fails toward *attempting* a reload — the right way
 * round, since the alternative is never updating. A write that throws is the
 * loop guard being unavailable, which is why the reload is also gated on a ref
 * below: that guard is in memory and cannot be refused.
 */
const readMarker = (): string | null => {
  try {
    return window.sessionStorage.getItem(MARKER_KEY);
  } catch {
    return null;
  }
};

const writeMarker = (sha: string): void => {
  try {
    window.sessionStorage.setItem(MARKER_KEY, sha);
  } catch {
    // See above: the in-memory ref is the guard that cannot be refused.
  }
};

/**
 * Whether the page may be thrown away right now.
 *
 * An open `<dialog>` is the one gesture in this app that a reload would
 * interrupt mid-way — the player card, which a reader opened deliberately and
 * which a reload closes without explanation. Everything else on the page is a
 * document: the route is in the URL and the browser restores the scroll, so a
 * reader lands back where they were.
 */
const canInterrupt = (): boolean => document.querySelector("dialog[open]") === null;

/**
 * Watch for a new version and load it.
 *
 * @param reading the rodapé's own `/api/health` reading, or undefined until it
 *   settles. Every change to it is checked, which is what makes the first check
 *   cost nothing.
 */
export const useVersionWatch = (reading: HealthReading | undefined): void => {
  /**
   * Whether this page instance has already called `reload`.
   *
   * A reload is not instantaneous — the browser keeps running script while it
   * fetches the new document — so without this a poll landing in that window
   * calls it a second time. A ref rather than state, because nothing renders
   * from it and setting state here would re-render twenty standings rows to
   * record a fact about the page's own demise.
   */
  const reloaded = useRef(false);

  const consider = (health: HealthReading | undefined): void => {
    if (reloaded.current || health === undefined) return;

    const server = health.health?.sha ?? null;
    const verdict = versionVerdict({
      client: CLIENT_SHA,
      server,
      reloadedFor: readMarker(),
      canInterrupt: canInterrupt(),
    });

    if (!shouldReload(verdict) || server === null) return;

    // Written BEFORE the reload, or the marker never lands and the next page
    // load repeats the attempt — which is the loop this guard exists to stop.
    writeMarker(server);
    reloaded.current = true;
    window.location.reload();
  };

  // The reading App already holds — and **no dependency list, deliberately**.
  // This runs after every render of `App`, not only when the reading changes,
  // and that is what retries a check `canInterrupt` deferred: closing the player
  // card is an `App` state change, so the render that removes the dialog is the
  // one that reloads, with no request. `[reading]` would leave that reload
  // waiting for the five-minute interval. Each run costs one `querySelector`
  // and one `sessionStorage` read.
  useEffect(() => {
    consider(reading);
  });

  useEffect(() => {
    let cancelled = false;

    const ask = (): void => {
      if (cancelled || reloaded.current || document.hidden) return;

      void (async () => {
        try {
          const fresh = await fetchHealth();
          if (!cancelled) consider(fresh);
        } catch {
          // Unreachable reads the same as unreadable: no claim, no reload. The
          // next check asks again, and a host that is down has nothing to serve
          // us anyway.
        }
      })();
    };

    // The case the interval is too slow for, and the commonest one: a reader
    // comes back to a tab that has been sitting through a deploy.
    const onVisible = (): void => {
      if (!document.hidden) ask();
    };

    document.addEventListener("visibilitychange", onVisible);
    const timer = setInterval(ask, VERSION_CHECK_MS);

    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
    // Installed once, deliberately. The `consider` this closure captured is the
    // first render's, which is safe because it reads nothing from that render:
    // its only inputs are its own argument and a ref. (There is no ESLint here
    // to appease — `tsc --noEmit` is the whole lint gate.)
  }, []);
};
