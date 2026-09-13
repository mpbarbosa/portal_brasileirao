import type { ReactNode } from "react";
import { goalKindLabel } from "@/goals-core";
import { nicknameLabel, playerNickname } from "@/player-core";
import { subShirtLabels } from "@/escalacao-core";
import { PLAYER_NICKNAMES } from "@/src/data/player-nicknames";
import { FOCUS_RING } from "@/src/components/interaction";
import { Surface } from "@/src/components/Surface";
import type { Club, Goal, Lineup } from "@/src/types";

interface MatchEventsProps {
  home: Club | null;
  away: Club | null;
  homeCode: string;
  awayCode: string;
  homeGoals: Goal[];
  awayGoals: Goal[];
  homeLineup: Lineup | null;
  awayLineup: Lineup | null;
  /** Called with a goal whose scorer resolved to a player. Omit and every name renders as plain text. */
  onSelectGoal?: (goal: Goal) => void;
}

type TimelineRow =
  | { kind: "goal"; rank: number; label: string | null; code: string; goal: Goal }
  | {
      kind: "sub";
      rank: number;
      label: string;
      code: string;
      on: string;
      off: string;
      onShirt: string | null;
      offShirt: string | null;
    };

/**
 * A rendered minute label ("12'", "45+1'", "90+8'", "Intervalo") turned back
 * into a number worth ORDERING on — never a value this app prints. Stoppage
 * is folded in as a hundredth so "45+1'" sorts after "45'" and before "46'",
 * mirroring how `sumulaMinuteLabel`/`sumulaSubstitutionLabel` built the label
 * in the first place (`base + 45` for that half's own stoppage). A half-time
 * substitution carries no minute of its own, so "Intervalo" is pinned at the
 * boundary between the two halves. `-1` for anything else — most goals; see
 * `Goal.minute`'s own doc for why most carry none — sorts last, after every
 * dated event, rather than claiming a position the súmula never gave it.
 */
function minuteRank(label: string | undefined): number {
  if (!label) return -1;
  if (label === "Intervalo") return 45.5;
  const parsed = /^(\d+)(?:\+(\d+))?/.exec(label);
  if (!parsed) return -1;
  const [, base, added] = parsed;
  return Number(base) + (added ? Number(added) / 100 : 0);
}

function buildTimeline({
  homeCode,
  awayCode,
  homeGoals,
  awayGoals,
  homeLineup,
  awayLineup,
}: Pick<
  MatchEventsProps,
  "homeCode" | "awayCode" | "homeGoals" | "awayGoals" | "homeLineup" | "awayLineup"
>): TimelineRow[] {
  const goalRows = (code: string, goals: Goal[]): TimelineRow[] =>
    goals.map((goal) => ({
      kind: "goal",
      rank: minuteRank(goal.minute),
      label: goal.minute ?? null,
      code,
      goal,
    }));

  const subRows = (code: string, lineup: Lineup | null): TimelineRow[] => {
    if (!lineup?.subs) return [];
    const shirts = subShirtLabels(lineup);
    return lineup.subs.map((sub, index) => ({
      kind: "sub",
      rank: minuteRank(sub.minute),
      label: sub.minute,
      code,
      on: sub.on,
      off: sub.off,
      onShirt: shirts[index]?.on ?? null,
      offShirt: shirts[index]?.off ?? null,
    }));
  };

  const rows = [
    ...goalRows(homeCode, homeGoals),
    ...goalRows(awayCode, awayGoals),
    ...subRows(homeCode, homeLineup),
    ...subRows(awayCode, awayLineup),
  ];

  // Newest first, the way a reader re-opens a finished match wants it — the
  // headline is what just happened. Equal (or unknown) ranks keep the order
  // they arrived in above, which is `goalsBySide`'s own order for goals and
  // the súmula's own order for substitutions.
  return rows
    .map((row, index) => ({ row, index }))
    .sort((a, b) => (b.row.rank !== a.row.rank ? b.row.rank - a.row.rank : a.index - b.index))
    .map(({ row }) => row);
}

const EVENT_TONE: Record<TimelineRow["kind"], string> = {
  goal: "bg-positive/20 text-primary",
  sub: "bg-surface-container-high text-on-surface-variant",
};

const EVENT_LABEL: Record<TimelineRow["kind"], string> = { goal: "GOL", sub: "SUB" };

const BADGE =
  "inline-flex shrink-0 items-center rounded-x-small px-2 py-1 text-label-medium font-medium";

const PLAYER_CHIP =
  "inline-flex items-center rounded-x-small border border-positive/40 bg-positive/10 px-2 py-0.5 text-label-medium font-medium text-primary";

/**
 * A player's name, chip-styled. The clickable form is the same chip rather
 * than a bare underlined name — `LINK_UNDERLINE` is for a name inline in
 * running text, and every name here already sits inside a badge-and-chip row.
 *
 * No hover veil: `STATE_LAYER`/`STATE_LAYER_ON_PRIMARY_CONTAINER` are the two
 * sanctioned veils in `interaction.ts` and neither fits a container already
 * filled at 10% — a chip this small does not earn a third. `FOCUS_RING` still
 * covers the keyboard case, which is the one a hover effect cannot.
 */
function PlayerChip({
  children,
  playerId,
  onSelect,
}: {
  children: ReactNode;
  playerId?: string;
  onSelect?: () => void;
}) {
  if (playerId && onSelect) {
    return (
      <button
        type="button"
        data-scorer={playerId}
        onClick={onSelect}
        className={`${PLAYER_CHIP} ${FOCUS_RING}`}
      >
        {children}
      </button>
    );
  }
  return <span className={PLAYER_CHIP}>{children}</span>;
}

/**
 * **Eventos da partida**: gols and substituições, merged into one
 * minute-ordered feed. Cartões carry no data in this app — no provider this
 * app reaches reports one, per `goals-core.ts`'s own account of what CBF's
 * match endpoint carries — so these are the two event kinds that exist,
 * never a stand-in for a third.
 *
 * Deliberately alongside `GoalColumn` and `LineupColumn`'s own substitutions
 * list rather than replacing either: this is the narrative reading of a
 * match, those are the scoreboard's quick summary and the team sheet's own
 * record of who came off. Substitution text keeps the "X por Y" phrasing
 * `LineupColumn` already uses — see its own comment on why there is no
 * arrow — rather than a "Sai/entra" pair, so a substitution is not said two
 * different ways on one page.
 */
export function MatchEvents({
  home,
  away,
  homeCode,
  awayCode,
  homeGoals,
  awayGoals,
  homeLineup,
  awayLineup,
  onSelectGoal,
}: MatchEventsProps) {
  const rows = buildTimeline({ homeCode, awayCode, homeGoals, awayGoals, homeLineup, awayLineup });
  if (rows.length === 0) return null;

  const clubFor = (code: string) => (code === homeCode ? home : code === awayCode ? away : null);

  return (
    <section className="mt-6" data-match-events>
      <h3 className="mb-2 text-body-medium font-medium text-ink-muted">Eventos da partida</h3>
      <ul className="space-y-2">
        {rows.map((row, index) => {
          const club = clubFor(row.code);
          const teamLabel = club?.tla ?? club?.shortName ?? row.code;
          const nickname =
            row.kind === "goal" && row.goal.playerId
              ? playerNickname(row.goal.playerId, row.goal.scorer, PLAYER_NICKNAMES)
              : null;
          const key =
            row.kind === "goal"
              ? `goal-${row.code}-${row.goal.scorer}-${index}`
              : `sub-${row.code}-${row.on}-${index}`;

          return (
            <Surface
              as="li"
              key={key}
              data-event-kind={row.kind}
              className={
                row.kind === "goal"
                  ? "bg-gradient-to-r from-positive/15 to-warning/10 p-3"
                  : "bg-surface-container-low p-3"
              }
            >
              <div className="flex flex-wrap items-center gap-2">
                {row.label && (
                  <span className="text-label-large font-semibold tabular-nums text-primary">
                    {row.label}
                  </span>
                )}
                <span className={`${BADGE} ${EVENT_TONE[row.kind]}`}>{EVENT_LABEL[row.kind]}</span>
                <span className={`${BADGE} bg-surface-container text-on-surface-variant`}>
                  {teamLabel}
                </span>
              </div>
              <p className="mt-1.5 text-body-medium">
                {row.kind === "goal" ? (
                  <>
                    <PlayerChip
                      playerId={row.goal.playerId}
                      onSelect={onSelectGoal ? () => onSelectGoal(row.goal) : undefined}
                    >
                      {row.goal.scorer}
                    </PlayerChip>{" "}
                    marcou
                    {goalKindLabel(row.goal.kind) ? ` (${goalKindLabel(row.goal.kind)})` : ""}.
                    {nickname && <span className="ml-1 text-ink-faint">{nicknameLabel(nickname)}</span>}
                  </>
                ) : (
                  <>
                    {row.onShirt && (
                      <span className="tabular-nums text-ink-faint">{row.onShirt} </span>
                    )}
                    <PlayerChip>{row.on}</PlayerChip>{" "}
                    <span className="text-ink-faint">
                      por {row.offShirt && <span className="tabular-nums">{row.offShirt} </span>}
                    </span>
                    <PlayerChip>{row.off}</PlayerChip>
                  </>
                )}
              </p>
            </Surface>
          );
        })}
      </ul>
    </section>
  );
}
