import { test, expect } from "@playwright/test";
import { login, waitToResolve } from "./utils";

const testUrl = "http://localhost:5000/";

test("refresh flow with multiple tabs", async ({
  browserName,
  context,
  page,
}) => {
  // Skip webkit for advanced concurrency test
  // test.skip(
  //   browserName === "webkit",
  //   "Cannot guarantee thread safety in webkit without broadcast channel"
  // );
  test.slow();

  await page.goto(testUrl);

  await login(page);

  const returnUrl = page.url();
  expect(returnUrl).toContain(testUrl);
  expect(returnUrl).not.toContain("error");

  // Wait for access token to resolve
  await waitToResolve(page);

  let previousToken = await page.textContent("span#access-token");

  // Open many other pages
  new Array(25).fill(null).forEach(async () => {
    const page = await context.newPage();
    await page.goto(testUrl);
  });

  // Test 10 successful rotations
  for (let i = 0; i < 10; i++) {
    // Wait for a rotation response from any tab
    await context.waitForEvent(
      "response",
      (res) => res.url() === "http://localhost:5001/token"
    );
    await page.waitForTimeout(1000);

    // Check we have a new access token and are still logged in
    const nextToken = await page.textContent("span#access-token");
    expect(nextToken).not.toBe("[pending]");
    expect(nextToken).not.toBe("[none]");
    expect(nextToken).not.toBe(previousToken);
    previousToken = nextToken;
  }
});
