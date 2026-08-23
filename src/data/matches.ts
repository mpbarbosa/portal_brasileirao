import type { Match } from "@/src/types";

/**
 * PLACEHOLDER FIXTURES — not real Série A results.
 *
 * These exist so the standings pipeline and UI have something to render before
 * a real data source is wired up. Round 1 is FINISHED with invented scorelines;
 * round 2 is SCHEDULED with no scores. Every endpoint serving this data reports
 * `source: "placeholder"` so nothing presents it as live. Delete this file once
 * a real provider lands.
 */
export const SEED_MATCHES: Match[] = [
  { id: "r1-m1", round: 1, kickoff: "2026-04-11T19:00:00Z", status: "FINISHED", homeCode: "FLA", awayCode: "SAN", homeGoals: 2, awayGoals: 0 },
  { id: "r1-m2", round: 1, kickoff: "2026-04-11T21:30:00Z", status: "FINISHED", homeCode: "PAL", awayCode: "VIT", homeGoals: 1, awayGoals: 1 },
  { id: "r1-m3", round: 1, kickoff: "2026-04-12T16:00:00Z", status: "FINISHED", homeCode: "CRU", awayCode: "JUV", homeGoals: 3, awayGoals: 1 },
  { id: "r1-m4", round: 1, kickoff: "2026-04-12T16:00:00Z", status: "FINISHED", homeCode: "BOT", awayCode: "FOR", homeGoals: 0, awayGoals: 0 },
  { id: "r1-m5", round: 1, kickoff: "2026-04-12T18:30:00Z", status: "FINISHED", homeCode: "SAO", awayCode: "CEA", homeGoals: 2, awayGoals: 1 },
  { id: "r1-m6", round: 1, kickoff: "2026-04-12T18:30:00Z", status: "FINISHED", homeCode: "BAH", awayCode: "SPT", homeGoals: 1, awayGoals: 0 },
  { id: "r1-m7", round: 1, kickoff: "2026-04-12T21:00:00Z", status: "FINISHED", homeCode: "MIR", awayCode: "VAS", homeGoals: 1, awayGoals: 2 },
  { id: "r1-m8", round: 1, kickoff: "2026-04-13T19:00:00Z", status: "FINISHED", homeCode: "FLU", awayCode: "CAP", homeGoals: 2, awayGoals: 2 },
  { id: "r1-m9", round: 1, kickoff: "2026-04-13T21:00:00Z", status: "FINISHED", homeCode: "COR", awayCode: "CAM", homeGoals: 0, awayGoals: 1 },
  { id: "r1-m10", round: 1, kickoff: "2026-04-13T21:00:00Z", status: "FINISHED", homeCode: "GRE", awayCode: "INT", homeGoals: 1, awayGoals: 1 },

  { id: "r2-m1", round: 2, kickoff: "2026-04-18T19:00:00Z", status: "SCHEDULED", homeCode: "SAN", awayCode: "PAL", homeGoals: null, awayGoals: null },
  { id: "r2-m2", round: 2, kickoff: "2026-04-18T21:30:00Z", status: "SCHEDULED", homeCode: "VIT", awayCode: "CRU", homeGoals: null, awayGoals: null },
  { id: "r2-m3", round: 2, kickoff: "2026-04-19T16:00:00Z", status: "SCHEDULED", homeCode: "JUV", awayCode: "BOT", homeGoals: null, awayGoals: null },
  { id: "r2-m4", round: 2, kickoff: "2026-04-19T16:00:00Z", status: "SCHEDULED", homeCode: "FOR", awayCode: "SAO", homeGoals: null, awayGoals: null },
  { id: "r2-m5", round: 2, kickoff: "2026-04-19T18:30:00Z", status: "SCHEDULED", homeCode: "CEA", awayCode: "BAH", homeGoals: null, awayGoals: null },
  { id: "r2-m6", round: 2, kickoff: "2026-04-19T18:30:00Z", status: "SCHEDULED", homeCode: "SPT", awayCode: "MIR", homeGoals: null, awayGoals: null },
  { id: "r2-m7", round: 2, kickoff: "2026-04-19T21:00:00Z", status: "SCHEDULED", homeCode: "VAS", awayCode: "FLU", homeGoals: null, awayGoals: null },
  { id: "r2-m8", round: 2, kickoff: "2026-04-20T19:00:00Z", status: "SCHEDULED", homeCode: "CAP", awayCode: "COR", homeGoals: null, awayGoals: null },
  { id: "r2-m9", round: 2, kickoff: "2026-04-20T21:00:00Z", status: "SCHEDULED", homeCode: "CAM", awayCode: "GRE", homeGoals: null, awayGoals: null },
  { id: "r2-m10", round: 2, kickoff: "2026-04-20T21:00:00Z", status: "SCHEDULED", homeCode: "INT", awayCode: "FLA", homeGoals: null, awayGoals: null },
];
