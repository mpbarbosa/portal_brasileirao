/**
 * What an `ApiEnvelope` tells a reader about where its data came from.
 *
 * Pure: the server decides which source a payload has and passes the snapshot's
 * day in, and this writes the pt-BR note and the `updatedAt` instant
 * (tests/envelope-core.test.ts). It was written inline in `server.ts`, where the
 * one rule that matters most here — `placeholder` against `fallback` — had no
 * test, and the suite could not reach half of it: it boots with the provider
 * switched off, so it only ever sees `placeholder`.
 */

import { numericDayLabel } from "@/events-core";
import type { ApiEnvelope } from "@/src/types";

export type EnvelopeSource = ApiEnvelope<unknown>["source"];

/** The snapshot's day as pt-BR copy writes it. `numericDayLabel` answers null
 *  only for a string that is not a day, which `sync-seed-data` never writes and a
 *  unit test checks for the shipped date; the raw string is the fallback because
 *  a note saying *which* day, badly formatted, beats one saying none. */
export const snapshotLabelFor = (snapshotDate: string): string =>
  numericDayLabel(snapshotDate) ?? snapshotDate;

/**
 * The note a reader is shown for a source.
 *
 * `traffic-log` is named rather than left to fall through to the fallback note,
 * which is about the provider and would read as an outage on a page that has
 * never asked the provider anything. The traffic route builds its own envelope
 * with a count in the note, so that branch is a floor.
 */
export const envelopeNote = (source: EnvelopeSource, snapshotLabel: string): string => {
  switch (source) {
    case "football-data":
      return "Dados do football-data.org (Campeonato Brasileiro Série A).";
    case "open-meteo":
      return "Condições atuais no estádio, do Open-Meteo.";
    case "traffic-log":
      return "Instantâneos do log de acesso da produção.";
    case "placeholder":
      return `Dados congelados de ${snapshotLabel} — defina FOOTBALL_DATA_TOKEN para dados ao vivo.`;
    default:
      return `Dados congelados de ${snapshotLabel} — a fonte ao vivo está indisponível no momento.`;
  }
};

/**
 * Seed fixtures, labelled by *why* they are being served: never configured
 * (`placeholder`) versus configured but currently failing (`fallback`). The two
 * look identical to a reader, and only `fallback` is worth alerting on.
 */
export const seedSource = (providerEnabled: boolean): "fallback" | "placeholder" =>
  providerEnabled ? "fallback" : "placeholder";

/** An envelope, in the key order every route has always serialised. */
export const buildEnvelope = <T>(
  data: T,
  source: EnvelopeSource,
  updatedAt: number,
  snapshotLabel: string,
): ApiEnvelope<T> => ({
  source,
  note: envelopeNote(source, snapshotLabel),
  updatedAt: new Date(updatedAt).toISOString(),
  data,
});
