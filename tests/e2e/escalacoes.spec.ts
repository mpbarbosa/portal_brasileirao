import { expect, test } from "@/tests/e2e/clock";

/**
 * The **escalações** on a Partida page.
 *
 * Fixture 554977 — Palmeiras 4x1 Vasco, rodada 24 — is the one the capture set
 * already opens and the one `goals.spec.ts` uses, so it is the fixture most
 * likely to keep working: the same sync run that gave it scorers gave it team
 * sheets, and the two cannot come apart because one script writes both files.
 *
 * The suite boots with `DISABLE_FOOTBALL_DATA=true`, so everything here reads
 * the frozen snapshot merged with `src/data/escalacoes.ts`.
 */
const MATCH = "554977";

test.describe("Escalações", () => {
  test("the section is closed on arrival and opens to two team sheets", async ({ page }) => {
    await page.goto(`/partida/${MATCH}`);

    const section = page.locator("details", { has: page.getByRole("heading", { name: "Escalações" }) });
    await expect(section).toBeVisible();

    // Closed by default: 46 names open would push the campanhas off the page,
    // which is the whole reason this is a `<details>`.
    await expect(section).not.toHaveAttribute("open", /.*/);

    // **Visibility, not existence.** A closed `<details>` keeps its children in
    // the DOM — it hides them — so `toHaveCount(0)` fails against a perfectly
    // correct page, which is how this assertion was first written and what the
    // first run of this spec caught.
    const sheets = page.locator("[data-lineup]");
    await expect(sheets).toHaveCount(2);
    await expect(sheets.first()).not.toBeVisible();

    await section.getByRole("heading", { name: "Escalações" }).click();
    await expect(section).toHaveAttribute("open", /.*/);
    await expect(sheets.first()).toBeVisible();
    await expect(sheets.nth(1)).toBeVisible();
  });

  test("each side lists exactly eleven starters, and this fixture names a goalkeeper", async ({
    page,
  }) => {
    await page.goto(`/partida/${MATCH}`);
    await page.getByRole("heading", { name: "Escalações" }).click();

    const sheets = page.locator("[data-lineup]");
    await expect(sheets).toHaveCount(2);

    for (const sheet of await sheets.all()) {
      // The first list is the eleven; the bench is its own list below it. The
      // count is the assertion that would catch the string-boolean bug end to
      // end — that failure yields zero starters and 23 reserves, and looks like
      // perfectly ordinary data all the way to the page.
      const starters = sheet.locator("ul").first().locator("li");
      await expect(starters).toHaveCount(11);
      await expect(sheet.locator("[data-bench] li").first()).toBeVisible();
      // **True of 554977, and NOT a property of a team sheet** — which is what
      // this test asserted, and what its own name claimed, until it was
      // measured: 4 of the season's 486 sides name no goalkeeper at all,
      // because CBF flagged the reserve and left the starter as `"false"`.
      // Scoped to the fixture on purpose; the general case is the test below.
      await expect(sheet.getByText("(GOL)").first()).toBeVisible();
    }
  });

  test("a sheet whose keeper CBF never flagged still renders, without a (GOL)", async ({
    page,
  }) => {
    /**
     * The state is **produced**, not hunted for. Which fixtures lack the flag is
     * exactly the "how much curated data exists" this file's header refuses to
     * depend on — it is 4 sides of 486 today and any re-sync moves it.
     *
     * Verified against the raw provider rather than inferred: probing
     * `/api/cbf/jogos/{id}` for all four, every atleta carries `goleiro` as the
     * string `"true"` or `"false"` and the single `"true"` sits on a player
     * whose `reserva` is `"true"`. So this is CBF's sheet, not our parse, and
     * `isTrue` is not what dropped it.
     *
     * Nothing may be inferred to fill it — `shirt 1` is a convention rather than
     * a law, and Bahia's r17/554901 carries no shirt 1 among its 23 at all. The
     * page's contract is therefore the one it already keeps everywhere else: an
     * absent value renders as nothing, never as a dash or a guess.
     */
    const response = await page.request.get("/api/matches");
    const body = await response.json();
    body.data.matches = body.data.matches.map((match: Record<string, unknown>) => ({
      ...match,
      lineups: Array.isArray(match.lineups)
        ? match.lineups.map((lineup: Record<string, unknown>) => ({
            ...lineup,
            players: (lineup.players as Record<string, unknown>[]).map(
              ({ keeper: _dropped, ...player }) => player,
            ),
          }))
        : match.lineups,
    }));
    await page.route("**/api/matches*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(body),
      }),
    );

    await page.goto(`/partida/${MATCH}`);
    await page.getByRole("heading", { name: "Escalações" }).click();

    const sheets = page.locator("[data-lineup]");
    await expect(sheets).toHaveCount(2);
    for (const sheet of await sheets.all()) {
      // The eleven are still eleven and still named: losing a boolean must not
      // cost a single row, which is the failure that would matter.
      await expect(sheet.locator("ul").first().locator("li")).toHaveCount(11);
      await expect(sheet.locator("[data-bench] li").first()).toBeVisible();
    }
    // …and nothing stands in for the mark that is not there.
    await expect(page.getByText("(GOL)")).toHaveCount(0);
    await expect(page.getByText("—", { exact: true })).toHaveCount(0);
  });

  test("substitutions print a minute, a name and who they replaced", async ({ page }) => {
    await page.goto(`/partida/${MATCH}`);
    await page.getByRole("heading", { name: "Escalações" }).click();

    const subs = page.locator("[data-subs] li");
    // Both sides made changes in this fixture; the count comes from CBF's own
    // `alteracoes`, which the sync refuses to write unless the súmula agrees.
    await expect(subs.first()).toBeVisible();

    // A minute, or the word for the one moment that has none. Asserted as a
    // pattern rather than a value: the label is CBF's reckoning and the fixture
    // is real data, so pinning "70'" would break on a re-sync of another match.
    await expect(subs.first()).toHaveText(/^(\d{1,3}(\+\d{1,2})?'|Intervalo)/);
    // "X por Y" — no arrow glyph, and the direction is in the words.
    await expect(subs.first()).toContainText(" por ");
  });

  test("a fixture with no synced sheet renders no section at all", async ({ page }) => {
    /**
     * The unsynced state is **produced**, not hunted for, and the first version
     * of this spec did the opposite twice over.
     *
     * It went to `/jogos?rodada=1` — which is not the route: `route-core.ts`
     * parses `/jogos/1`, so the query was ignored and the page showed the
     * *current* round. It then clicked whatever fixture happened to be first
     * and asserted no escalação, which held only while no current-round fixture
     * had one. A sync widening coverage from six matches to 34 gave it one, and
     * the spec went red for a reason that has nothing to do with what it tests.
     *
     * That is `goals.spec.ts`'s lesson one file over, which its own header
     * states: never depend on *which* record happens to lack a value, because
     * every sync moves it. Strip `lineups` from the payload and the branch is
     * reached rather than found.
     */
    const response = await page.request.get("/api/matches");
    const body = await response.json();
    body.data.matches = body.data.matches.map(
      ({ lineups: _lineups, ...match }: Record<string, unknown>) => match,
    );
    await page.route("**/api/matches*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(body),
      }),
    );

    await page.goto(`/partida/${MATCH}`);
    await expect(page.locator("main article")).toBeVisible();
    // Nothing renders — no heading, no empty panel, and no dash standing in for
    // a value nobody has.
    await expect(page.getByRole("heading", { name: "Escalações" })).toHaveCount(0);
    await expect(page.locator("[data-lineup]")).toHaveCount(0);
  });

  test("a word-length minute keeps its own column and never touches the name", async ({ page }) => {
    /**
     * `sumulaSubstitutionLabel` writes three shapes into one column — `70'`, a
     * stoppage-time `90+8'`, and **Intervalo**, which is a word rather than a
     * number. At a fixed `w-10` that word measured 50px in a 40px box and ate
     * the row's whole 8px gap: the page read `IntervaloMarcelinho por Gabriel
     * Girotto`, on 250 rows across 147 fixtures of the live payload.
     *
     * **Nothing existing could see it.** The label is not clipped — it paints
     * over the gap — so `truncate` never engages and a `scrollWidth >
     * clientWidth` check on the *row* passes; only the cell's own overflow and
     * the distance between the two cells say anything.
     *
     * Produced with a prepared payload rather than hunted for, which is the
     * rule the file header and `goals.spec.ts` both state: which fixture
     * carries an `Intervalo` moves on every `sync-goals`, and pinning one is
     * exactly how that spec's "minuteless fixture" broke.
     */
    const LABELS = ["7'", "Intervalo", "45+2'", "90+8'"];
    const response = await page.request.get("/api/matches");
    const body = await response.json();
    body.data.matches = body.data.matches.map((match: Record<string, unknown>) =>
      match.id === MATCH && Array.isArray(match.lineups)
        ? {
            ...match,
            lineups: match.lineups.map((lineup: Record<string, unknown>) => ({
              ...lineup,
              subs: LABELS.map((minute, index) => ({
                minute,
                on: (lineup.players as { name: string }[])[index].name,
                off: (lineup.players as { name: string }[])[index + 11].name,
              })),
            })),
          }
        : match,
    );
    await page.route("**/api/matches*", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) }),
    );

    await page.goto(`/partida/${MATCH}`);
    await page.getByRole("heading", { name: "Escalações" }).click();

    const list = page.locator("[data-subs]").first();
    await expect(list.locator("li")).toHaveCount(LABELS.length);

    const rows = await list.evaluate((ul) =>
      [...ul.querySelectorAll("li")].map((li) => {
        const [minute, name] = li.children;
        const m = minute.getBoundingClientRect();
        const n = name.getBoundingClientRect();
        return {
          label: (minute as HTMLElement).innerText.trim(),
          overflow: minute.scrollWidth - minute.clientWidth,
          gap: Math.round(n.left - m.right),
          nameLeft: Math.round(n.left),
        };
      }),
    );

    for (const row of rows) {
      // The label fits its own box. This is the assertion that fails against a
      // fixed width, whatever number is chosen, once a font renders the word
      // wider than it.
      expect(row.overflow, `"${row.label}" overflows its column`).toBe(0);
      // …and the gap the row asks for is the gap it gets, so the label cannot
      // reach the name even when it is the widest thing in the column.
      expect(row.gap, `"${row.label}" leaves no gap before the name`).toBeGreaterThanOrEqual(8);
    }

    // The names start on ONE edge. Sizing each row's label independently would
    // satisfy both assertions above and leave a ragged margin, which is the
    // failure the shared column exists to prevent.
    expect(new Set(rows.map((row) => row.nameLeft)).size).toBe(1);
  });

  test("two players of one name are told apart by their shirts, and nobody else is", async ({
    page,
  }) => {
    /**
     * `Substitution` prints names, which identify a player right up until the
     * elenco holds two of them — and five in this division do. Athletico-PR's
     * r19/554928 read **"Gilberto por Gilberto"** at 82', a true fact about
     * camisa 12 leaving for camisa 2 that renders as a bug.
     *
     * **Produced, never hunted for.** Which fixtures carry namesakes is exactly
     * the "how much curated data exists" this file's header refuses to depend
     * on: it is 9 rows of 2328 today and every `sync-goals` moves it. Two of
     * this sheet's own players are renamed to one made-up name instead, so the
     * spec depends on no real name and on no club's squad.
     *
     * The shirts are **stripped** as well, so what is exercised is
     * `subShirtLabels`' narrowing — the branch that carries every fixture
     * committed before `Substitution.onShirt` existed. A resync would fill that
     * field in and silently retire this assertion otherwise.
     */
    const response = await page.request.get("/api/matches");
    const body = await response.json();

    let onShirt = "";
    let offShirt = "";
    for (const match of body.data.matches) {
      if (match.id !== MATCH) continue;
      for (const lineup of match.lineups ?? []) {
        if (!lineup.subs?.length || onShirt) continue;
        const [first] = lineup.subs;
        const entering = lineup.players.find((p: { name: string }) => p.name === first.on);
        const leaving = lineup.players.find((p: { name: string }) => p.name === first.off);
        if (!entering || !leaving) continue;
        onShirt = entering.shirt;
        offShirt = leaving.shirt;
        entering.name = "Homônimo";
        leaving.name = "Homônimo";
        lineup.subs = [{ on: "Homônimo", off: "Homônimo", minute: first.minute }];
      }
    }
    expect(onShirt, "the fixture should carry a substitution to rewrite").not.toBe("");

    await page.route("**/api/matches*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(body),
      }),
    );

    await page.goto(`/partida/${MATCH}`);
    await page.getByRole("heading", { name: "Escalações" }).click();

    // Both numbers, and in the order the row is said: who came on, then who
    // came off. Without them the row reads "Homônimo por Homônimo".
    const row = page.locator("[data-subs] li", { hasText: "Homônimo" }).first();
    await expect(row).toBeVisible();
    await expect(row).toHaveText(new RegExp(`${onShirt}\\s+Homônimo por ${offShirt}\\s+Homônimo`));

    // …and the other side's rows, whose names identify perfectly well, carry no
    // number at all. A shirt on all 2328 rows would cost the minute column the
    // room `Intervalo` needs and tell a reader nothing the sheet above has not.
    const others = page.locator("[data-subs] li").filter({ hasNotText: "Homônimo" });
    for (const other of await others.all()) {
      await expect(other).not.toHaveText(/^(\d{1,3}(\+\d{1,2})?'|Intervalo)\s*\d+\s/);
    }
  });

});
