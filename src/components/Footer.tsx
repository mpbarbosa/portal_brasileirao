import type { ReactNode } from "react";

import type { HealthReading } from "@/src/api";
import {
  healthStatusLabel,
  isHealthy,
  providerLabel,
  shortSha,
  startInstant,
} from "@/health-core";
import { LINK_UNDERLINE } from "@/src/components/interaction";

/**
 * An instant as a reader writes one — "25/08/2026, 14:32".
 *
 * Formatted here rather than in `health-core.ts`, and in the reader's own
 * timezone, for the reason `kickoffLabel` is: a clock time means the reader's
 * clock. Keeping it out of the core module also keeps that module's tests free
 * of the host's ICU data, which `player-core.ts` records as a moving target
 * across Node builds and trimmed container images.
 *
 * Null rather than a dash for an unparseable value: the rodapé drops the whole
 * item, the same as for one the endpoint never sent.
 */
const instantLabel = (iso: string): string | null => {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return null;

  return parsed.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

/** One `termo: valor` pair of the readout. `id` is the e2e hook. */
interface Item {
  id: string;
  term: string;
  value: ReactNode;
}

/**
 * The **Saúde do serviço**, as the facts that actually arrived.
 *
 * Built from a list of what is present rather than from a fixed row per field,
 * the same shape the player card uses and for the same reason: almost every
 * field is optional. Running from source there is no build time; a host serving
 * an older bundle may send neither. Nothing renders a dash standing in for a
 * value that was never reported.
 *
 * A `<dl>` rather than a sentence, because these are labelled facts and a
 * screen reader should hear "Versão, a1b2c3d" rather than a run of five values
 * with no terms. The `<div>` wrappers are what HTML5 allows for grouping a term
 * with its description; without them the pairs cannot be laid out as units and
 * wrapping splits a label from its value.
 */
function HealthReadout({ health, readAt }: HealthReading) {
  if (health === null) {
    return (
      <p className="mt-3 text-body-small text-ink-faint" data-health="unavailable">
        Não foi possível ler o estado do serviço.
      </p>
    );
  }

  const healthy = isHealthy(health);
  const items: Item[] = [
    {
      id: "estado",
      term: "Estado",
      value: (
        <span className="inline-flex items-center gap-1.5">
          {/* A fill, not text: the base status tokens are for fills and rails,
              and the `-ink` pairs are what clear AA as text. The word beside it
              carries the meaning, so the dot is decoration and hidden. */}
          <span
            aria-hidden="true"
            className={`h-2 w-2 rounded-full ${healthy ? "bg-positive" : "bg-negative"}`}
          />
          {healthStatusLabel(health.status)}
        </span>
      ),
    },
  ];

  const provider = providerLabel(health.provider);
  if (provider !== null) {
    items.push({
      id: "fonte",
      term: "Fonte",
      // Named, not claimed: this is the provider the server is *configured*
      // with, and whether its last request succeeded is what the envelope's
      // `source` says — the banner above already carries that when it is not
      // live. See `providerLabel`.
      value:
        health.provider === "football-data" ? (
          <a
            href="https://www.football-data.org/"
            target="_blank"
            rel="noopener noreferrer"
            className={LINK_UNDERLINE}
          >
            {provider}
          </a>
        ) : (
          provider
        ),
    });
  }

  const version = shortSha(health.sha);
  if (version !== null) {
    items.push({
      id: "versao",
      term: "Versão",
      value: <code className="font-mono">{version}</code>,
    });
  }

  const builtAt = health.builtAt === null ? null : instantLabel(health.builtAt);
  if (builtAt !== null && health.builtAt !== null) {
    items.push({
      id: "compilado",
      term: "Compilado",
      value: <time dateTime={health.builtAt}>{builtAt}</time>,
    });
  }

  const started = startInstant(health.uptime, readAt);
  const startedAt = started === null ? null : instantLabel(started);
  if (started !== null && startedAt !== null) {
    items.push({
      id: "no-ar-desde",
      term: "No ar desde",
      value: <time dateTime={started}>{startedAt}</time>,
    });
  }

  return (
    <dl
      data-health="ok"
      className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-body-small text-on-surface-variant"
    >
      {items.map((item) => (
        <div key={item.id} data-health-item={item.id} className="flex items-center gap-1.5">
          <dt className="text-ink-faint">{item.term}</dt>
          <dd>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

interface FooterProps {
  /** Undefined until `/api/health` settles — see `App`. */
  reading?: HealthReading;
}

/**
 * The **Rodapé**: what this site is, and what is currently serving it.
 *
 * It sits inside the page container rather than under it, so the `pb-28` that
 * clears the navigation bar fixed to the bottom edge on a phone clears the
 * rodapé too. Under it, the last line of the readout would sit beneath the bar
 * — invisible until someone scrolls to the end of a twenty-club table.
 *
 * Nothing at all is rendered until the health fetch settles. A footer that
 * appears with the rest of the page and then grows a row of facts under the
 * reader's cursor is worse than one that arrives whole, and the readout is the
 * only thing here that has to wait.
 */
export function Footer({ reading }: FooterProps) {
  return (
    <footer className="mt-10 border-t border-outline-variant pt-4">
      <h2 className="sr-only">Rodapé</h2>

      <p className="text-body-small text-ink-muted">
        Projeto independente para acompanhar o Campeonato Brasileiro Série A. Sem vínculo
        com a CBF ou com os clubes.
      </p>

      {reading && <HealthReadout {...reading} />}
    </footer>
  );
}
