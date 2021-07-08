import { test, expect } from "@playwright/test";

test("login flow", async ({ page }) => {
  await page.goto("http://localhost:5000/");

  await page.click("text=Login");

  // credentials
  await page.fill('input[name="login"]', "username");
  await page.fill('input[name="password"]', "password");
  await page.click("button[type=submit]");

  // consent
  await page.click("button[type=submit]");

  // tests
  const returnUrl = page.url();
  expect(returnUrl).toContain("http://localhost:5000/");
  expect(returnUrl).not.toContain("error");

  await page.waitForRequest("http://localhost:5001/token");

  const accessToken = await page.textContent("span#access-token");
  expect(accessToken).not.toBe("[pending]");
  expect(accessToken).not.toBe("[none]");
});
