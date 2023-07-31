import { Page } from "@playwright/test";

export const clientUrl = "http://localhost:8080/";
export const providerUrl = "http://localhost:8081/";
export const tokenUrl = `${providerUrl}token`;

/** Wait without a page */
export function delay(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}

/** Login to the provider */
export async function login(page: Page): Promise<void> {
  await page.click("text=Login");
  await page.waitForURL(`${providerUrl}**`);

  // credentials
  await page.fill('input[name="login"]', "username");
  await page.fill('input[name="password"]', "password");
  await page.click("button[type=submit]");

  // consent
  await page.click("button[type=submit]");

  // wait for the code exchange
  await page.waitForRequest(`${providerUrl}token`);
}

/** Wait for the access token to resolve */
export async function waitToResolve(page: Page): Promise<void> {
  await page.waitForSelector("span#access-token:not(:empty)");
}
