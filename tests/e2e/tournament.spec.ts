import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("production-like command center is keyboard navigable and has no serious accessibility violations", async ({ page }) => {
  await page.goto("/");

  const skip = page.getByRole("link", { name: "Skip to tournament data" });
  await expect(skip).toBeAttached();
  for (let step = 0; step < 3 && !(await skip.evaluate((node) => node === document.activeElement)); step++) {
    await page.keyboard.press("Tab");
  }
  await expect(skip).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#main-content")).toBeFocused();

  await expect(page.getByRole("navigation", { name: "Tournament sections" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Schedule" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Swiss standings" })).toBeVisible();

  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  const blocking = results.violations.filter((violation) =>
    violation.impact === "serious" || violation.impact === "critical",
  );
  expect(blocking, blocking.map((item) => `${item.id}: ${item.help}`).join("\n")).toEqual([]);
});

test("all published series are discoverable, filterable, and deep-linkable", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "All", exact: true }).click();

  const total = await page.locator("article.series-card").count();
  expect(total).toBeGreaterThanOrEqual(39);
  const first = page.locator("#schedule article.series-card").first();
  const id = await first.getAttribute("id");
  // Schedule owns `series-<id>` until a match is final; a completed row shown
  // here takes the `schedule-` namespace so Results keeps the canonical anchor.
  expect(id).toMatch(/^(series|schedule)-/);
  await page.goto(`/#${id}`);
  await expect(page.locator(`#${id}`)).toBeAttached();

  await page.locator("#schedule").getByRole("combobox", { name: "Team" }).selectOption({ index: 1 });
  await expect(page.locator("#schedule article.series-card").first()).toBeVisible();
  expect(await page.locator("#schedule article.series-card").count()).toBeLessThan(total);
});

test("API failure and offline recovery retain the last valid tournament payload", async ({ page, context }) => {
  await page.route("**/api/state", (route) => route.abort("failed"));
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "The International 2026" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Schedule" })).toBeVisible();

  await context.setOffline(true);
  await context.setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(page.getByRole("heading", { name: "Swiss standings" })).toBeVisible();
  await expect(page.locator("body")).not.toContainText("undefined");
});

test("required viewports have usable navigation and no page-level horizontal overflow", async ({ page }) => {
  for (const width of [320, 390, 768, 1024, 1280, 1440]) {
    await page.setViewportSize({ width, height: width <= 390 ? 844 : 900 });
    await page.goto("/");

    await expect(page.getByRole("link", { name: "Live", exact: true })).toBeVisible();
    // The bracket is readable at every width — paged below 1024px, whole above.
    await expect(page.locator("#bracket article.bracket-card").first()).toBeVisible();

    const overflow = await page.evaluate(() => ({
      document: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      body: document.body.scrollWidth - document.body.clientWidth,
    }));
    expect(overflow.document).toBeLessThanOrEqual(1);
    expect(overflow.body).toBeLessThanOrEqual(1);
  }
});

test("the desktop bracket board shows every lane and stage without duplicate DOM ids", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");

  const bracket = page.locator("#bracket");
  for (const lane of ["Upper Bracket", "Lower Bracket", "Grand Final"]) {
    await expect(bracket.getByRole("heading", { name: lane, exact: true })).toBeVisible();
  }
  await expect(bracket.locator("article.bracket-card")).toHaveCount(14);
  // The stage navigator belongs to the small layout only.
  await expect(bracket.getByRole("group", { name: "Bracket stage" })).toBeHidden();

  // The same series is published in Bracket, Schedule, Elimination and Results.
  // Expand every disclosure and show every row, then require that the whole
  // document still has unique ids.
  await page.locator("#schedule").getByRole("button", { name: "All", exact: true }).click();
  await page.locator("#results details.game-details").first().click();
  await page.locator("#elimination details.game-details").first().click();

  const duplicates = await page.evaluate(() => {
    const seen = new Map<string, number>();
    for (const node of document.querySelectorAll("[id]")) {
      seen.set(node.id, (seen.get(node.id) ?? 0) + 1);
    }
    return [...seen].filter(([, count]) => count > 1).map(([id]) => id);
  });
  expect(duplicates).toEqual([]);

  await expect(bracket.getByText("Winner of Upper QF 1").first()).toBeVisible();
  await expect(bracket.getByText("Loser of Upper SF 2").first()).toBeVisible();
  await expect(bracket.getByText("Bo5").first()).toBeVisible();
});

test("the mobile bracket pages through stages by keyboard, one stage at a time", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  const bracket = page.locator("#bracket");
  await expect(bracket.getByRole("group", { name: "Bracket stage" })).toBeVisible();
  await expect(bracket.locator(".bracket-stage[data-active]")).toHaveCount(1);
  await expect(bracket.locator("article.bracket-card:visible")).toHaveCount(4);

  const next = bracket.getByRole("button", { name: /Next stage/ });
  await next.focus();
  await expect(next).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(bracket.getByRole("button", { name: "Lower R1", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(bracket.locator("article.bracket-card:visible")).toHaveCount(2);

  // 44px minimum targets on every control the navigator exposes.
  for (const control of await bracket.locator(".bracket-nav button").all()) {
    const box = await control.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
  }

  const results = await new AxeBuilder({ page })
    .include("#bracket")
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  const blocking = results.violations.filter(
    (violation) => violation.impact === "serious" || violation.impact === "critical",
  );
  expect(blocking, blocking.map((item) => `${item.id}: ${item.help}`).join("\n")).toEqual([]);
});

test("a bracket deep link opens the stage that contains it on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/#bracket-main-grand-final");

  const bracket = page.locator("#bracket");
  await expect(bracket.getByRole("button", { name: "Grand Final", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.locator("#bracket-main-grand-final")).toBeVisible();

  // The linear list is the keyboard/screen-reader route through the same graph.
  await bracket.getByText("Accessible linear bracket list").click();
  const linear = bracket.locator(".bracket-linear li");
  await expect(linear).toHaveCount(14);
  await expect(bracket.locator(".bracket-linear")).toContainText("Winner advances to Upper SF 1");

  await bracket.getByRole("link", { name: "Upper QF 1", exact: true }).click();
  await expect(bracket.getByRole("button", { name: "Upper QF", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.locator("#bracket-main-ub-qf1")).toBeVisible();
});

test("reduced-motion preference disables decorative animation and transitions", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  expect(await page.evaluate(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches)).toBe(true);

  const style = await page.locator(".anchor-nav a").first().evaluate((node) => {
    const computed = getComputedStyle(node);
    return { animationDuration: computed.animationDuration, transitionDuration: computed.transitionDuration };
  });
  expect(style.animationDuration).toMatch(/0\.01ms|1e-05s|0s/);
  expect(style.transitionDuration).toMatch(/0\.01ms|1e-05s|0s/);
});
