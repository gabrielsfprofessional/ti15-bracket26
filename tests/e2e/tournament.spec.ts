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
  expect(id).toMatch(/^series-/);
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
    const overflow = await page.evaluate(() => ({
      document: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      body: document.body.scrollWidth - document.body.clientWidth,
    }));
    expect(overflow.document).toBeLessThanOrEqual(1);
    expect(overflow.body).toBeLessThanOrEqual(1);
  }
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
