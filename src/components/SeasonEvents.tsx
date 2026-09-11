import { brasiliaDay, clubTimeline, eventSpan, scopeLabel, sourceHost } from "@/events-core";
import { LINK_UNDERLINE } from "@/src/components/interaction";
import { Surface } from "@/src/components/Surface";
import type { ClubCode, SeasonEvent } from "@/src/types";

/**
 * **Acontecimentos** — what happened to this club off the pitch, and what
 * happened to the whole division, in one list ordered newest first.
 *
 * It answers the question the rest of the club page contains and never states.
 * A run of four defeats is on the form guide; that the club changed técnico in
 * the middle of it is not, anywhere. And the season's largest single fact —
 * that there was no football at all between 1 June and 15 July — is visible
 * only as a hole in **Jogos disputados** that a reader has to notice and then
 * explain to themselves.
 *
 * **The general acontecimentos are merged in rather than given a section of
 * their own, and that is what `geral` means**: one that touches all twenty
 * clubs belongs in all twenty timelines. `clubTimeline` does the merge, so the
 * rule is stated once and this component renders what it is handed.
 *
 * **Not a sixth `NAV_ITEMS` entry, and not a route.** MD3's navigation bar
 * carries three to five destinations, this app has five, and the fifth one's
 * padding had to be measured at 320/360/375dp to fit — the argument
 * `LeagueStats` and `CampaignFacts` both write out. This is a panel on the page
 * whose subject it is about.
 *
 * ## Two decisions in the markup
 *
 * **A general row is captioned in WORDS and never in a colour.** Every mark on
 * a page here is one tone unless the tone encodes something (`TrafficView`'s
 * rule), and "this one is about everybody" is not a quantity — it is a fact
 * about the row, so the row says it. A club row carries no counterpart caption,
 * because the page has already said whose page this is: `scopeLabel` returns
 * null for exactly that reason, the way `playerPositionLabel` drops a broad
 * position under a heading that names it.
 *
 * **The row is content, not a control, so the source is a link INSIDE it** —
 * named by its bare host, like every external link this app renders. The whole
 * row is deliberately **not** a link the way the Painel row and the Meu time
 * strip are: those offer one thing and going there is the errand, where here
 * the fact is the errand and the report is provenance. Making the row a link
 * would also be fourteen full-width invitations to leave the site on a page
 * whose other whole-row link stays inside it.
 */

interface SeasonEventsProps {
  events: SeasonEvent[];
  clubCode: ClubCode;
  /**
   * The Brazil-local day, for `eventSpan`. Optional so callers need not thread
   * a clock through; a spec passes one to pin a span.
   *
   * **There is no `useNow` here, unlike `FollowedClubStrip` and `LiveView`.** Those
   * tick because they print a contagem regressiva that is wrong within the
   * minute. What moves here is a day boundary, and re-rendering the section at
   * midnight to change "desde 1 de junho" into a closed range is not worth a
   * timer — a reader who has had the page open that long will reload.
   */
  today?: string;
}

export function SeasonEvents({ events, clubCode, today }: SeasonEventsProps) {
  const timeline = clubTimeline(events, clubCode);
  if (timeline.length === 0) return null;

  const day = today ?? brasiliaDay(new Date());

  return (
    <section className="mt-6" data-events>
      <h3 className="mb-2 text-body-medium font-medium text-ink-muted">Acontecimentos</h3>
      <ul aria-label="Acontecimentos da temporada" className="space-y-1">
        {timeline.map((event) => {
          const span = eventSpan(event, day);
          const scope = scopeLabel(event);
          const host = sourceHost(event.source);
          return (
            <Surface
              as="li"
              filled
              key={event.id}
              data-event={event.id}
              data-event-scope={event.scope}
              className="px-3 py-2"
            >
              {/* The date and the scope share one faint line above the
                  headline, which is `StatTile`'s ladder: what the row is
                  filed under recedes, and what it says is read. An entry
                  whose date does not parse loses this line rather than the
                  whole row — `eventSpan` returns null and nothing here
                  substitutes a placeholder. */}
              <p className="text-body-small text-ink-faint">
                {span?.label}
                {span?.days != null && ` · ${span.days} dias`}
                {scope && (
                  <>
                    {span ? " · " : ""}
                    <span data-event-general>{scope}</span>
                  </>
                )}
              </p>

              <p className="font-medium text-on-surface">{event.title}</p>

              {event.detail && (
                <p className="mt-0.5 text-body-small text-ink-muted">{event.detail}</p>
              )}

              {host && (
                <p className="mt-0.5 text-body-small">
                  <a
                    href={event.source}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={LINK_UNDERLINE}
                    data-event-source
                  >
                    {host}
                    <span className="sr-only"> — reportagem (abre em nova aba)</span>
                  </a>
                </p>
              )}
            </Surface>
          );
        })}
      </ul>
    </section>
  );
}
