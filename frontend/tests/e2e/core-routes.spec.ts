import { expect, test } from "@playwright/test";

const protectedRoutes = [
  "/dashboard",
  "/assets",
  "/investors",
  "/transfers",
  "/disclosures",
  "/audit",
  "/compliance/passports",
  "/settings",
] as const;

test("login page loads", async ({ page }) => {
  const response = await page.goto("/login", { waitUntil: "domcontentloaded" });
  expect(response?.ok()).toBeTruthy();
  await expect(page.getByRole("heading", { level: 1, name: "Connect to the organization console." })).toBeVisible();
  await expect(page.getByRole("button", { name: "Connect wallet" })).toBeVisible();
});

for (const path of protectedRoutes) {
  test(`protected route redirects to login: ${path}`, async ({ page }) => {
    await page.goto(path, { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(new RegExp(`/login\\?next=${encodeURIComponent(path).replace(/\//g, "%2F")}$`));
    await expect(page.getByRole("heading", { level: 1, name: "Connect to the organization console." })).toBeVisible();
  });
}
