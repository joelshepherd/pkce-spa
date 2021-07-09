import { test, expect } from "@playwright/test";
import { login, waitToResolve } from "./utils";

test("login flow", async ({ page }) => {
  await page.goto("http://localhost:5000/");

  await login(page);

  const returnUrl = page.url();
  expect(returnUrl).toContain("http://localhost:5000/");
  expect(returnUrl).not.toContain("error");

  // Wait for access token to resolve
  await waitToResolve(page);

  const accessToken = await page.textContent("span#access-token");
  expect(accessToken).not.toBe("[pending]");
  expect(accessToken).not.toBe("[none]");
});
