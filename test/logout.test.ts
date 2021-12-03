import { expect, test } from "@playwright/test";
import { clientUrl, login, waitToResolve } from "./utils";

test("logout flow", async ({ page, context }) => {
  await page.goto(clientUrl);

  await login(page);

  expect(page.textContent("span#access-token")).not.toBe("[none]");

  await page.click("text=Logout");
  await page.click("[name=logout]");

  const url = page.url();
  expect(url).toBe(clientUrl);

  // Wait for access token to resolve
  await waitToResolve(page);

  const accessToken = await page.textContent("span#access-token");
  expect(accessToken).toBe("[none]");

  const storageState = await context.storageState();
  expect(storageState.origins.length).toBe(0);
});
