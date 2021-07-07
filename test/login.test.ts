import { test, expect } from "@playwright/test";

test("login flow", async ({ page }) => {
  await page.goto("http://localhost:5000/test/");

  await page.click("text=Login");

  await page.fill('input[name="login"]', "username");
  await page.fill('input[name="password"]', "password");
  await page.click("button[type=submit]");

  // expect(page.url()).toBe("http://localhost:5000/test/");
});
