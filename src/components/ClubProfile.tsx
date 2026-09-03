import { useMemo } from "react";

import {
  clubProfile,
  markerFraction,
  medianFraction,
  rankLabel,
  valueLabel,
  type ProfileRow,
} from "@/scouts-core";
import { LINK_UNDERLINE } from "@/src/components/interaction";
import { ProfileScatter, ScatterKey } from "@/src/components/ProfileScatter";
import { Surface } from "@/src/components/Surface";
import { CLUB_SCOUTS, CLUB_SCOUTS_THROUGH_ROUND } from "@/src/data/club-scouts";
import type { ClubCode } from "@/src/types";

interface ClubProfileProps {
  clubCode: ClubCode;
}

/**
 * The **Perfil** on the Painel do clube: six rates, each read against the
 * division rather than on its own.
 *
 * It answers the question the campanha cannot. The velas say where a club sits
 * and how it got there; nothing in this app says *how it plays*. Internacional
 * 4th in finalizações and 20th in conversão is a whole side in two rows, and the
 * table can only report the consequence.
 *
 * **Every figure here comes from a committed file** (`src/data/club-scouts.ts`),
 * so this section costs no request and cannot fail — the same standing as the
 * broadcaster marks and the hymns. It is also **stale by construction**, the
 * source being a weekly snapshot, which is why the caption names the rodada it
 * runs through instead of implying it is live. That is the `StadiumWeather`
 * rule: a card that says how old it is beats one that looks current.
 *
 * The section is **absent, not empty**, where a club has no counters — a fresh
 * clone whose seed has moved past what caRtola has published gets no Perfil
 * rather than six dashes.
 */
export function ClubProfile({ clubCode }: ClubProfileProps) {
  const rows = useMemo(() => clubProfile(CLUB_SCOUTS, clubCode), [clubCode]);
  if (rows.length === 0) return null;

  return (
    <section className="mt-6" data-profile="">
      <h3 className="mb-2 text-body-medium font-medium text-ink-muted">Perfil</h3>
      <Surface filled className="px-3 py-2">
        <dl className="divide-y divide-outline-variant">
          {rows.map((row) => (
            <ProfileEntry key={row.id} row={row} />
          ))}
        </dl>
        {/* Inside the same Surface as the strip, and beneath it. Two sections
            would mean two credit lines and two statements of which rodada the
            figures run through, for one set of numbers from one file — and a
            reader would have to check whether the two dates agreed. The strip
            comes first because it needs no interpretation; the scatter is the
            pair of rows read against each other. */}
        {/* Two pairings, stacked, sharing the x axis on purpose — finalizações
            is the volume every other rate is spent on, so reading it against
            two different y axes is the point rather than a repetition. The
            order is not arbitrary: ataque × defesa says how a match goes, which
            needs no arithmetic, and volume × conversão says how much the
            shooting is worth, which is a ratio the first drawing cannot show.
            Same reason the strip precedes both. */}
        <div className="mt-3 border-t border-outline-variant pt-3">
          <ProfileScatter division={CLUB_SCOUTS} clubCode={clubCode} pair="ataque-defesa" />
        </div>
        <div className="mt-3 border-t border-outline-variant pt-3">
          <ProfileScatter division={CLUB_SCOUTS} clubCode={clubCode} pair="volume-conversao" />
        </div>

        {/* The keys, the recency and the credit, in that order — and **every
            general sentence in this section is here**, which is what lets each
            figure above say only what is true of its own club. The keys are not
            decoration: the tick is the division's median and a dot is a whole
            club, and an unexplained mark is a mark a reader has to guess at.
            The rodada is there for `StadiumWeather`'s reason — the source is a
            weekly snapshot, and a figure with no date reads as today's. The
            credit is there for the stadium photographs' reason: this is
            somebody else's work.

            Three blocks rather than one paragraph. They answer three unrelated
            questions — how to read the strip, how to read the drawings, how old
            all of it is — and run together they were a wall a reader has to
            parse to find the one line they wanted. The recency stays **last**,
            both because it covers everything above it and because the Painel's
            own spec reads it as this section's final paragraph. */}
        <div className="mt-2 border-t border-outline-variant pt-2 text-body-small text-ink-faint">
          <p>Cada barra vai do menor ao maior da divisão, e o traço marca a mediana.</p>
          <ScatterKey className="mt-1.5" />
          <p className="mt-1.5">
            Médias por jogo até a {CLUB_SCOUTS_THROUGH_ROUND}ª rodada. Números de{" "}
            <a
              href="https://github.com/henriquepgomide/caRtola"
              target="_blank"
              rel="noopener noreferrer"
              className={LINK_UNDERLINE}
            >
              caRtola
            </a>
            .
          </p>
        </div>
      </Surface>
    </section>
  );
}

/**
 * One rate: the figure and its place, over a track showing where the club sits
 * between the division's lowest and highest.
 *
 * **The track is `aria-hidden` and carries no information of its own.** Every
 * fact it draws — the value, the rank, the size of the division — is in the
 * text beside it, so a screen reader gets the row rather than a description of
 * a picture. That is the same split the campanha marks follow.
 */
function ProfileEntry({ row }: { row: ProfileRow }) {
  const marker = markerFraction(row);
  const median = medianFraction(row);

  return (
    <div className="py-2" data-profile-row={row.id}>
      <div className="flex items-baseline justify-between gap-3 text-body-medium">
        <dt className="text-ink-muted">{row.label}</dt>
        <dd className="shrink-0 tabular-nums">
          <span className="font-semibold">{valueLabel(row)}</span>
          {row.unit === "por-jogo" && (
            <span className="text-body-small text-ink-faint"> por jogo</span>
          )}
          <span className="text-body-small text-ink-faint"> · {rankLabel(row)}</span>
        </dd>
      </div>

      {/* `relative` on a fixed-height track rather than a flex row: the marker
          is positioned as a fraction of the width, and a flex child cannot be
          placed at 37% of its parent without becoming two spacer elements whose
          rounding disagrees. */}
      <div
        aria-hidden="true"
        data-profile-track=""
        className="relative mt-1.5 h-1.5 rounded-x-small bg-outline-variant"
      >
        {/* The division's median. Drawn under the marker so the two never trade
            places when a club sits exactly on it. */}
        <span
          className="absolute top-0 h-full w-px bg-outline"
          style={{ left: `${100 * median}%` }}
        />
        {/* `-translate-x-1/2` so the dot is centred on its value; without it a
            club at the top of the division draws its marker past the end of the
            track it is meant to sit on. */}
        <span
          data-profile-marker=""
          className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-x-small bg-primary"
          style={{ left: `${100 * marker}%` }}
        />
      </div>
    </div>
  );
}
