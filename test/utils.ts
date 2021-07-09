import { Page } from "@playwright/test";

/** Login to the provider */
export async function login(page: Page): Promise<void> {
  await page.click("text=Login");

  // credentials
  await page.fill('input[name="login"]', "username");
  await page.fill('input[name="password"]', "password");
  await page.click("button[type=submit]");

  // consent
  await page.click("button[type=submit]");

  // wait for the code exchange
  await page.waitForRequest("http://localhost:5001/token");
}

/** Wait for the access token to resolve */
export async function waitToResolve(page: Page): Promise<void> {
  await page.waitForSelector("span#access-token:not(:empty)");
}
