import { test, expect } from "@playwright/test";
import { login, waitToResolve } from "./utils";

const testUrl = "http://localhost:5000/";

test("refresh flow with multiple tabs", async ({ page, context }) => {
  await page.goto(testUrl);

  await login(page);

  const returnUrl = page.url();
  expect(returnUrl).toContain(testUrl);
  expect(returnUrl).not.toContain("error");

  // Wait for access token to resolve
  await waitToResolve(page);

  const firstToken = await page.textContent("span#access-token");

  // Open many other pages
  new Array(100).fill(null).map(async () => {
    const page = await context.newPage();
    await page.goto(testUrl);
  });

  await page.waitForTimeout(12_000);

  // Check we have a new access token and are still logged in
  const secondToken = await page.textContent("span#access-token");
  expect(secondToken).not.toBe("[pending]");
  expect(secondToken).not.toBe("[none]");
  expect(secondToken).not.toBe(firstToken);

  await page.waitForTimeout(12_000);

  // Check we have a new access token and are still logged in
  const thirdToken = await page.textContent("span#access-token");
  expect(thirdToken).not.toBe("[pending]");
  expect(thirdToken).not.toBe("[none]");
  expect(thirdToken).not.toBe(firstToken);
  expect(thirdToken).not.toBe(secondToken);
});
