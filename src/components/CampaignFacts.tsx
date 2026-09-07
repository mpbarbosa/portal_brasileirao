import { campaignFacts, type CampaignFact } from "@/campaign-facts-core";
import { clubKey } from "@/club-core";
import { ClubCrest } from "@/src/components/ClubCrest";
import { LINK_UNDERLINE } from "@/src/components/interaction";
import { formatRoute } from "@/route-core";
import { Surface } from "@/src/components/Surface";
import type { Club, ClubRankHistory, StandingsRow } from "@/src/types";

/**
 * **Curiosidades da campanha** — the superlatives the table contains and never
 * states, beneath the Números da temporada panel that makes the same argument
 * about goals.
 *
 * **Not a sixth `NAV_ITEMS` entry**, for the reason `LeagueStats` writes out at
 * length: MD3's navigation bar carries three to five destinations, there are
 * five, and the fifth one's padding had to be measured at 320/360/375dp to fit.
 * This is a panel on the page whose data it summarises.
 *
 * It reads the `rankHistory` `App` already memoises for the Classificação's
 * campanha column, so it costs no request and no second computation.
 *
 * **Every club in a tie is named, and the layout has to survive that.** The
 * clubs are a wrapping row rather than a single line, because "Cruzeiro e
 * Flamengo" is the common case and the panel would otherwise truncate one of
 * two clubs that are equally the answer — which is the failure
 * `campaign-facts-core.ts` exists to prevent, arriving one layer later.
 */

/** One curiosity: the record, who holds it, and what it is made of. */
function Fact({
  fact,
  clubs,
  onSelectClub,
}: {
  fact: CampaignFact;
  clubs: Club[];
  onSelectClub?: (key: string) => void;
}) {
  return (
    <Surface filled data-fact={fact.id} className="px-3 py-2">
      <p className="text-body-small text-ink-faint">{fact.label}</p>

      <p data-value className="font-semibold tabular-nums">
        {fact.value} <span className="font-normal text-ink-muted">{fact.unit}</span>
      </p>

      <ul className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
        {fact.clubs.map((holder) => {
          const club = clubs.find((c) => c.code === holder.clubCode);
          return (
            <li key={holder.clubCode} className="flex min-w-0 items-center gap-1.5 text-body-medium">
              {club && <ClubCrest club={club} size={18} />}
              {club && onSelectClub ? (
                <a
                  href={formatRoute({ section: "clube", key: clubKey(club) })}
                  onClick={(event) => {
                    if (
                      event.metaKey || event.ctrlKey || event.shiftKey ||
                      event.altKey || event.button !== 0
                    ) {
                      return;
                    }
                    event.preventDefault();
                    onSelectClub(clubKey(club));
                  }}
                  className={`min-w-0 truncate rounded-x-small ${LINK_UNDERLINE}`}
                >
                  {holder.shortName}
                </a>
              ) : (
                // A club the payload does not carry keeps its name and loses
                // the link, rather than the fact losing the club.
                <span className="min-w-0 truncate">{holder.shortName}</span>
              )}
            </li>
          );
        })}
      </ul>

      <p data-detail className="text-body-small text-ink-faint">{fact.detail}</p>

      {/* The caveat travels with the fact rather than with the panel, because it
          is true of some records and not others: before a club's first match the
          clubs level on nothing are ordered by NAME, so a position from rodada 1
          or 2 is alphabet and not football. Reported rather than hidden, which
          is `rank-candles-core`'s decision about round 1's pavio. */}
      {fact.alphabetical && (
        <p data-alphabetical className="mt-1 text-body-small text-ink-faint">
          Inclui as rodadas 1 e 2, em que clubes sem jogos são ordenados por nome.
        </p>
      )}
    </Surface>
  );
}

export function CampaignFacts({
  rankHistory,
  rows,
  clubs,
  onSelectClub,
}: {
  rankHistory: ClubRankHistory[];
  rows: StandingsRow[];
  clubs: Club[];
  onSelectClub?: (key: string) => void;
}) {
  const facts = campaignFacts(rankHistory, rows);

  // Nothing has been played, so every record is an absence. The panel is absent
  // rather than empty — `LeagueStats`' answer, and `showCampaign`'s before it.
  if (facts.length === 0) return null;

  return (
    <section className="mt-6" data-campaign-facts>
      <h3 className="mb-2 text-body-medium font-medium text-ink-muted">Curiosidades da campanha</h3>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {facts.map((fact) => (
          <Fact key={fact.id} fact={fact} clubs={clubs} onSelectClub={onSelectClub} />
        ))}
      </div>
    </section>
  );
}
