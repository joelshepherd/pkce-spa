import { expect, test } from "@playwright/test";
import { clientUrl, delay, login, tokenUrl, waitToResolve } from "./utils";

test("refresh lock stuck", async ({ context, page }) => {
  // This test is slow!
  test.slow();

  await page.goto(clientUrl);

  await login(page);

  // Wait for access token to resolve
  await waitToResolve(page);

  const firstToken = await page.textContent("span#access-token");
  expect(firstToken).not.toBe("[pending]");
  expect(firstToken).not.toBe("[none]");

  // Wait for refresh to begin and the lock to be acquired
  // And close the browser before it returns
  page.route(tokenUrl, () => {
    // Hang the request
  });
  await page.waitForRequest(tokenUrl);
  await page.close();

  // Let the token expire
  await delay(31_000);

  // Open a new page
  const newPage = await context.newPage();
  await newPage.goto(clientUrl);

  // Check we have been logged out
  await waitToResolve(newPage);
  const secondToken = await newPage.textContent("span#access-token");
  expect(secondToken).toBe("[none]");
});

test("refresh lock on multiple tabs restored", async ({ context, page }) => {
  // This test is slow!
  test.slow();

  await page.goto(clientUrl);

  await login(page);

  // Wait for access token to resolve
  await waitToResolve(page);

  // Close the page and wait for the token to expire
  await page.close();
  await delay(36_000);

  // Open multiple tabs
  const [newPage] = await Promise.all(
    new Array(5).fill(null).map(async () => {
      const page = await context.newPage();
      await page.goto(clientUrl);
      return page;
    }),
  );

  // Wait for exchange safety timeout to fire
  await newPage.waitForTimeout(6_000);

  await waitToResolve(newPage);

  // Check the refresh was successful and the safety timeout was not fired
  const accessToken = await newPage.textContent("span#access-token");
  expect(accessToken).not.toBe("[pending]");
  expect(accessToken).not.toBe("[none]");
});
