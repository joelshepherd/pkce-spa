import { expect, test } from "@playwright/test";
import { clientUrl, login, providerUrl, waitToResolve } from "./utils";

test("refresh flow with multiple tabs", async ({
  context,
  page,
  browserName,
}) => {
  // This test is slow!
  test.slow();

  // Thanks Safari's storage rewrite!
  test.fixme(
    browserName === "webkit",
    "Safari does not support `BroadcastChannel` and the fallback storage" +
      "implementation cannot handle this many tabs"
  );

  await page.goto(clientUrl);

  await login(page);

  const returnUrl = page.url();
  expect(returnUrl).toContain(clientUrl);
  expect(returnUrl).not.toContain("error");

  // Wait for access token to resolve
  await waitToResolve(page);

  let previousToken = await page.textContent("span#access-token");

  // Open many other tabs
  new Array(25).fill(null).forEach(async () => {
    const page = await context.newPage();
    await page.goto(clientUrl);
  });

  // Test 10 successful rotations
  for (let i = 0; i < 10; i++) {
    // Wait for a rotation response from any tab
    await context.waitForEvent("response", {
      predicate: (res) => res.url() === `${providerUrl}token`,
      timeout: 30_000,
    });
    await page.waitForTimeout(2_000);

    // Check we have a new access token and are still logged in
    const nextToken = await page.textContent("span#access-token");
    expect(nextToken).not.toBe("[pending]");
    expect(nextToken).not.toBe("[none]");
    expect(nextToken).not.toBe(previousToken);
    previousToken = nextToken;
  }
});
