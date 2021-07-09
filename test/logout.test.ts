import { test, expect } from "@playwright/test";
import { login } from "./login";

test("logout flow", async ({ page, context }) => {
  await page.goto("http://localhost:5000/");

  await login(page);

  expect(page.textContent("span#access-token")).not.toBe("[none]");

  await page.click("text=Logout");
  await page.click("[name=logout]");

  const url = page.url();
  expect(url).toBe("http://localhost:5000/");

  const accessToken = await page.textContent("span#access-token");
  expect(accessToken).toBe("[none]");

  const storageState = await context.storageState();
  expect(storageState.origins.length).toBe(0);
});
