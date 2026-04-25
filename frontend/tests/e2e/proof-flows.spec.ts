import { expect, test } from "@playwright/test";

import {
  connectSessionWallet,
  fillValidDisclosureForm,
  fillValidPassportForm,
  fillValidTransferForm,
  installMockWallet,
  mockTransferFormOptions,
  seedWalletSession,
} from "./helpers/proof-helpers";

test.describe("E2E proof flows", () => {
  test.beforeEach(async ({ context, page }) => {
    await seedWalletSession(context);
    await installMockWallet(page);
    await mockTransferFormOptions(page);
  });

  test("transfer new validates form state, shows errors, and submits expected payload", async ({ page }) => {
    let transferPayload: Record<string, unknown> | null = null;

    await page.route("**/api/transfers", async (route) => {
      transferPayload = route.request().postDataJSON() as Record<string, unknown>;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            id: 19,
            asset_id: 1,
            from_investor_id: 1,
            to_investor_id: 2,
            amount: 1250,
            tx_hash: `0x${"0".repeat(63)}1`,
          },
        }),
      });
    });

    await page.goto("/transfers/new", { waitUntil: "domcontentloaded" });
    const submitButton = page.getByRole("button", { name: "Initiate confidential transfer" });

    await expect(submitButton).toBeDisabled();
    await expect(page.getByText("Wallet not connected. Connect wallet before transfer.")).toBeVisible();

    await page.getByLabel("Recipient wallet address").fill("0x123");
    await expect(page.getByText("Recipient wallet address is not valid.")).toBeVisible();

    await connectSessionWallet(page);
    await fillValidTransferForm(page);

    await expect(submitButton).toBeEnabled();
    await submitButton.click();
    await page.waitForURL("**/transfers");

    expect(transferPayload).toEqual({
      asset_id: 1,
      from_investor_id: 1,
      to_investor_id: 2,
      amount: 1250,
      tx_hash: `0x${"0".repeat(63)}1`,
    });
  });

  test("disclosures new blocks invalid submit, surfaces API errors, and posts expected payload", async ({ page }) => {
    let disclosurePayload: Record<string, unknown> | null = null;
    let requestCount = 0;

    await page.route("**/api/disclosures", async (route) => {
      disclosurePayload = route.request().postDataJSON() as Record<string, unknown>;
      requestCount += 1;
      const firstRequest = requestCount === 1;
      await route.fulfill({
        status: firstRequest ? 500 : 200,
        contentType: "application/json",
        body: JSON.stringify(
          firstRequest
            ? { success: false, error: "Backend disclosure write failed." }
            : { success: true },
        ),
      });
    });

    await page.goto("/disclosures/new", { waitUntil: "domcontentloaded" });

    await page.getByRole("button", { name: "Create disclosure" }).click();
    await expect(page.getByText("Asset, title, and content are required.")).toBeVisible();

    await connectSessionWallet(page);
    await fillValidDisclosureForm(page);

    const submitButton = page.getByRole("button", { name: "Create disclosure" });
    await submitButton.click();
    await expect(page.getByText(/Backend disclosure write failed\./)).toBeVisible();
    expect(disclosurePayload).toEqual({
      asset_id: 1,
      title: "Quarterly regulator packet",
      content: "Contains investor-level proof bundle for Q2 review.",
    });

    await submitButton.click();
    await page.waitForURL("**/disclosures");
  });

  test("compliance passports new validates required fields, shows backend error, and posts expected payload", async ({ page }) => {
    let passportPayload: Record<string, unknown> | null = null;
    let requestCount = 0;

    await page.route("**/api/compliance/passports", async (route) => {
      passportPayload = route.request().postDataJSON() as Record<string, unknown>;
      requestCount += 1;
      const firstRequest = requestCount === 1;
      await route.fulfill({
        status: firstRequest ? 500 : 200,
        contentType: "application/json",
        body: JSON.stringify(
          firstRequest
            ? { success: false, error: "Compliance passport persistence failed." }
            : { success: true },
        ),
      });
    });

    await page.goto("/compliance/passports/new", { waitUntil: "domcontentloaded" });

    await page.getByRole("button", { name: "Issue passport" }).click();
    await expect(page.getByText("Transfer ID must be a positive integer.")).toBeVisible();

    await connectSessionWallet(page);
    await fillValidPassportForm(page);

    const submitButton = page.getByRole("button", { name: "Issue passport" });
    await submitButton.click();
    await expect(page.getByText(/Compliance passport persistence failed\./)).toBeVisible();
    expect(passportPayload).toEqual({
      transfer_id: 5,
      disclosure_scope: ["auditor", "regulator", "counterparty"],
      policy_hash: `0x${"4".repeat(64)}`,
      disclosure_data_id: `0x${"5".repeat(64)}`,
      anchor_hash: `0x${"6".repeat(64)}`,
      transfer_tx_hash: `0x${"0".repeat(63)}2`,
      anchor_tx_hash: `0x${"0".repeat(63)}1`,
      reason: "Routine compliance issuance",
    });

    await submitButton.click();
    await page.waitForURL("**/compliance/passports");
  });
});
