/**
 * commons-api.ts
 * --------------
 * Reading Wikimedia Commons over HTTP: the metadata for a file, and the bytes
 * of one rendering.
 *
 * Extracted when `sync-player-photos` and `check-player-photos` would have made
 * this the **fourth** copy — the two stadium scripts already carried one each,
 * and had already drifted apart in a way nobody would notice from the output:
 * one asked for `ImageDescription` and the other did not, so a description was
 * available to the checker and silently absent from the sync.
 *
 * The split from `commons-core.ts` is deliberate and worth keeping. That module
 * is pure and holds the *judgement* — which licences may be republished, whether
 * a stored credit still matches. This one does the *I/O* and holds no judgement
 * at all. Keeping them apart is what lets the rules be unit-tested without a
 * network, which is the property that made `commons-core` worth extracting in
 * the first place.
 */
import { plain } from "@/commons-core";

/**
 * Wikimedia asks reusers to identify themselves and answers generic agents with
 * 403. The caller names itself, so a throttled script can be told apart from
 * another in the logs of a server that owes us nothing.
 */
export const userAgent = (caller: string): string =>
  `portal-brasileirao/1.0 (https://brasileirao.mpbarbosa.com; ${caller})`;

const API = "https://commons.wikimedia.org/w/api.php";

export interface CommonsFacts {
  license: string;
  /** The wording the photographer dictated, where they dictated one. */
  attribution: string;
  /** Who Commons says took it. */
  artist: string;
  description: string;
  mime: string;
}

/**
 * Everything the licence decisions need about one file, or **null** when
 * Commons has no such file.
 *
 * Null rather than a throw, because "deleted or renamed" is a state the callers
 * report on rather than an error in reaching the API — and the two are worth
 * telling apart in a script's output.
 */
export const commonsFacts = async (
  file: string,
  caller: string,
): Promise<CommonsFacts | null> => {
  const url =
    `${API}?action=query&format=json&origin=*` +
    `&titles=${encodeURIComponent(`File:${file}`)}` +
    `&prop=imageinfo&iiprop=extmetadata|mime` +
    `&iiextmetadatafilter=LicenseShortName|LicenseUrl|Artist|Attribution|ImageDescription`;

  const response = await fetch(url, {
    headers: { "User-Agent": userAgent(caller) },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`Commons API answered ${response.status}`);

  const body = (await response.json()) as {
    query?: {
      pages?: Record<
        string,
        {
          missing?: string;
          imageinfo?: { mime?: string; extmetadata?: Record<string, { value: string }> }[];
        }
      >;
    };
  };

  const page = Object.values(body.query?.pages ?? {})[0];
  // A missing file comes back as a page stub carrying `missing`, not as an error.
  if (!page || page.missing !== undefined) return null;

  const info = page.imageinfo?.[0];
  const meta = info?.extmetadata ?? {};

  return {
    license: plain(meta.LicenseShortName?.value ?? ""),
    attribution: plain(meta.Attribution?.value ?? ""),
    artist: plain(meta.Artist?.value ?? ""),
    description: plain(meta.ImageDescription?.value ?? ""),
    mime: info?.mime ?? "",
  };
};

/**
 * One rendering of a file, at a given width.
 *
 * `Special:FilePath` reaches a file by **title**, which is what the data
 * stores, and follows a rename where the hashed `upload.wikimedia.org` path
 * does not. That property is worth a redirect in a script run by hand; it was
 * not worth one on every reader's page view, which is why the bytes are
 * vendored at all.
 */
export const commonsBytes = async (
  file: string,
  width: number,
  caller: string,
): Promise<Buffer> => {
  const url = `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file)}?width=${width}`;
  const response = await fetch(url, {
    headers: { "User-Agent": userAgent(caller) },
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok) throw new Error(`${response.status} downloading ${file} at ${width}px`);

  return Buffer.from(await response.arrayBuffer());
};

/** Deliberately unhurried: the 429 that motivated vendoring is a reminder that
 *  Commons is an archive, not a CDN. */
export const pause = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));
