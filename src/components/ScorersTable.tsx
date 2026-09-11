import { countLabel } from "@/count-core";
import { nicknameLabel, playerNickname } from "@/player-core";
import { LINK_UNDERLINE } from "@/src/components/interaction";
import { TableScroller } from "@/src/components/TableScroller";
import { PLAYER_NICKNAMES } from "@/src/data/player-nicknames";
import type { Scorer } from "@/src/types";

interface ScorersTableProps {
  rows: Scorer[];
  /** Omit to render plain names — the table stands on its own. */
  onSelectPlayer?: (scorer: Scorer) => void;
}

export function ScorersTable({ rows, onSelectPlayer }: ScorersTableProps) {
  if (rows.length === 0) {
    return <p className="text-body-medium text-ink-muted">Artilharia indisponível no momento.</p>;
  }

  return (
    <>
      {/* **No `min-w` on the table, and that is a measurement rather than a
          tidy-up.** It carried `min-w-[32rem]`, so on every phone the table was
          512px inside a 286–378px box and scrolled sideways: at 360px G, A, P
          and J were all cut off and Jogador itself was clipped, with nothing on
          the page to say so. Without it the table fits at 320, 360, 375 and
          412px (measured 2026-09-11 against the frozen snapshot). The price is
          wrapping: the longest name — "Danilo dos Santos de Oliveira" — takes
          two lines at 360 and 375, six names do at 320, none do at 412. A
          wrapped name costs a row 20px; a scrolled table cost the reader the
          four figures the page exists to show.

          `TableScroller` stays as the fallback rather than the fix: it draws
          nothing while the table fits, and says so — fade, chevron, a focusable
          region — the day a longer name or a narrower screen makes it
          overflow. Nothing is frozen here, unlike the Classificação, because
          nothing is expected to scroll. */}
      <TableScroller label="Artilharia">
        <table className="w-full text-body-medium">
          <caption className="sr-only">
            Artilharia do Campeonato Brasileiro Série A
          </caption>
          <thead className="bg-surface-container-low text-label-medium uppercase text-ink-muted">
            <tr>
              <th scope="col" className="px-3 py-2 text-left">#</th>
              <th scope="col" className="px-3 py-2 text-left">Jogador</th>
              <th scope="col" className="px-2 py-2 text-right">G</th>
              <th scope="col" className="px-2 py-2 text-right">A</th>
              <th scope="col" className="px-2 py-2 text-right">P</th>
              <th scope="col" className="px-2 py-2 text-right">J</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const nickname = playerNickname(row.playerId, row.playerName, PLAYER_NICKNAMES);
              return (
              <tr key={row.playerId} className="border-t border-outline-variant">
                <td className="px-3 py-2 tabular-nums text-ink-muted">{row.position}</td>
                <td className="px-3 py-2">
                  {onSelectPlayer ? (
                    <button
                      type="button"
                      onClick={() => onSelectPlayer(row)}
                      className={`block rounded-x-small font-medium ${LINK_UNDERLINE}`}
                    >
                      {row.playerName}
                    </button>
                  ) : (
                    <span className="block font-medium">{row.playerName}</span>
                  )}
                  {/* Under the name, in the caption the club already occupies —
                      the elenco's arrangement, so an apelido reads the same way
                      on both pages. */}
                  <span className="block text-body-small text-ink-faint">
                    {[nickname && nicknameLabel(nickname), row.club.shortName]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </td>
                <td className="px-2 py-2 text-right font-semibold tabular-nums">{row.goals}</td>
                <td className="px-2 py-2 text-right tabular-nums text-ink-muted">
                  {countLabel(row.assists)}
                </td>
                <td className="px-2 py-2 text-right tabular-nums text-ink-muted">
                  {countLabel(row.penalties)}
                </td>
                <td className="px-2 py-2 text-right tabular-nums text-ink-muted">
                  {countLabel(row.playedMatches)}
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </TableScroller>

      {/* Below and outside the scroller, where the Classificação keeps its
          zone key and for the same reason: inside the scroll container a key
          slides away the moment the table is scrolled, and the fade would sit
          over its last words. */}
      <p className="mt-2 px-1 text-body-small text-ink-faint">
        G gols · A assistências · P pênaltis · J jogos · — não informado
      </p>
    </>
  );
}
