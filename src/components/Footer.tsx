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

/**
 * A link off this site, with the parts that drift when an anchor is copied
 * written down once.
 *
 * The same reasoning `ClubLinks` records, applied to the rodapé rather than to
 * a club: `target`, `rel` and the screen-reader suffix are what a second copy
 * loses, and a copy missing `rel="noopener"` is a real defect that looks
 * identical on the page. There were three outbound anchors here the moment the
 * author's links landed, which is the point at which a hand-written one is a
 * question of when rather than whether.
 *
 * It stays local rather than joining `ClubLinks`: that module is a club's
 * links, and each of its two exports knows its own address builder and its own
 * mark. This knows neither — it is the bare anchor, and the only thing the two
 * files would share is the attribute bag.
 *
 * `subject` is what the suffix says the destination is, and it is optional for
 * exactly one reason: inside the readout the `<dt>` beside the link already
 * says it, so `Fonte: football-data.org — o provedor de dados` would announce
 * the same fact twice. Everywhere else a bare domain is a bare word to a
 * screen reader and the subject is what rescues it.
 *
 * `extra` is the caller's own layout only, as it is in `ClubLinks` — the
 * rodapé's own row of links carries the touch-target floor, and the readout's
 * link must not, or a 48dp anchor inside a `<dd>` would push the whole band of
 * facts apart.
 */
function OutboundLink({
  href,
  label,
  subject,
  extra = "",
}: {
  href: string;
  label: string;
  subject?: string;
  extra?: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`${LINK_UNDERLINE} ${extra}`}
    >
      {label}
      <span className="sr-only">
        {subject === undefined ? " (abre em nova aba)" : ` — ${subject} (abre em nova aba)`}
      </span>
    </a>
  );
}

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
          <OutboundLink href="https://www.football-data.org/" label={provider} />
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

/**
 * Where else this author writes, as two links and nothing more.
 *
 * **Not navigation**, which the rodapé is explicitly not the place for — these
 * leave the site rather than moving around it, so they are a list of outbound
 * links and carry no `<nav>` and no landmark. The destinations remain
 * `NAV_ITEMS` and that bar remains full.
 *
 * **Both print their bare domain, and that is the author's decision rather
 * than a default — do not "restore" either to a friendlier name.** The first
 * draft printed the sibling app as "Agora na Copa 26", reasoning from
 * `WikipediaLink`'s rule that a link reads as the thing a reader recognises.
 * That rule is sound where the name is the *only* handle a reader has, which
 * is why the Wikipédia link still prints "Wikipédia". It is the wrong rule
 * here: these two links exist to say *this is the same author's other
 * address*, and the shared `mpbarbosa.com` stem is what carries that. A name
 * on one and a domain on the other hides the very relationship the band is
 * for, and reads as two unrelated links that happen to sit together.
 *
 * The cost is that a bare domain names no subject, so `subject` stops being a
 * nicety and becomes the only thing telling a screen-reader user where the
 * link goes. Do not drop it to match the visible text.
 *
 * A `<ul>` rather than a run of anchors in a `<p>`: a screen reader then
 * announces "lista de 2 itens" and a reader knows how many there are before
 * hearing the first, which is the whole difference between a list and a
 * sentence that happens to contain links.
 *
 * `min-h-12` is MD3's touch-target floor and it belongs here for the reason
 * `BACK_LINK` carries it — these are standalone controls on their own line,
 * not links inside a sentence. That is the same distinction that keeps the
 * floor off the twenty club names in the Classificação. The floor is on the
 * box rather than on a pseudo-element, so nothing overhangs into the
 * neighbour's area and two adjacent links cannot steal each other's presses.
 */
function AuthorLinks() {
  return (
    <ul className="mt-1 flex flex-wrap gap-x-4 text-body-small text-ink-muted">
      <li>
        <OutboundLink
          href="https://www.mpbarbosa.com"
          label="mpbarbosa.com"
          subject="site pessoal e profissional do autor"
          extra="inline-flex min-h-12 items-center"
        />
      </li>
      <li>
        <OutboundLink
          href="https://copa2026.mpbarbosa.com"
          label="copa2026.mpbarbosa.com"
          subject="o companheiro da Copa do Mundo FIFA 2026, do mesmo autor"
          extra="inline-flex min-h-12 items-center"
        />
      </li>
    </ul>
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

      <AuthorLinks />

      {reading && <HealthReadout {...reading} />}
    </footer>
  );
}
