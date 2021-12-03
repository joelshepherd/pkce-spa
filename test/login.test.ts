import { expect, test } from "@playwright/test";
import { clientUrl, login, waitToResolve } from "./utils";

test("login flow", async ({ page }) => {
  await page.goto(clientUrl);

  await login(page);

  const returnUrl = page.url();
  expect(returnUrl).toContain(clientUrl);
  expect(returnUrl).not.toContain("error");

  // Wait for access token to resolve
  await waitToResolve(page);

  const accessToken = await page.textContent("span#access-token");
  expect(accessToken).not.toBe("[pending]");
  expect(accessToken).not.toBe("[none]");
});
