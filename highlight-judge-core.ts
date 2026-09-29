/**
 * highlight-judge-core.ts
 * -----------------------
 * A PROTOTYPE second judge for "is this YouTube result this fixture's melhores
 * momentos?", asking TypeSafe's Jev the questions that need reading a title
 * rather than parsing one.
 *
 * `highlight-search-core.ts` is the judge in use, and it stays the judge in
 * use: nothing the app serves or `find-highlights.ts` writes goes through this
 * file. It exists so `scripts/eval-highlight-judge.ts` can measure whether a
 * model-backed judge agrees with the rules — and where it does not — before
 * anybody argues for wiring it in.
 *
 * **The division of labour is the design, and it follows the model's own
 * documented limits** (docs.typesafe.ai, "Jev 1.13 Jaggedness"): Jev reads
 * dates as text and is unreliable with numbers, so the four checks that are
 * facts rather than readings stay in code — the channel id, the scoreline, the
 * round/season stated in the title, and the upload window. The model is asked
 * only what the regexes approximate: whether the video is a highlights
 * package at all, which fixture the title names (the reverse fixture being the
 * commonest near-miss), and whether it belongs to another competition. The
 * last one replaces `OTHER_COMPETITIONS`, whose own comment records the trap a
 * word list walks into: "MINEIRO" is a club name before it is a competition.
 *
 * Pure like every `*-core` module: `judgeRequest` builds the request body and
 * `judgeVerdict` composes the answers, so the thresholds are unit-tested
 * against fixed answers with no network. The HTTP call is
 * `scripts/typesafe-api.ts`.
 *
 * **It fails toward `unconfirmed`, never toward `accepted`.** A reading the
 * model is unsure of holds the candidate for a person, the direction
 * `highlight-search-core.ts` already chooses: a wrong melhores-momentos link is
 * worse than none, because the page degrades to an honest search.
 */
import {
  channelFor,
  DEFAULT_WINDOW_HOURS,
  parseTitle,
  type Candidate,
  type Fixture,
  type Status,
  type Verdict,
} from "@/highlight-search-core";

/** The model TypeSafe serves as its stable release. Pinned by alias rather than
 *  version, which is what a prototype wants and a shipped judge would not. */
export const JUDGE_MODEL = "jev-latest";

/**
 * Where a reading stops counting as settled. Starting points, not results: the
 * TypeSafe docs recommend 0.9 to act unattended and 0.5 as the floor below
 * which a person decides, and say to tune on your own data — which is what the
 * evaluation script is for. Each is one constant so a sweep edits one line.
 */
export const THRESHOLDS = {
  /** Noul: probability that the video is a highlights package. */
  highlights: 0.8,
  /** Choice: confidence that the title names this fixture in this order. */
  fixture: 0.8,
  /** Noul: probability that the title names another competition. At or above
   *  this it is refused; between this and `otherCompetitionHold` it is held. */
  otherCompetition: 0.8,
  otherCompetitionHold: 0.2,
} as const;

/** Question ids are for code only — TypeSafe does not send them to the model,
 *  so every question states its whole meaning in `instructions`. */
export const QUESTION_IDS = ["highlights", "fixture", "other_competition"] as const;
export type QuestionId = (typeof QUESTION_IDS)[number];

export const FIXTURE_OPTIONS = ["this_fixture", "reverse_fixture", "different_match"] as const;
export type FixtureOption = (typeof FIXTURE_OPTIONS)[number];

export interface JudgeRequest {
  model: string;
  state: {
    video: { title: string; channel: string };
    fixture: {
      competition: string;
      season: number;
      round: number;
      home: string;
      away: string;
    };
  };
  questions: Record<QuestionId, unknown>;
}

/**
 * The state is the title and the fixture it is being judged against, and
 * nothing else — the model's documented weakness with irrelevant context is a
 * reason to leave the kickoff, the score and the video id out. **The score is
 * deliberately absent**: it is checked in code, and giving the model digits to
 * compare invites it to answer a question nobody asked it.
 */
export const judgeRequest = (candidate: Candidate, fixture: Fixture): JudgeRequest => ({
  model: JUDGE_MODEL,
  state: {
    video: {
      title: candidate.title,
      channel: channelFor(candidate.channelId)?.label ?? "desconhecido",
    },
    fixture: {
      competition: "Campeonato Brasileiro Série A (Brasileirão)",
      season: new Date(fixture.match.kickoff).getUTCFullYear(),
      round: fixture.match.round,
      home: fixture.homeCodeName,
      away: fixture.awayCodeName,
    },
  },
  questions: {
    highlights: {
      type: "noul",
      instructions:
        "Is the YouTube video titled `video.title` a highlights package of a single football match — its melhores momentos or its goals?",
      criteria: {
        true: "A post-match summary of one match: 'melhores momentos', 'gols', 'compacto' or equivalent.",
        false:
          "Anything else: a full-match replay, a live stream, a press conference, an interview, analysis or debate, a pre-match show, a round-up of several matches, or a reaction video.",
      },
    },
    fixture: {
      type: "choice",
      instructions:
        "Which match does the title `video.title` name, compared with the fixture in `fixture` (home club `fixture.home`, away club `fixture.away`)? Club names may be abbreviated, nicknamed or written without accents.",
      criteria: {
        this_fixture: {
          what: "The same two clubs, with `fixture.home` named as the home side (first) and `fixture.away` as the away side (second).",
        },
        reverse_fixture: {
          what: "The same two clubs, but with `fixture.away` named first as the home side.",
        },
        different_match: {
          what: "Any other pairing: a different club on either side, only one of the two clubs, or no identifiable match.",
          not_for: "Merely different spellings of the same two clubs.",
        },
      },
    },
    other_competition: {
      type: "noul",
      instructions:
        "Does the title `video.title` say the match belongs to a competition other than the Brasileirão Série A — for example Copa do Brasil, Libertadores, Sul-Americana, a state championship, the Supercopa or a friendly?",
      criteria: {
        true: "The title names or clearly implies a competition other than the Brasileirão.",
        false:
          "The title names the Brasileirão, or names no competition at all. Words that are part of a club's name (Atlético Mineiro, Botafogo-SP) are not a competition.",
      },
    },
  },
});

export interface JudgeAnswers {
  highlights: { noul: number };
  fixture: { choice: string; confidence: number; probabilities?: Record<string, number> };
  other_competition: { noul: number };
}

/**
 * Narrow an `answers` object from the API. Anything missing or mistyped is
 * `null`, which `judgeVerdict` holds rather than accepts — the same rule
 * `parseHealth` follows for a payload the client cannot assume it understands.
 */
export const parseJudgeAnswers = (raw: unknown): JudgeAnswers | null => {
  if (!raw || typeof raw !== "object") return null;
  const answers = raw as Record<string, Record<string, unknown> | undefined>;

  const highlights = answers.highlights?.noul;
  const choice = answers.fixture?.choice;
  const confidence = answers.fixture?.confidence;
  const other = answers.other_competition?.noul;

  const isUnit = (value: unknown): value is number =>
    typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;

  if (!isUnit(highlights) || !isUnit(confidence) || !isUnit(other)) return null;
  if (typeof choice !== "string") return null;

  return {
    highlights: { noul: highlights },
    fixture: {
      choice,
      confidence,
      probabilities: answers.fixture?.probabilities as Record<string, number> | undefined,
    },
    other_competition: { noul: other },
  };
};

const hoursBetween = (fromIso: string, toIso: string): number | null => {
  const from = Date.parse(fromIso);
  const to = Date.parse(toIso);
  if (Number.isNaN(from) || Number.isNaN(to)) return null;
  return (to - from) / 3_600_000;
};

/**
 * Compose the model's answers with the checks code owns.
 *
 * The order mirrors `assess`: cheap facts first, so a rejection explains
 * itself. `answers` may be null — the model was not asked, or answered
 * something unreadable — and then the candidate is held, never accepted.
 *
 * **A title with no parseable scoreline is held, not rejected.** That is the
 * one place this judge is deliberately looser than the rules: a title such as
 * "Os gols de Palmeiras e Vasco" is a real highlights package the regex cannot
 * read, and measuring how often the model rescues one is half of what the
 * prototype is for. Held means a person looks; it never means published.
 */
export const judgeVerdict = (
  candidate: Candidate,
  fixture: Fixture,
  answers: JudgeAnswers | null,
  windowHours = DEFAULT_WINDOW_HOURS,
): Verdict => {
  const { match } = fixture;
  const channel = channelFor(candidate.channelId)?.label ?? null;
  const verdict = (status: Status, reason: string, hours: number | null = null): Verdict => ({
    candidate,
    channel,
    status,
    reason,
    hoursAfterKickoff: hours,
  });

  if (!channel) return verdict("rejected", "not a rights-holder channel");

  // Facts stated in the title are checked in code, where they are exact.
  const parsed = parseTitle(candidate.title);
  if (parsed) {
    if (parsed.homeGoals === match.awayGoals && parsed.awayGoals === match.homeGoals &&
        parsed.homeGoals !== parsed.awayGoals && answers?.fixture.choice === "this_fixture") {
      // Scoreline mirrored and the model reads the clubs in our order — the two
      // disagree about which side is home, so neither is trusted.
      return verdict("unconfirmed", "scoreline reads reversed while the clubs read in order");
    }
    const scoreMatches =
      (parsed.homeGoals === match.homeGoals && parsed.awayGoals === match.awayGoals) ||
      (parsed.homeGoals === match.awayGoals && parsed.awayGoals === match.homeGoals);
    if (!scoreMatches) {
      return verdict(
        "rejected",
        `score ${parsed.homeGoals}-${parsed.awayGoals}, fixture was ${match.homeGoals}-${match.awayGoals}`,
      );
    }
    if (parsed.round !== null && parsed.round !== match.round) {
      return verdict("rejected", `round ${parsed.round}, fixture is round ${match.round}`);
    }
    const season = new Date(match.kickoff).getUTCFullYear();
    if (parsed.year !== null && parsed.year !== season) {
      return verdict("rejected", `season ${parsed.year}, fixture is ${season}`);
    }
  }

  if (!answers) return verdict("unconfirmed", "no usable answer from the model");

  // Firm refusals first: a confident "no" ends it whatever else is true.
  if (answers.other_competition.noul >= THRESHOLDS.otherCompetition) {
    return verdict("rejected", `another competition (p=${answers.other_competition.noul.toFixed(2)})`);
  }
  if (answers.fixture.confidence >= THRESHOLDS.fixture) {
    if (answers.fixture.choice === "reverse_fixture") {
      return verdict("rejected", "reverse fixture (away side at home)");
    }
    if (answers.fixture.choice === "different_match") {
      return verdict("rejected", "different clubs");
    }
  }
  if (answers.highlights.noul <= 1 - THRESHOLDS.highlights) {
    return verdict("rejected", `not a highlights package (p=${answers.highlights.noul.toFixed(2)})`);
  }

  // Anything short of confident agreement is held for a person.
  const doubts: string[] = [];
  if (answers.highlights.noul < THRESHOLDS.highlights) {
    doubts.push(`highlights p=${answers.highlights.noul.toFixed(2)}`);
  }
  if (answers.fixture.choice !== "this_fixture" || answers.fixture.confidence < THRESHOLDS.fixture) {
    doubts.push(`fixture ${answers.fixture.choice} conf=${answers.fixture.confidence.toFixed(2)}`);
  }
  if (answers.other_competition.noul > THRESHOLDS.otherCompetitionHold) {
    doubts.push(`other competition p=${answers.other_competition.noul.toFixed(2)}`);
  }
  if (!parsed) doubts.push("title states no scoreline code can check");
  if (doubts.length) return verdict("unconfirmed", `model unsure: ${doubts.join("; ")}`);

  // The date decides, exactly as in `assess` — the one check neither the
  // title nor the model can stand in for.
  if (!candidate.uploadedAt) return verdict("unconfirmed", "upload date not read yet");
  const hours = hoursBetween(match.kickoff, candidate.uploadedAt);
  if (hours === null) return verdict("rejected", "unreadable upload date");
  if (hours < 0) {
    return verdict("rejected", `uploaded ${Math.abs(hours).toFixed(0)}h before kickoff`, hours);
  }
  if (hours > windowHours) {
    return verdict(
      "rejected",
      `uploaded ${(hours / 24).toFixed(0)} days after kickoff, window is ${windowHours / 24}`,
      hours,
    );
  }
  return verdict("accepted", `uploaded ${hours.toFixed(1)}h after kickoff`, hours);
};
