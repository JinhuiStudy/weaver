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

test("home header shows 로그인 link when anonymous", async ({ page }) => {
  await page.goto("/");
  const loginLink = page.getByTestId("home-login-link");
  await expect(loginLink).toBeVisible();
  await expect(loginLink).toHaveAttribute("href", "/login");
  await page.screenshot({ path: "tests/screenshots/12-home-anon-header.png" });
});
