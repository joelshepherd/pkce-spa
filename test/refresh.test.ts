import { test, expect } from "@playwright/test";
import { login, waitToResolve } from "./utils";

const testUrl = "http://localhost:5000/";

test("refresh flow", async ({ page }) => {
  await page.goto(testUrl);

  await login(page);

  const returnUrl = page.url();
  expect(returnUrl).toContain(testUrl);
  expect(returnUrl).not.toContain("error");

  // Wait for access token to resolve
  await waitToResolve(page);

  const firstToken = await page.textContent("span#access-token");
  expect(firstToken).not.toBe("[pending]");
  expect(firstToken).not.toBe("[none]");

  // Wait for refresh
  await page.waitForTimeout(12_000);

  // Check we have a new access token
  const secondToken = await page.textContent("span#access-token");
  expect(secondToken).not.toBe("[pending]");
  expect(secondToken).not.toBe("[none]");
  expect(secondToken).not.toBe(firstToken);
});
