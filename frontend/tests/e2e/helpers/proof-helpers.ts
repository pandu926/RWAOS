import { expect, type BrowserContext, type Page } from "@playwright/test";

const TEST_WALLET_ADDRESS = "0x1111111111111111111111111111111111111111";
const TARGET_CHAIN_ID = 421614;
const TARGET_CHAIN_HEX = "0x66eee";
const SESSION_COOKIE_NAME = "rwaos_wallet_session";
const FAKE_SIGNATURE = "0x" + "a".repeat(130);
const SESSION_AUTH_FIELD = "token";
const SESSION_AUTH_VALUE = process.env.PLAYWRIGHT_SESSION_TOKEN ?? "playwright-session";
const TRANSFER_OPTIONS = {
  success: true,
  data: {
    assets: [
      { id: 1, name: "Atlas Income Note" },
      { id: 2, name: "Harbor Credit Fund" },
    ],
    investors: [
      { id: 1, name: "Alpha Treasury" },
      { id: 2, name: "Bravo Capital" },
      { id: 3, name: "Cedar Markets" },
    ],
  },
} as const;

type MockListener = (...args: unknown[]) => void;
type Eip1193RequestArgs = {
  method: string;
  params?: unknown[];
};

function buildWalletSessionValue() {
  return encodeURIComponent(
    JSON.stringify({
      address: TEST_WALLET_ADDRESS,
      chainId: TARGET_CHAIN_ID,
      role: "operator",
      [SESSION_AUTH_FIELD]: SESSION_AUTH_VALUE,
      connectedAt: "2026-04-24T00:00:00.000Z",
    }),
  );
}

export async function seedWalletSession(context: BrowserContext) {
  await context.addCookies([
    {
      name: SESSION_COOKIE_NAME,
      value: buildWalletSessionValue(),
      domain: "127.0.0.1",
      path: "/",
      httpOnly: false,
      sameSite: "Lax",
    },
  ]);
}

export async function installMockWallet(page: Page) {
  await page.addInitScript(
    ({ account, chainId, chainHex, signature }) => {
      class MockEthereumProvider {
        isMetaMask = true;
        chainId = chainHex;
        selectedAddress = account;
        _listeners = new Map<string, Set<MockListener>>();
        _txCount = 0;

        on(event: string, listener: MockListener) {
          const listeners = this._listeners.get(event) ?? new Set();
          listeners.add(listener);
          this._listeners.set(event, listeners);
          return this;
        }

        removeListener(event: string, listener: MockListener) {
          this._listeners.get(event)?.delete(listener);
          return this;
        }

        emit(event: string, ...args: unknown[]) {
          for (const listener of this._listeners.get(event) ?? []) {
            listener(...args);
          }
        }

        async request({ method, params }: Eip1193RequestArgs) {
          switch (method) {
            case "eth_requestAccounts":
            case "eth_accounts":
              return [account];
            case "eth_chainId":
              return this.chainId;
            case "net_version":
              return String(chainId);
            case "eth_getBalance":
              return "0xde0b6b3a7640000";
            case "eth_blockNumber":
              return "0x1";
            case "eth_getTransactionCount":
              return "0x0";
            case "eth_estimateGas":
              return "0xdbba0";
            case "eth_gasPrice":
              return "0x3b9aca00";
            case "eth_maxPriorityFeePerGas":
              return "0x3b9aca00";
            case "wallet_switchEthereumChain": {
              const next = (params?.[0] as { chainId?: string } | undefined)?.chainId;
              if (next) {
                this.chainId = next;
                this.emit("chainChanged", next);
              }
              return null;
            }
            case "wallet_addEthereumChain": {
              const next = (params?.[0] as { chainId?: string } | undefined)?.chainId;
              if (next) {
                this.chainId = next;
                this.emit("chainChanged", next);
              }
              return null;
            }
            case "wallet_requestPermissions":
            case "wallet_getPermissions":
              return [{ parentCapability: "eth_accounts" }];
            case "personal_sign":
            case "eth_sign":
            case "eth_signTypedData":
            case "eth_signTypedData_v4":
              return signature;
            case "eth_sendTransaction": {
              this._txCount += 1;
              return `0x${String(this._txCount).padStart(64, "0")}`;
            }
            default:
              return null;
          }
        }
      }

      const provider = new MockEthereumProvider();
      const win = window as Window & {
        ethereum?: MockEthereumProvider & { providers?: MockEthereumProvider[] };
        __mockEthereumProvider?: MockEthereumProvider;
      };
      win.ethereum = Object.assign(provider, { providers: [provider] });
      win.__mockEthereumProvider = provider;
      window.dispatchEvent(new Event("ethereum#initialized"));
    },
    {
      account: TEST_WALLET_ADDRESS,
      chainId: TARGET_CHAIN_ID,
      chainHex: TARGET_CHAIN_HEX,
      signature: FAKE_SIGNATURE,
    },
  );
}

export async function mockTransferFormOptions(page: Page) {
  await page.route("**/api/transfer-form-options", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(TRANSFER_OPTIONS),
    });
  });
}

export async function connectSessionWallet(page: Page) {
  await page.getByRole("button", { name: /connect wallet/i }).first().click();

  const browserWallet = page.getByRole("button", { name: /browser wallet/i });
  if (await browserWallet.count()) {
    await browserWallet.click();
  }

  await expect(page.getByRole("button", { name: "Disconnect" })).toBeVisible();
}

export async function fillValidTransferForm(page: Page) {
  await page.getByLabel("Recipient investor").fill("Investor #2");
  await page.getByLabel("Recipient wallet address").fill("0x2222222222222222222222222222222222222222");
  await page.getByLabel("Amount").fill("1250");
  await page.getByLabel("Encrypted amount (bytes32)").fill(`0x${"1".repeat(64)}`);
  await page.getByLabel("Input proof (bytes)").fill(`0x${"12".repeat(32)}`);
  await page.getByLabel("Disclosure data id (bytes32)").fill(`0x${"2".repeat(64)}`);
}

export async function fillValidDisclosureForm(page: Page) {
  await page.getByPlaceholder("Disclosure title").fill("Quarterly regulator packet");
  await page.getByPlaceholder("Disclosure content").fill("Contains investor-level proof bundle for Q2 review.");
  await page.getByPlaceholder("Disclosure data ID (bytes32)").fill(`0x${"3".repeat(64)}`);
  await page.getByPlaceholder("Grantee wallet (0x...)").fill("0x3333333333333333333333333333333333333333");
  await page.getByPlaceholder(/Expiry UNIX timestamp/).fill("1767225600");
}

export async function fillValidPassportForm(page: Page) {
  await page.getByPlaceholder("Transfer ID (e.g. 5)").fill("5");
  await page.getByPlaceholder("Policy hash").fill(`0x${"4".repeat(64)}`);
  await page.getByPlaceholder("Disclosure data ID").fill(`0x${"5".repeat(64)}`);
  await page.getByPlaceholder("Anchor hash").fill(`0x${"6".repeat(64)}`);
  await page.getByPlaceholder("Recipient wallet (0x...)").fill("0x4444444444444444444444444444444444444444");
  await page.getByPlaceholder("Encrypted amount (bytes32)").fill(`0x${"7".repeat(64)}`);
  await page.getByPlaceholder("Input proof (0x...)").fill(`0x${"78".repeat(32)}`);
  await page.getByPlaceholder("Reason").fill("Routine compliance issuance");
}

export { TEST_WALLET_ADDRESS };
