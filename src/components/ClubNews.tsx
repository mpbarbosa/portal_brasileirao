import { dayLabel, sourceHost } from "@/events-core";
import { ExternalLink } from "@/src/components/ExternalLink";
import { LINK_UNDERLINE } from "@/src/components/interaction";
import { Surface } from "@/src/components/Surface";
import type { ClubNewsItem } from "@/src/types";

/**
 * **Notícias do clube** — reports about this club, newest first, each linking
 * out to the publisher.
 *
 * It is `SeasonEvents`' row with the emphasis moved, and the difference is the
 * whole distinction between the two sections. An **acontecimento** is a fact
 * this app states and cites, so its row is content and the report is a small
 * provenance link inside it. A **notícia** is somebody else's report, and
 * reading it is the errand — so here the **headline is the link**, and the
 * host rides on the faint line beside the date as who published it.
 *
 * The date goes through `dayLabel`, never `Date`, for `events-core.ts`' reason:
 * a `YYYY-MM-DD` read as a `Date` is midnight UTC and prints the day before
 * for every reader west of Greenwich. Renders nothing for a club with none.
 */
export function ClubNews({ news, clubName }: { news: ClubNewsItem[]; clubName: string }) {
  if (news.length === 0) return null;

  return (
    <section className="mt-6" data-club-news>
      <h3 className="mb-2 text-body-medium font-medium text-ink-muted">Notícias do clube</h3>
      <ul aria-label={`Notícias do ${clubName}`} className="space-y-1">
        {news.map((item) => {
          const day = dayLabel(item.date);
          const host = sourceHost(item.url);
          return (
            <Surface as="li" filled key={item.url} data-news-item className="px-3 py-2">
              <p className="text-body-small text-ink-faint">
                {[day, host].filter(Boolean).join(" · ")}
              </p>
              <p className="font-medium text-on-surface">
                <ExternalLink
                  href={item.url}
                  suffix={host ? `reportagem em ${host}` : "reportagem"}
                  className={LINK_UNDERLINE}
                  data-news-link
                >
                  {item.title}
                </ExternalLink>
              </p>
              {item.summary && (
                <p className="mt-0.5 text-body-small text-ink-muted">{item.summary}</p>
              )}
            </Surface>
          );
        })}
      </ul>
    </section>
  );
}
