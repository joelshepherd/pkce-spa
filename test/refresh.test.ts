import { expect, test } from "@playwright/test";
import { clientUrl, login, waitToResolve } from "./utils";

test("refresh flow", async ({ page }) => {
  await page.goto(clientUrl);

  await login(page);

  // Wait for access token to resolve
  await waitToResolve(page);

  const firstToken = await page.textContent("span#access-token");
  expect(firstToken).not.toBe("[pending]");
  expect(firstToken).not.toBe("[none]");

  // Wait for refresh
  await page.waitForTimeout(6_000);

  // Check we have a new access token
  const secondToken = await page.textContent("span#access-token");
  expect(secondToken).not.toBe("[pending]");
  expect(secondToken).not.toBe("[none]");
  expect(secondToken).not.toBe(firstToken);
});
