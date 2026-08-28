/**
 * The design-system rules, as something that can fail.
 *
 * `CLAUDE.md`'s **Key conventions** forbid a handful of Tailwind utilities in
 * components: a raw palette shade, a Tailwind radius, a bare type step, a
 * `tracking-*`, a hand-written hover colour. Until this module they were
 * enforced by a person noticing. They had held for fourteen phases, which is a
 * fact about the reviewers rather than about the repository — `npm run lint` is
 * `tsc --noEmit` and cannot see a class name, and `npm run test:tokens` checks
 * that the generated block matches its generator and nothing about the call
 * sites.
 *
 * A grep rather than ESLint, deliberately. This repo has no ESLint by choice,
 * and acquiring one to police six string patterns is a dependency, a config and
 * a plugin API against a rule set that fits on one screen.
 *
 * Pure, like every other `*-core.ts`: text in, findings out. The file walking
 * lives in the test, which is what lets the scanner be exercised on synthetic
 * input where a violation can be *constructed* rather than found.
 */

export interface Rule {
  /** Stable id, so a test can assert which rule fired rather than matching prose. */
  id: string;
  pattern: RegExp;
  /** What the author should write instead. Printed on failure. */
  guidance: string;
}

export interface Finding {
  rule: string;
  guidance: string;
  /** 1-indexed, so the message is clickable. */
  line: number;
  text: string;
}

/**
 * Tailwind's default palette. Named in full rather than matched as
 * `[a-z]+-[0-9]{2,3}`, which would also swallow this app's own tokens the day
 * one of them ends in a number.
 */
const PALETTE = [
  "slate", "gray", "zinc", "neutral", "stone",
  "red", "orange", "amber", "yellow", "lime", "green", "emerald", "teal",
  "cyan", "sky", "blue", "indigo", "violet", "purple", "fuchsia", "pink", "rose",
].join("|");

/** Every Tailwind utility prefix that takes a colour. */
const COLOUR_PROPERTY =
  "bg|text|border|ring|fill|stroke|decoration|outline|divide|from|via|to|accent|caret|shadow|placeholder";

export const RULES: Rule[] = [
  {
    id: "palette-shade",
    pattern: new RegExp(`\\b(?:${COLOUR_PROPERTY})-(?:${PALETTE})-(?:50|\\d00|950)\\b`),
    guidance:
      "use a semantic token (text-ink-muted, bg-surface-container) — before tokens this app had 32 distinct colour utilities and five shades of grey text",
  },
  {
    id: "tailwind-radius",
    // `rounded-small` and friends are the shape scale; `rounded-full` is MD3's
    // pill and legitimate. Anything else in the `rounded` family is Tailwind's
    // own scale, which shares names with MD3's and not sizes.
    pattern: /\brounded(?:-(?:sm|md|lg|xl|2xl|3xl))?\b(?!-)/,
    guidance:
      "use the MD3 shape scale (rounded-x-small … rounded-x-large, or rounded-full) — rounded-lg is 8px in Tailwind and MD3's large is 16dp",
  },
  {
    id: "bare-type-step",
    pattern: /\btext-(?:xs|sm|base|lg|xl|[2-9]xl)\b/,
    guidance:
      "use the MD3 type scale (text-body-small … text-display-large) — each step carries size, line height and letter spacing together",
  },
  {
    id: "tracking-utility",
    pattern: /\btracking-[a-z]+\b/,
    guidance:
      "letter spacing comes with the type step; naming one thing is the point",
  },
  {
    id: "motion-utility",
    // These are the subtle ones: there is no `--duration-*` utility namespace in
    // Tailwind v4, so `duration-short-4` compiles to nothing at all and leaves
    // the default in place. A rule against a class that looks like it works.
    pattern: /\b(?:duration|ease)-[a-z0-9-]+/,
    guidance:
      "a bare `transition` already means MD3 standard easing at 200ms — and duration-short-4 compiles to nothing in Tailwind v4",
  },
  {
    id: "hand-written-state",
    pattern: /\b(?:hover|focus|focus-visible|active):(?:bg|text|border|outline)-/,
    guidance:
      "hover, focus and pressed come from interaction.ts (STATE_LAYER, FOCUS_RING, LINK_UNDERLINE, BACK_LINK)",
  },
];

/**
 * Where a rule's vocabulary is defined, and therefore where it does not apply.
 *
 * `interaction.ts` is the *only* place a hover, focus or pressed colour may be
 * written, which is the rule — so the module that holds them cannot violate it
 * any more than `index.css` can violate the rule against raw colours. This is a
 * scope, not an exemption list: an exemption names a file that breaks the rule
 * and is forgiven, and one of those is how a gate comes to have three. Nothing
 * may be added here for a file that merely has a violation in it.
 */
export const DEFINITION_SITES: Record<string, string> = {
  "hand-written-state": "src/components/interaction.ts",
};

/** The rules that apply to a file, given its path relative to the repo root. */
export const rulesFor = (path: string, rules: Rule[] = RULES): Rule[] =>
  rules.filter((rule) => DEFINITION_SITES[rule.id] !== path);

/**
 * Strip comments, so the rules read code rather than prose.
 *
 * This is not decoration: `Button.tsx` explains the migration by *quoting* the
 * utility it replaced (`hover:bg-raised`), and half the value of these files is
 * comments that name what a rule forbids. A scanner that flags them would be
 * uninstalled within a week, which is the failure mode of a noisy gate.
 *
 * Hand-written rather than regex-replaced because a regex cannot tell a `//`
 * inside a string from one that opens a comment, and `https://` appears in this
 * codebase. Getting that wrong drops the rest of a real line — a false
 * *negative*, which is the direction a gate must never fail in.
 *
 * Replaces comment bodies with spaces rather than removing them, so every
 * surviving character keeps its line number.
 */
export const stripComments = (source: string): string => {
  const out: string[] = [];
  let i = 0;
  /** Which quote we are inside, or null. */
  let quote: string | null = null;

  while (i < source.length) {
    const c = source[i];
    const next = source[i + 1];

    if (quote) {
      if (c === "\\") {
        out.push(c, next ?? "");
        i += 2;
        continue;
      }
      if (c === quote) quote = null;
      out.push(c);
      i += 1;
      continue;
    }

    if (c === '"' || c === "'" || c === "`") {
      quote = c;
      out.push(c);
      i += 1;
      continue;
    }

    if (c === "/" && next === "*") {
      const end = source.indexOf("*/", i + 2);
      const stop = end === -1 ? source.length : end + 2;
      for (let j = i; j < stop; j += 1) out.push(source[j] === "\n" ? "\n" : " ");
      i = stop;
      continue;
    }

    if (c === "/" && next === "/") {
      while (i < source.length && source[i] !== "\n") {
        out.push(" ");
        i += 1;
      }
      continue;
    }

    out.push(c);
    i += 1;
  }

  return out.join("");
};

/** Every rule violated by `source`, with the line each was found on. */
export const scan = (source: string, rules: Rule[] = RULES): Finding[] => {
  const lines = stripComments(source).split("\n");
  const findings: Finding[] = [];

  lines.forEach((line, index) => {
    for (const rule of rules) {
      if (rule.pattern.test(line)) {
        findings.push({
          rule: rule.id,
          guidance: rule.guidance,
          line: index + 1,
          text: line.trim(),
        });
      }
    }
  });

  return findings;
};
