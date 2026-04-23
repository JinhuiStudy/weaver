import { expect, test } from "@playwright/test";

test("login page — hero + Sign in with GitHub", async ({ page }) => {
  await page.goto("/login");
  await expect(page).toHaveTitle(/Weaver · Sign in/);

  const signin = page.getByTestId("github-signin");
  await expect(signin).toBeVisible();
  await expect(signin).toContainText(/Sign in with GitHub/i);
  await expect(signin).toHaveAttribute("href", "/auth/github");

  await page.screenshot({ path: "tests/screenshots/10-login.png", fullPage: false });
});

test("home (dev session) — header shows user badge + 내 Agents section", async ({ page }) => {
  // In local dev the server loader returns a fake session when the runtime
  // isn't reachable (keyed on RUNTIME_URL=localhost). So the anon state is
  // never visible in Playwright — instead we verify the signed-in chrome.
  await page.goto("/");
  await expect(page.getByTestId("user-badge")).toBeVisible();
  await expect(page.getByTestId("my-agents-section")).toBeVisible();
  await page.screenshot({ path: "tests/screenshots/12-home-devsession.png" });
});
