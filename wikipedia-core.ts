/**
 * Portuguese Wikipedia article addresses, built from a title however it was pasted.
 *
 * Pure, with no I/O (tests/wikipedia-core.test.ts).
 */
/**
 * The canonical article address for a Wikipedia title.
 *
 * Accepts what a person is likely to paste — a bare title with spaces or with
 * underscores, or a full `pt.wikipedia.org/wiki/…` link — because the list is
 * hand-maintained and being strict about the input format buys nothing. Only
 * the title is kept, so a link copied from the article's edit view or from a
 * section heading does not carry `?action=edit` or `#História` into the file.
 *
 * The edition is fixed to **pt**, and a URL naming another one returns null
 * rather than being rewritten: `Grêmio Foot-Ball Porto Alegrense` is not an
 * article on the English Wikipedia, so rewriting an `en.` link would produce a
 * plausible address that 404s, and the whole app is pt-BR anyway.
 *
 * Underscores are what the address uses and spaces are what the file reads, so
 * the title is stored with spaces and converted here. The rest is
 * percent-encoded rather than transliterated — unlike a club **slug**, where
 * stripping accents keeps the address typeable, `Gremio…` is simply a different
 * article title and would not resolve.
 *
 * Returns null for anything that is not a plausible title — Wikipedia forbids
 * `#<>[]|{}` in one — which the UI renders as no link rather than a broken one.
 */
export const wikipediaUrl = (raw: string | null | undefined): string | null => {
  const value = raw?.trim();
  if (!value) return null;

  let title = value;
  if (value.includes("/")) {
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      return null;
    }
    if (url.hostname !== "pt.wikipedia.org") return null;
    if (!url.pathname.startsWith("/wiki/")) return null;
    try {
      title = decodeURIComponent(url.pathname.slice("/wiki/".length));
    } catch {
      return null;
    }
  }

  title = title.replace(/_/g, " ").trim();
  if (!title || /[#<>[\]|{}]/.test(title)) return null;

  return `https://pt.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`;
};
