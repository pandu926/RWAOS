# DoraHacks Submission Form — Ready-to-Paste Answers

**Project:** RWAOS — Real World Asset Operating System
**Hackathon:** iExec Vibe Coding Challenge

---

## FEEDBACK SECTION

---

### Q: What feedback would you like to share about your experience building during this hackathon?

**Answer (paste directly):**

```
Building RWAOS on the NOX Protocol was one of the most technically ambitious things we've done in a 
hackathon. The ERC-7984 Confidential Token standard is a genuinely powerful primitive — once we 
understood how Nox.fromExternal(externalEuint256, inputProof) works, the entire confidential 
issuance and transfer flow clicked into place.

What worked extremely well:
- The conceptual documentation for NOX and ERC-7984 is strong. The positioning around "encrypt at 
  the edge, validate on-chain" is clear and the mental model transfers well to complex use cases 
  like selective disclosure and audit anchoring.
- The Arbitrum Sepolia deployment path was smooth. Hardhat integration with the iExec contract 
  imports worked reliably.
- The ERC-7984 inheritance pattern made it easy to build on top of — our ConfidentialRWAToken 
  extends ERC7984 with minimal friction.

What was harder than expected:
- Finding working end-to-end examples of encrypted input creation from the frontend (the full 
  client-side encrypt → submit → on-chain proof validate flow). We had to piece this together from 
  multiple sources.
- Package version compatibility between @iexec-nox packages and solidity 0.8.28 required some 
  trial and error before it resolved cleanly.
- Local dev guidance for the full NOX encrypted flow (not just contract-level, but wallet → 
  contract → event) could be more explicit with a canonical example app.

Overall: the technology is genuinely production-ready for confidential DeFi and RWA use cases. 
The developer experience will improve significantly with a few more end-to-end tutorials.
```

---

### Q: What could we improve to make the building experience easier for developers?

**Answer (paste directly):**

```
Three specific improvements would have saved us the most time:

1. A canonical "scaffold to deployed proof" tutorial — a step-by-step guide that takes a developer 
   from zero to a deployed ERC-7984 token on Arbitrum Sepolia with at least one on-chain encrypted 
   mint transaction and the Arbiscan link captured. This closes the most common gap: knowing the 
   concept but not knowing what a successful end-to-end run looks like.

2. A minimal frontend snippet for encrypted input creation — showing exactly how to create an 
   externalEuint256 encrypted amount from the client side, sign the inputProof, and submit it to 
   a NOX-powered contract. Even a 50-line React component would have saved hours.

3. A version compatibility matrix — a simple table showing which versions of @iexec-nox/* packages 
   work with which Solidity versions, Hardhat versions, and ethers/viem versions. Package 
   compatibility issues are the single highest-friction blocker for new developers.
```

---

### Q: Do you have any suggestions for improving the tools, docs or workflow?

**Answer (paste directly):**

```
Suggestions in priority order:

1. Publish a production-path tutorial: "ERC-7984 Token on Arbitrum Sepolia — scaffold, deploy, 
   mint with encrypted inputs, capture tx hash." This single tutorial would make the hackathon 
   significantly more accessible.

2. Add a migration guide for teams coming from ERC-20: what changes conceptually, what changes 
   in Solidity, what changes in the frontend interaction model. Many teams (including ours) started 
   from an ERC-20 mental model and had to rebuild their understanding.

3. Provide a reference implementation for the DisclosureRegistry / ACL pattern — a minimal 
   on-chain example of granting and revoking view access to an encrypted balance. This is the 
   feature that makes NOX uniquely powerful for institutional use cases, but it has the least 
   documentation coverage.

4. Consider a "NOX DevKit" — a Hardhat task or CLI command that generates a minimal ERC-7984 
   project with deploy script, one test, and one proof script. Similar to `hardhat init` but 
   NOX-aware. This would dramatically lower the cold-start barrier.

5. The iExec Discord challenge channel is helpful — having a dedicated "NOX tech questions" thread 
   pinned with common gotchas (e.g., encrypted input format, proof validation errors) would 
   reduce duplicated questions.
```

---

### Q: What is your email address so we can follow up if needed?

**Answer:**
```
kutilluti@gmail.com
```

---

## CONTACT & VERIFICATION SECTION

---

### Q: Drop your email and Telegram handle so we can reach out if you win a prize!

**Answer:**
```
Email: kutilluti@gmail.com
Telegram: @[YOUR_TELEGRAM_HANDLE]
```

> **ACTION REQUIRED:** Replace `@[YOUR_TELEGRAM_HANDLE]` with your actual Telegram username.

---

### Q: Before joining the hackathon, you must complete the iExec "Hello World" journey. Please enter the wallet you used during the journey so we can verify it.

**Answer:**
```
0xf21b5742477A5e065EF86dEdbA40b34527AC93fD
```

> This is the deployer wallet used for all four RWAOS contracts on Arbitrum Sepolia.
> Confirm this matches the wallet you used for the Hello World journey.
> If different, replace with your Hello World journey wallet address.

---

### Q: Please provide the URL of your X (Twitter) post showcasing your project.

**Template X Post (write and publish this first, then paste the URL):**

```
🔐 Introducing RWAOS — the first Confidential Operating System for Real World Assets.

Built natively on @iEx_ec NOX Protocol + ERC-7984 Confidential Token standard.

✅ 4 smart contracts live on Arbitrum Sepolia
✅ Native ERC-7984 encrypted mint & transfer via Nox.fromExternal
✅ On-chain selective disclosure registry
✅ Tamper-evident audit anchor
✅ Rust + Axum backend · Next.js 16 · 12-page institutional dashboard
✅ Playwright E2E verified

"Everyone else built a confidential coin. We built the OS that makes confidential coins usable for real institutions."

🎥 Demo: [YOUR_VIDEO_URL]
📦 Repo: [YOUR_GITHUB_URL]

#iExec #NOXProtocol #ERC7984 #RWA #ConfidentialDeFi @iEx_ec
```

> **ACTION REQUIRED:**
> 1. Replace `[YOUR_VIDEO_URL]` with your YouTube/Loom demo link
> 2. Replace `[YOUR_GITHUB_URL]` with your GitHub repo URL
> 3. Publish the tweet
> 4. Copy the tweet URL and paste it into the DoraHacks form field

---

## SUBMISSION CHECKLIST

- [ ] Email entered: `kutilluti@gmail.com`
- [ ] Telegram handle entered
- [ ] Hello World wallet address verified and entered
- [ ] Feedback Q1 answered (building experience)
- [ ] Feedback Q2 answered (improvements)
- [ ] Feedback Q3 answered (tools/docs/workflow)
- [ ] Demo video recorded and uploaded (YouTube / Loom)
- [ ] X post published with video + repo link + @iEx_ec tag
- [ ] X post URL pasted into form
- [ ] BUIDL submitted on DoraHacks before May 1, 2026 21:59
