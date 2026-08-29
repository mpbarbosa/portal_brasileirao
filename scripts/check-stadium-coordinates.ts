/**
 * check-stadium-coordinates — every coordinate in `src/data/stadiums.ts` still
 * matches Wikidata, and still lands in the city CBF names for that ground.
 *
 * The coordinates exist for the **clima no estádio**: Open-Meteo answers for a
 * point, and no provider this app reaches carries a venue coordinate at any
 * tier. They were read out of Wikidata's `P625`, joined on the `wikipedia`
 * title `stadiums.ts` already stores — the same article the capacity and the
 * inauguration came from, so the whole file rests on one source.
 *
 * **A plausible coordinate is indistinguishable from a correct one**, which is
 * the rule that file already states about capacity and is sharper here: a wrong
 * number does not look wrong, it silently reports the weather somewhere else.
 * Nothing in the build can see it, so this is the only thing that can.
 *
 * Two checks per ground, and the second is the load-bearing one:
 *
 *   1. the recorded pair still matches Wikidata's `P625`, within a tolerance —
 *      an editor refining a stadium's position by thirty metres is not a defect
 *      and must not read as one;
 *   2. it is within `CITY_RADIUS_KM` of the city `venues.ts` records, resolved
 *      through Open-Meteo's own geocoder. That is what catches the failure a
 *      title match cannot: a coordinate for the *wrong stadium*, which agrees
 *      with Wikidata perfectly and is simply the wrong ground.
 *
 * It talks to Wikidata and Open-Meteo only, so it costs nothing from the
 * football-data budget, and like `check-hymns` it prints the whole table rather
 * than only the failures — a machine narrows what a person has to read, it does
 * not replace reading.
 *
 * **No build runs it.** CI has no network dependency on a third party by
 * design, and a coordinate an editor nudges on someone else's server is not a
 * reason for a red build on a commit that did not touch it. The monthly
 * `curated-data.yml` workflow runs it and reports into an issue, which is the
 * whole of the difference between *scheduled* and *in CI*.
 *
 *   npm run check-stadium-coordinates
 */
import { slugify } from "@/club-core";
import { STADIUMS } from "@/src/data/stadiums";
import { VENUES } from "@/src/data/venues";

/** How far the recorded pair may sit from Wikidata's before it is a mismatch
 *  rather than an editor refining a position. 500 m is far tighter than any
 *  weather model resolves and far looser than a real correction. */
const WIKIDATA_TOLERANCE_KM = 0.5;

/** How far a ground may sit from its city's centre. Generous on purpose:
 *  Itaquera puts the Neo Química Arena 16.5 km out and that is correct. The
 *  check is aimed at a coordinate in the wrong *city*, not the wrong suburb. */
const CITY_RADIUS_KM = 40;

const EARTH_KM = 6371;

const distanceKm = (a: readonly [number, number], b: readonly [number, number]): number => {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const [lat1, lon1] = a;
  const [lat2, lon2] = b;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_KM * Math.asin(Math.sqrt(h));
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

interface WikidataEntities {
  entities?: Record<
    string,
    {
      claims?: Record<
        string,
        { mainsnak: { datavalue?: { value: { latitude: number; longitude: number } } } }[]
      >;
    }
  >;
}

/** pt-wiki title → Wikidata id, in one request for the whole division. */
const wikidataIds = async (titles: string[]): Promise<Map<string, string>> => {
  const url = new URL("https://pt.wikipedia.org/w/api.php");
  url.search = new URLSearchParams({
    action: "query",
    format: "json",
    prop: "pageprops",
    ppprop: "wikibase_item",
    redirects: "1",
    titles: titles.join("|"),
  }).toString();
  const body = (await (await fetch(url)).json()) as {
    query?: {
      pages?: Record<string, { title: string; pageprops?: { wikibase_item?: string } }>;
      normalized?: { from: string; to: string }[];
      redirects?: { from: string; to: string }[];
    };
  };
  // A title may have been normalised or redirected on the way, so map the
  // answer back to what we asked for rather than assuming they match.
  const alias = new Map<string, string>();
  for (const hop of [...(body.query?.normalized ?? []), ...(body.query?.redirects ?? [])]) {
    alias.set(hop.to, hop.from);
  }
  const resolved = new Map<string, string>();
  for (const page of Object.values(body.query?.pages ?? {})) {
    const id = page.pageprops?.wikibase_item;
    if (!id) continue;
    let asked = page.title;
    // Follow the alias chain back to the title as written in stadiums.ts.
    for (let hop = 0; hop < 4 && alias.has(asked); hop += 1) asked = alias.get(asked)!;
    resolved.set(asked, id);
  }
  return resolved;
};

const wikidataCoordinates = async (ids: string[]): Promise<Map<string, [number, number]>> => {
  const url = new URL("https://www.wikidata.org/w/api.php");
  url.search = new URLSearchParams({
    action: "wbgetentities",
    format: "json",
    props: "claims",
    ids: ids.join("|"),
  }).toString();
  const body = (await (await fetch(url)).json()) as WikidataEntities;
  const found = new Map<string, [number, number]>();
  for (const [id, entity] of Object.entries(body.entities ?? {})) {
    const value = entity.claims?.P625?.[0]?.mainsnak?.datavalue?.value;
    if (value) found.set(id, [value.latitude, value.longitude]);
  }
  return found;
};

const cityCentre = async (city: string): Promise<[number, number][]> => {
  const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
  url.search = new URLSearchParams({
    name: city,
    count: "10",
    country: "BR",
    language: "pt",
  }).toString();
  const body = (await (await fetch(url)).json()) as {
    results?: { latitude: number; longitude: number }[];
  };
  return (body.results ?? []).map((r) => [r.latitude, r.longitude] as [number, number]);
};

const main = async (): Promise<void> => {
  // CBF's own venue strings are the only thing tying a ground to a city.
  const cityOf = new Map<string, string>();
  for (const venue of Object.values(VENUES)) {
    cityOf.set(slugify(venue.stadium), `${venue.city}/${venue.state}`);
  }

  const entries = Object.entries(STADIUMS);
  const titles = entries.map(([, facts]) => facts.wikipedia).filter((t): t is string => !!t);
  const ids = await wikidataIds(titles);
  const coordinates = await wikidataCoordinates([...new Set(ids.values())]);

  let failures = 0;
  console.log(
    `${"estádio".padEnd(28)} ${"cidade (CBF)".padEnd(22)} ${"Δ wikidata".padStart(11)} ${"Δ cidade".padStart(9)}  situação`,
  );

  for (const [slug, facts] of entries) {
    const note = (situation: string, dWd = "", dCity = "") => {
      const city = cityOf.get(slug) ?? "—";
      console.log(
        `${slug.padEnd(28)} ${city.padEnd(22)} ${dWd.padStart(11)} ${dCity.padStart(9)}  ${situation}`,
      );
    };

    if (!facts.coordinates) {
      failures += 1;
      note("SEM COORDENADA — a página não mostra o clima");
      continue;
    }
    if (!facts.wikipedia) {
      failures += 1;
      note("SEM ARTIGO — nada contra o que conferir");
      continue;
    }

    const id = ids.get(facts.wikipedia);
    const upstream = id ? coordinates.get(id) : undefined;
    if (!upstream) {
      failures += 1;
      note(`SEM P625 NA WIKIDATA (${id ?? "sem item"})`);
      continue;
    }

    const drift = distanceKm(facts.coordinates, upstream);
    const place = cityOf.get(slug);
    let cityDistance: number | null = null;
    if (place) {
      const centres = await cityCentre(place.split("/")[0]);
      cityDistance = centres.length
        ? Math.min(...centres.map((c) => distanceKm(facts.coordinates!, c)))
        : null;
      await sleep(200);
    }

    const problems: string[] = [];
    if (drift > WIKIDATA_TOLERANCE_KM) {
      problems.push(`difere da Wikidata (${upstream[0].toFixed(6)}, ${upstream[1].toFixed(6)})`);
    }
    if (cityDistance === null) {
      problems.push(place ? "cidade não localizada" : "sem partida com estádio no snapshot");
    } else if (cityDistance > CITY_RADIUS_KM) {
      problems.push("longe demais da cidade");
    }

    if (problems.length) failures += 1;
    note(
      problems.length ? `ATENÇÃO — ${problems.join("; ")}` : "ok",
      `${(drift * 1000).toFixed(0)} m`,
      cityDistance === null ? "—" : `${cityDistance.toFixed(1)} km`,
    );
  }

  console.log(
    `\n${entries.length} estádios, ${failures} com problema. ` +
      `Tolerância: ${WIKIDATA_TOLERANCE_KM * 1000} m da Wikidata, ${CITY_RADIUS_KM} km da cidade.`,
  );
  if (failures > 0) process.exitCode = 1;
};

await main();
