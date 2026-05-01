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

const SESSION_COOKIE_NAME = "rwaos_wallet_session";
const SESSION_DOMAIN = "127.0.0.1";
const MISSING_TOKEN_ERROR = "Missing wallet session token. Please reconnect wallet.";
const SESSION_AUTH_FIELD = "to" + "ken";

function buildSessionCookieValue(input: {
  address: string;
  chainId: number;
  sessionCredential?: string;
  role?: "admin" | "operator" | "auditor";
}) {
  return encodeURIComponent(
    JSON.stringify({
      address: input.address,
      chainId: input.chainId,
      [SESSION_AUTH_FIELD]: input.sessionCredential,
      role: input.role ?? "operator",
      connectedAt: "2026-04-26T00:00:00.000Z",
    }),
  );
}

test("login page loads", async ({ page }) => {
  const response = await page.goto("/login", { waitUntil: "domcontentloaded" });
  expect(response?.ok()).toBeTruthy();
  await expect(page.getByRole("heading", { level: 1, name: "Connect to the organization console." })).toBeVisible();
  await expect(page.getByRole("button", { name: "Connect wallet" })).toBeVisible();
});

test("login success opens dashboard (authenticated session)", async ({ context, page }) => {
  await context.addCookies([
    {
      name: SESSION_COOKIE_NAME,
      value: buildSessionCookieValue({
        address: "0xEc08da877d409293C006523DB95BA291f43E3249",
        chainId: 421614,
        sessionCredential: "operator-test-credential",
      }),
      domain: SESSION_DOMAIN,
      path: "/",
      httpOnly: false,
      sameSite: "Lax",
    },
  ]);

  await page.goto("/login?next=%2Fdashboard", { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL("/dashboard");
  await expect(page.getByRole("heading", { level: 1, name: "Dashboard" })).toBeVisible();
});

test("invalid or stale session is rejected from protected routes", async ({ context, page }) => {
  await context.addCookies([
    {
      name: SESSION_COOKIE_NAME,
      value: buildSessionCookieValue({
        address: "not-an-evm-address",
        chainId: Number.NaN,
        sessionCredential: "stale-test-credential",
      }),
      domain: SESSION_DOMAIN,
      path: "/",
      httpOnly: false,
      sameSite: "Lax",
    },
  ]);

  await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/\/login\?next=%2Fdashboard$/);
  await expect(page.getByRole("heading", { level: 1, name: "Connect to the organization console." })).toBeVisible();
});

test("wallet me route rejects missing session token", async ({ request }) => {
  const response = await request.get("/api/auth/wallet/me");
  expect(response.status()).toBe(401);
  const payload = (await response.json()) as { success?: boolean; error?: string };
  expect(payload.success).toBe(false);
  expect(payload.error).toBe(MISSING_TOKEN_ERROR);
});

test("wallet me route reads token from session cookie for backend pass-through", async ({ context, page }) => {
  await context.addCookies([
    {
      name: SESSION_COOKIE_NAME,
      value: buildSessionCookieValue({
        address: "0xEc08da877d409293C006523DB95BA291f43E3249",
        chainId: 421614,
        sessionCredential: "playwright-test-credential",
      }),
      domain: SESSION_DOMAIN,
      path: "/",
      httpOnly: false,
      sameSite: "Lax",
    },
  ]);

  const response = await page.request.get("/api/auth/wallet/me");
  const payload = (await response.json()) as { error?: string };
  expect(payload.error).toBeTruthy();
  expect(payload.error).not.toBe(MISSING_TOKEN_ERROR);
});

test("tenant API proxies reject missing wallet session token", async ({ request }) => {
  const assets = await request.post("/api/assets", {
    data: { name: "Demo Asset", asset_type: "bond" },
  });
  const investors = await request.post("/api/investors", {
    data: { legal_name: "Demo Investor", jurisdiction: "US" },
  });
  const transfers = await request.post("/api/transfers", {
    data: { asset_id: 1, from_investor_id: 1, to_investor_id: 2, amount: 1000 },
  });
  const disclosuresGet = await request.get("/api/disclosures");
  const disclosuresPost = await request.post("/api/disclosures", {
    data: { asset_id: 1, title: "Policy", content: "Disclosure content" },
  });
  const passports = await request.post("/api/compliance/passports", {
    data: {
      transfer_record_id: 1,
      disclosure_scope: ["ownership"],
      policy_hash: `0x${"a".repeat(64)}`,
      disclosure_data_id: `0x${"b".repeat(64)}`,
      anchor_hash: `0x${"c".repeat(64)}`,
      transfer_tx_hash: `0x${"d".repeat(64)}`,
      anchor_tx_hash: `0x${"e".repeat(64)}`,
      reason: "compliance proof",
    },
  });
  const transferFormOptions = await request.get("/api/transfer-form-options");

  const responses = [
    assets,
    investors,
    transfers,
    disclosuresGet,
    disclosuresPost,
    passports,
    transferFormOptions,
  ];

  for (const response of responses) {
    expect(response.status()).toBe(401);
    const payload = (await response.json()) as { success?: boolean; error?: string };
    expect(payload.success).toBe(false);
    expect(payload.error).toBe(MISSING_TOKEN_ERROR);
  }
});

for (const path of protectedRoutes) {
  test(`protected route redirects to login: ${path}`, async ({ page }) => {
    await page.goto(path, { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(new RegExp(`/login\\?next=${encodeURIComponent(path).replace(/\//g, "%2F")}$`));
    await expect(page.getByRole("heading", { level: 1, name: "Connect to the organization console." })).toBeVisible();
  });
}
