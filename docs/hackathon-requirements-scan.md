# Source
- Primary page scanned: https://dorahacks.io/hackathon/vibe-coding-iexec/detail
- Supporting pages scanned:
  - https://dorahacks.io/hackathon/vibe-coding-iexec
  - https://dorahacks.io/hackathon/vibe-coding-iexec/buidl
  - https://dorahacks.io/hackathon/vibe-coding-iexec/qa
- Scan timestamp: April 23, 2026 (Europe/Berlin timezone).

# Must-Haves
- Build an application using **NOX protocol + Confidential Tokens** (iExec).
- Use case must target privacy-enabled DeFi/RWA/tokenization scenarios.
- Project must work **end-to-end** with **no mocked data**.
- Deploy on **Arbitrum Sepolia** or **Arbitrum mainnet**.
- Submit a **public GitHub repository** with:
  - complete open-source code,
  - README with install/use instructions,
  - setup/deploy/use documentation.
- Provide a functional dApp frontend.
- Provide demo video with **maximum 4 minutes** duration.
- Include `feedback.md` in the GitHub repository with feedback about iExec tools.
- Publish submission post on X containing:
  - short project description,
  - demo video link/asset,
  - GitHub repository link,
  - tags: `@iEx_ec` and `@Chain_GPT`.
- Team size limit: up to **5 participants**.

Actionable engineering checklist:
- Replace all dummy/mock API paths with live integration and persistent state.
- Prove on-chain deployment on Arbitrum Sepolia (contract addresses + tx hashes in README).
- Add `feedback.md` now (required by criteria).
- Produce ≤4 minute demo that shows real confidential flow and live chain interaction.
- Add a “submission evidence” section in README with working URLs and reproducible commands.

# Disqualifiers
- Any mocked-data based app flow (“application must work end-to-end, using mock data leads to disqualification”).
- Missing mandatory submission artifacts (public repo, docs, functional frontend, demo video, feedback doc, required X post tags).
- Non-compliant or partial implementation if claiming ERC standards integration (event note explicitly warns partial implementations are not valid for listed standards).
- Broken/unreachable submission assets at judging time (practical elimination risk).

# Judging
- Explicit weighted gates shown in challenge text:
  - End-to-end without mocked data.
  - Deployment on Arbitrum Sepolia or Arbitrum.
  - `feedback.md` provided.
  - Video length ≤4 minutes.
- Core qualitative criteria:
  - technical implementation quality of NOX + Confidential Token integration,
  - real-world usefulness for RWA/DeFi,
  - code quality/maintainability (even with vibe-coding),
  - UX quality and intuitiveness.

# Submission Package
- DoraHacks BUIDL submission for track: **Confidential DeFi & RWA**.
- Public GitHub repository link.
- README + comprehensive docs.
- Functional frontend link or runnable instructions.
- Demo video (max 4 minutes).
- `feedback.md` in repo root (recommended).
- X post URL with required tags (`@iEx_ec`, `@Chain_GPT`) and project/demo/repo links.
- Optional but strongly recommended evidence bundle:
  - deployment addresses,
  - block explorer links,
  - screenshots/GIFs,
  - “how to run in <10 minutes” section.

# Timeline
- Pre-registration opens: **March 24, 2026, 23:00** (shown on DoraHacks page).
- Submission opens: **April 5, 2026, 22:00**.
- Submission deadline: **May 1, 2026, 21:59**.
- Workshops/office hours listed on detail page:
  - Workshop #1: **April 9, 2026, 17:00 GMT+2**
  - Workshop #2: **April 17, 2026, 17:00 GMT+2**
  - Workshop #3: **April 23, 2026, 17:00 GMT+2**
  - Office Hours: **April 24, 2026, 17:00 GMT+2**
  - Workshop #4: **April 30, 2026, 17:00 GMT+2**

# Risks
- Highest risk: current product still using mock/dummy data paths in any critical flow.
- Standards risk: claiming ERC-7984 / confidential token support without complete and provable integration.
- Submission risk: missing `feedback.md` or X post tags causes eligibility issues.
- Time risk: late-stage fixes to docs/video/social proof often block valid submission despite working code.
- Ops risk: non-deterministic setup (no one-command runbook) reduces judge reproducibility and scoring confidence.
