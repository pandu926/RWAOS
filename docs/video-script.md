# RWAOS — Demo Video Script (4 Minutes)
**iExec Vibe Coding Challenge — DoraHacks Submission**

---

## Production Notes

| Item | Detail |
|---|---|
| Total Duration | 3 min 45 sec – 4 min 00 sec |
| Format | Screen recording + voiceover |
| Recommended Tool | OBS Studio / Loom / QuickTime |
| Resolution | 1920×1080, 30fps minimum |
| Audio | Clear voiceover, no background noise |
| Screen Setup | Browser on RWAOS UI + code editor side-by-side (when needed) |
| Color Accent | Highlight key UI areas with zoom or cursor emphasis |

---

## Pre-Recording Checklist

Before hitting record:
- [ ] RWAOS Docker stack is running: `docker compose up -d --build`
- [ ] Frontend is accessible at `http://127.0.0.1:3389`
- [ ] Open Arbiscan for the 6 tx hashes (bookmarked, ready to switch)
- [ ] Open `contracts/contracts/ConfidentialRWAToken.sol` in editor
- [ ] Open `contracts/deployments/arbitrumSepolia.json` in editor
- [ ] Close notifications, Slack, email — clean desktop
- [ ] Browser zoom set to 110% for readability
- [ ] Microphone tested

---

## SCENE 1 — Problem Hook (0:00 – 0:30)

### Screen
**Black screen or simple title card:**
```
RWAOS
Real World Asset Operating System
Powered by iExec NOX Protocol + ERC-7984
```

### Voiceover Script
> "Imagine a private credit fund that wants to tokenize a fifty-million-dollar note on a public blockchain.
>
> Their lawyer says: *'Yes — but no one can see investor balances on-chain.'*
>
> A standard ERC-20? Every balance is public. Every transfer is visible to your competitors.
>
> An off-chain ledger? You lose composability, auditability, and the entire point of blockchain.
>
> This is the contradiction that has blocked institutional RWA adoption for years.
>
> **RWAOS resolves it.**"

### Director Notes
- Speak slowly and with conviction on "RWAOS resolves it."
- Pause 0.5 seconds before that last line for impact.
- Title card can be a simple dark background with white text — no need to be fancy.

---

## SCENE 2 — What Is RWAOS (0:30 – 0:50)

### Screen
Switch to **RWAOS Dashboard** at `http://127.0.0.1:3389/dashboard`

Pan slowly across the dashboard — show metrics cards, recent activity, navigation sidebar.

### Voiceover Script
> "RWAOS is the first end-to-end operating system for confidential real-world assets.
>
> Not a demo. Not a toy contract.
>
> A full twelve-page institutional dashboard, wired to a production-grade Rust backend and four smart contracts deployed live on Arbitrum Sepolia.
>
> Let me show you what that means in practice."

### Director Notes
- Highlight the sidebar navigation: show Dashboard → Assets → Investors → Transfers → Disclosures → Audit
- Mouse movement should be slow and deliberate — let the judges read the screen.

---

## SCENE 3 — Asset Registry (0:50 – 1:20)

### Screen
Navigate to `/assets` page. Show the asset list table.
Then click on a single asset to show the detail view (`/assets/[id]`).

### Voiceover Script
> "Here in the Asset Registry, an issuer manages their tokenized instruments.
>
> Each asset is a native ERC-7984 confidential token, deployed through our `ConfidentialRWAToken` contract and powered by the **iExec NOX Protocol**.
>
> When an issuer mints, the token amount is **never revealed in calldata**. It travels as an encrypted `euint256` value — `Nox.fromExternal` validates the proof on-chain, and the balance update happens entirely in ciphertext.
>
> This is honest confidentiality — not a wrapper, not a workaround. This is the ERC-7984 standard, native."

### Director Notes
- While saying "Nox.fromExternal" — switch briefly to `ConfidentialRWAToken.sol` in your editor, highlight the `Nox.fromExternal(encryptedAmount, inputProof)` line.
- 3–4 seconds on the code, then return to the UI.
- Keep the code visible long enough for judges to read the line.

**Code highlight (show on screen for ~4 seconds):**
```solidity
// ConfidentialRWAToken.sol
euint256 encryptedAmt = Nox.fromExternal(encryptedAmount, inputProof);
```

---

## SCENE 4 — Investor Registry (1:20 – 1:40)

### Screen
Navigate to `/investors` — show investor list table with name, wallet, KYC status, eligibility columns.

### Voiceover Script
> "The Investor Registry manages KYC-verified participants.
>
> Only whitelisted investors can receive confidential transfers. The Rust backend enforces eligibility pre-flight before any transaction is submitted to the transfer controller contract.
>
> Investor holdings are stored encrypted — their positions are never exposed publicly on-chain."

### Director Notes
- Pan across the investor table slowly.
- No need to navigate into individual investor detail unless there is something visually compelling.

---

## SCENE 5 — Confidential Transfer Flow (1:40 – 2:20)

### Screen
Navigate to `/transfers` — show the transfer list.
Then navigate to `/transfers/new` — show the new transfer form.

### Voiceover Script
> "Now for the core: a **confidential transfer**.
>
> When an issuer initiates a transfer, the amount is encrypted client-side before it ever touches the network. The `TransferController` contract receives the encrypted input and validates it through NOX's proof system on-chain.
>
> Here are the live transaction hashes from our Arbitrum Sepolia deployment — this happened on April 23rd."

### Screen — Switch to Arbiscan
Open Arbiscan and navigate to these two transactions (have them bookmarked):

1. Direct confidential transfer:
   `https://sepolia.arbiscan.io/tx/0xbc8c669f48c8250d3bbdbe0425995677d007b6529c422e0802859dd81d788428`

2. Transfer via controller:
   `https://sepolia.arbiscan.io/tx/0xbe4aadadc73e772823cb758d79b0e7472ab89568face868aff0701e41852c5ad`

### Voiceover Script (continued while showing Arbiscan)
> "Transaction confirmed on-chain. Block `262228194`. Gas used: `305,922`.
>
> Look at the calldata — no plaintext amount. Encrypted input, on-chain proof validation.
>
> This is what `Nox.fromExternal` delivers. The transfer amount moves confidentially, from issuer to investor, with verifiable integrity and zero plaintext exposure."

### Director Notes
- Zoom into the transaction input data field on Arbiscan to visually show the encrypted payload.
- Speak "Nox.fromExternal" clearly and slowly — this is a key judging signal.

---

## SCENE 6 — Selective Disclosure (2:20 – 2:50)

### Screen
Navigate to `/disclosures` — show the disclosure grants list.

### Voiceover Script
> "Selective disclosure is where institutional requirements meet cryptographic guarantees.
>
> In legacy finance, an auditor receives a PDF by email. In RWAOS, the issuer writes a scoped viewer grant directly to the `DisclosureRegistry` contract on-chain.
>
> The auditor gets exactly the view they need — nothing more. The grant can be time-limited and revoked at any time.
>
> Here is the on-chain disclosure transaction from our proof run:"

### Screen — Switch to Arbiscan
Open:
`https://sepolia.arbiscan.io/tx/0x96173766188c5ae79b7e9e58dba1013a7dd605a82f040f05649a842c5d4ccabe`

### Voiceover Script (continued)
> "Block `262228185`. `DisclosureRegistry` contract, `grantDisclosure` call, confirmed on Arbitrum Sepolia.
>
> Selective disclosure — cryptographic, on-chain, revocable. Not a PDF."

### Director Notes
- Say "Not a PDF" with a slight pause before it — it's a memorable line.

---

## SCENE 7 — Audit Anchor (2:50 – 3:10)

### Screen
Navigate to `/audit` — show the audit events log.

### Voiceover Script
> "Every institution needs an audit trail. RWAOS goes further — the Rust backend periodically hashes its audit bundle and **commits that hash to the `AuditAnchor` contract on-chain**.
>
> This creates a tamper-evident, independently verifiable record. Even if the off-chain backend were compromised, the on-chain hash proves what the audit state was at commitment time.
>
> Here is the live anchor transaction:"

### Screen — Switch to Arbiscan
Open:
`https://sepolia.arbiscan.io/tx/0x0c094972a1f36b0725597cc98cfe9fbd3c7ea9f1b77312371ba6a98b7d638e5b`

### Voiceover Script (continued)
> "Block `262228213`. `AuditAnchor`, `commitAuditHash`. On Arbitrum Sepolia, permanently.
>
> This is not a roadmap feature. This is live today."

---

## SCENE 8 — Architecture & Stack (3:10 – 3:35)

### Screen
Show the `contracts/deployments/arbitrumSepolia.json` file open in editor.

### Voiceover Script
> "Let me close with the architecture.
>
> Four smart contracts deployed on Arbitrum Sepolia:
> — `ConfidentialRWAToken` — ERC-7984, NOX-powered
> — `TransferController` — policy-enforced confidential transfers
> — `DisclosureRegistry` — on-chain scoped viewer grants
> — `AuditAnchor` — tamper-evident hash commitments
>
> Backend: **Rust + Axum** modular monolith, **PostgreSQL**, ten domain modules, RBAC, chain event reconciliation.
>
> Frontend: **Next.js 16**, **React 19**, **Tailwind 4**, twelve operational pages.
>
> All running on Docker with one command. All E2E-verified with Playwright on seven core routes."

### Director Notes
- Show `arbitrumSepolia.json` — let judges see all four addresses on screen.
- Speak each contract name clearly.
- For the stack bullet points, keep the pace measured — one technology every 1–2 seconds.

---

## SCENE 9 — Call to Action (3:35 – 4:00)

### Screen
Return to the RWAOS Dashboard at `/dashboard`. Full-screen view — clean, professional.

Then hold on the title card for the final 5 seconds:
```
RWAOS
Real World Asset Operating System

Powered by iExec NOX Protocol + ERC-7984
Deployed on Arbitrum Sepolia

github.com/[your-repo]
```

### Voiceover Script
> "RWAOS is the answer to the question that has blocked institutional RWA adoption for years:
>
> *How do you run confidential assets on a public chain — without sacrificing composability, compliance, or auditability?*
>
> With the iExec NOX Protocol, with ERC-7984, with iExec TEE for off-chain data, and with an operating system built for the institutions who need it most.
>
> Thank you."

### Director Notes
- "Thank you" should land on the title card — not the UI.
- Keep 2–3 seconds of silence after "Thank you" before ending the recording.
- Smile in your voice on the final sentence.

---

## Complete Timing Summary

| Scene | Time | Content | Key Visual |
|---|---|---|---|
| 1 — Problem Hook | 0:00–0:30 | The institutional RWA contradiction | Title card |
| 2 — What Is RWAOS | 0:30–0:50 | OS overview, 12 pages, live stack | Dashboard page |
| 3 — Asset Registry | 0:50–1:20 | ERC-7984 mint, NOX code line | Assets page + ConfidentialRWAToken.sol |
| 4 — Investor Registry | 1:20–1:40 | KYC whitelist, encrypted holdings | Investors page |
| 5 — Confidential Transfer | 1:40–2:20 | Encrypted transfer, Arbiscan tx | Transfers page + 2 Arbiscan links |
| 6 — Selective Disclosure | 2:20–2:50 | On-chain disclosure grant | Disclosures page + Arbiscan link |
| 7 — Audit Anchor | 2:50–3:10 | Tamper-evident hash commitment | Audit page + Arbiscan link |
| 8 — Architecture | 3:10–3:35 | 4 contracts + full stack | arbitrumSepolia.json |
| 9 — Call to Action | 3:35–4:00 | Vision + thank you | Dashboard + title card |

---

## Arbiscan Links (Bookmark These Before Recording)

| Transaction | Arbiscan URL |
|---|---|
| Mint | `https://sepolia.arbiscan.io/tx/0x20b1b3abaef72509494b6d8c21a3c944a1e962b67264c8a609d43e64a86efac2` |
| Set Operator | `https://sepolia.arbiscan.io/tx/0x7a217bfd657a94ba3dfc62213eaa05fd2e57c6ee42c100e3c28dff359cd44c3e` |
| Disclosure Grant | `https://sepolia.arbiscan.io/tx/0x96173766188c5ae79b7e9e58dba1013a7dd605a82f040f05649a842c5d4ccabe` |
| Direct Confidential Transfer | `https://sepolia.arbiscan.io/tx/0xbc8c669f48c8250d3bbdbe0425995677d007b6529c422e0802859dd81d788428` |
| Transfer via Controller | `https://sepolia.arbiscan.io/tx/0xbe4aadadc73e772823cb758d79b0e7472ab89568face868aff0701e41852c5ad` |
| Audit Anchor | `https://sepolia.arbiscan.io/tx/0x0c094972a1f36b0725597cc98cfe9fbd3c7ea9f1b77312371ba6a98b7d638e5b` |

---

## Key Lines to Memorize (Judge Anchors)

These lines are the most important — practice until they feel natural:

1. **Scene 1:** *"RWAOS resolves it."*
2. **Scene 3:** *"This is honest confidentiality — not a wrapper, not a workaround."*
3. **Scene 5:** *"No plaintext amount. Encrypted input, on-chain proof validation."*
4. **Scene 6:** *"Not a PDF."*
5. **Scene 7:** *"This is not a roadmap feature. This is live today."*
6. **Scene 9:** *"How do you run confidential assets on a public chain — without sacrificing composability, compliance, or auditability?"*

---

## Voice & Pacing Notes

- **Speak at 130–145 words per minute** (conversational, not rushed).
- **Pause 0.5 seconds** after every section heading ("Here in the Asset Registry…" → pause → continue).
- **Slow down** on technical terms: `Nox.fromExternal`, `externalEuint256`, `ERC-7984`, `DisclosureRegistry`, `AuditAnchor`.
- **Speed up slightly** on the stack list in Scene 8 to keep energy high.
- **End quietly** — the call to action should feel resolved, not hyped.

---

## Optional Enhancement: Subtitle Overlay

If you have editing capability, add text overlays at these moments:

| Timecode | Overlay Text |
|---|---|
| 0:00 | `RWAOS — Real World Asset Operating System` |
| 0:30 | `iExec NOX Protocol + ERC-7984` |
| 1:05 | `Nox.fromExternal(encryptedAmount, inputProof)` |
| 1:50 | `Arbitrum Sepolia — LIVE` |
| 2:30 | `DisclosureRegistry.grantDisclosure()` |
| 2:55 | `AuditAnchor.commitAuditHash()` |
| 3:15 | `4 Contracts · Rust Backend · Next.js 16 · Playwright E2E` |
| 3:40 | `github.com/[your-repo]` |

---

## Post-Recording Checklist

- [ ] Video is under 4 minutes 00 seconds
- [ ] Audio is clear — no echo, no background noise
- [ ] All six Arbiscan links visible on screen for at least 3 seconds each
- [ ] Contract addresses visible in `arbitrumSepolia.json` scene
- [ ] `Nox.fromExternal` code line visible on screen
- [ ] Upload to YouTube (Unlisted) or Loom
- [ ] Paste URL into DoraHacks submission form
- [ ] Add video URL to `docs/demo-video.md`
