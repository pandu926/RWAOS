# RWAOS 4-Minute Demo Video Script

**Focus:** iExec NOX Protocol, ERC-7984 confidential token, selective disclosure, cUSDT settlement, auditability  
**Target duration:** 3:50 - 4:05  
**Voice-over language:** English, formal but natural  
**Recording instructions:** Bahasa Indonesia  
**Recommended format:** screen recording + voice-over

---

## Tujuan Video

Video ini harus membuat juri langsung paham:

- Masalah nyata: institusi tidak bisa membiarkan jumlah transfer, saldo investor, dan strategi treasury terlihat publik.
- Solusi RWAOS: asset tokenized tetap on-chain, tapi amount dan movement menggunakan confidential token.
- Kenapa NOX penting: amount dienkripsi, proof dibuat dari wallet, dan kontrak memvalidasi payload confidential.
- Kenapa ini bukan sekadar privacy: auditor dan regulator tetap bisa mendapat selective disclosure dan audit proof.
- Use case paling mudah dipahami: USDT publik dikunci, lalu cUSDT dipakai untuk settlement confidential.

---

## Pre-Recording Checklist

- Jalankan aplikasi: `docker compose up -d`
- Buka frontend: `http://127.0.0.1:3313`
- Login dengan wallet demo/institusi.
- Pastikan network wallet di Arbitrum Sepolia.
- Buka tab yang dibutuhkan:
  - `/dashboard`
  - `/onboarding`
  - `/settlement`
  - `/assets/new`
  - `/transfers/new`
  - `/disclosures`
  - `/compliance/passports`
  - `/audit`
- Siapkan zoom browser 90-100%.
- Jangan tampilkan terminal berisi secret/private key.
- Kalau belum ada tenant settlement bundle, jalankan onboarding dulu:
  - Fill Demo Values
  - Deploy Tenant Bundle
  - Save Contract Addresses
  - Run Required Setup TXs

---

## Scene 1 — Opening Problem Hook

**Durasi:** 0:00 - 0:25  
**Route:** landing page atau `/dashboard`  
**Visual yang ditampilkan:** dashboard utama, sidebar produk, metric cards.

### Instruksi Recording

- Mulai dari halaman dashboard atau landing page.
- Jangan langsung masuk ke form teknis.
- Cursor pelan-pelan arahkan ke navigation: Assets, Settlement, Transfers, Disclosures, Audit.

### Voice-over

> Public blockchains are excellent for verification, but they create a serious problem for institutions.
>
> If a fund, a bank, or a treasury desk tokenizes real-world assets on-chain, the market should not be able to read investor balances, transfer amounts, or internal settlement activity.
>
> Standard ERC-20 infrastructure exposes too much. Fully off-chain systems hide too much.
>
> RWAOS is built for the space in between: confidential asset movement on a public chain, with compliance and auditability preserved.

### Pesan Yang Harus Nempel

Institusi butuh public verification, tapi tidak mau nominal dan strategi treasury terbuka.

---

## Scene 2 — What RWAOS Is

**Durasi:** 0:25 - 0:50  
**Route:** `/dashboard`  
**Visual yang ditampilkan:** dashboard, metrics, operations queue, audit pulse.

### Instruksi Recording

- Tampilkan dashboard penuh.
- Hover pelan ke area "Operations overview", "Compliance posture", dan "Audit pulse".
- Jangan klik dulu, biarkan audience melihat platform sebagai operating system.

### Voice-over

> RWAOS is an operating layer for confidential real-world assets.
>
> It combines a Next.js institutional dashboard, a Rust backend, tenant-owned smart contracts, and the iExec NOX Protocol.
>
> The goal is not only to move tokens privately.
>
> The goal is to let institutions issue assets, transfer them confidentially, disclose data selectively, and still produce an audit trail that a regulator or auditor can verify.

### Pesan Yang Harus Nempel

Ini bukan cuma contract demo. Ini workflow institusi dari issuance sampai audit.

---

## Scene 3 — Tenant-Owned Contract Setup

**Durasi:** 0:50 - 1:20  
**Route:** `/onboarding`  
**Visual yang ditampilkan:** tenant onboarding, settlement asset field, deploy bundle, contract address preview.

### Instruksi Recording

- Buka `/onboarding`.
- Tampilkan bahwa institusi deploy contract bundle dari wallet mereka sendiri.
- Highlight field settlement asset.
- Kalau sudah deploy, tampilkan address bundle yang tersimpan.

### Voice-over

> The first step for an institution is ownership.
>
> RWAOS does not force every institution into one shared token contract. The institution deploys its own contract bundle from its own wallet.
>
> The bundle includes a confidential token, a disclosure registry, a transfer controller, an audit anchor, and, when settlement is enabled, a settlement vault.
>
> This matters because the institution remains the owner of its asset infrastructure, while RWAOS provides the guided operating system around it.

### Pesan Yang Harus Nempel

SaaS story kuat: platform memudahkan deploy, tapi owner tetap wallet institusi.

---

## Scene 4 — Confidential Settlement: USDT to cUSDT

**Durasi:** 1:20 - 1:55  
**Route:** `/settlement`  
**Visual yang ditampilkan:** Wrap USDT into cUSDT, Public boundary, Private movement, NOX proof, Audit.

### Instruksi Recording

- Buka `/settlement`.
- Tampilkan empat stat cards:
  - Public boundary: USDT
  - Private movement: cUSDT
  - Proof: NOX
  - Audit: Tx hash
- Kalau untuk demo testnet, klik atau tunjukkan tombol `Mint test USDT`, lalu `Lock USDT and mint cUSDT`.
- Jangan terlalu lama di hash teknis; fokus ke makna bisnis.

### Voice-over

> A concrete use case is treasury settlement.
>
> The institution can lock public USDT at the boundary, then mint a confidential representation: cUSDT.
>
> From that point, internal settlement can happen with confidential tokens. The public chain can verify that assets entered the vault, but it does not reveal every internal amount movement.
>
> The NOX proof is generated from the connected wallet, and the encrypted amount is passed into the smart contract instead of exposing the value as plaintext calldata.

### Pesan Yang Harus Nempel

USDT masuk secara publik dan verifiable, movement internal pakai cUSDT confidential.

---

## Scene 5 — Asset Issuance With Confidential Mint

**Durasi:** 1:55 - 2:25  
**Route:** `/assets/new`  
**Visual yang ditampilkan:** asset creation form, beneficiary wallet, initial supply, NOX proof readiness, anchor hash.

### Instruksi Recording

- Buka `/assets/new`.
- Tampilkan form dengan beneficiary wallet auto-filled atau jelas.
- Tunjukkan readiness checklist.
- Tunjukkan bahwa encrypted amount/input proof auto-generated, bukan paste manual.

### Voice-over

> Asset issuance follows the same model.
>
> The issuer defines the asset, selects the beneficiary wallet, and enters the initial supply.
>
> RWAOS generates the encrypted amount and input proof in the browser through the connected wallet.
>
> The smart contract receives the confidential payload, validates it through NOX, and mints the ERC-7984 confidential token without exposing the minted amount publicly.

### Pesan Yang Harus Nempel

Minting confidential bukan manual proof paste; platform bantu generate proof dari wallet.

---

## Scene 6 — Confidential Transfer With Compliance Pre-Checks

**Durasi:** 2:25 - 3:05  
**Route:** `/transfers/new`  
**Visual yang ditampilkan:** sender, recipient, source wallet, disclosure data ID, readiness checklist, buttons.

### Instruksi Recording

- Buka `/transfers/new`.
- Tampilkan transfer preview.
- Highlight:
  - Sender investor
  - Recipient investor
  - Source wallet
  - Disclosure data ID
  - Pre-check status
  - NOX proof readiness
- Tunjukkan tombol:
  - Grant required disclosure
  - Set transfer controller as operator
  - Initiate confidential transfer

### Voice-over

> This is where privacy and compliance meet.
>
> Before a confidential transfer is submitted, RWAOS checks whether the sender wallet is mapped, whether the recipient wallet is valid, whether a disclosure grant exists, and whether the transfer controller is authorized as an operator.
>
> The amount is used locally to generate a NOX encrypted payload. The transaction submits the encrypted amount and proof, not a public transfer value.
>
> So the institution gets private movement, while the system still enforces policy before execution.

### Pesan Yang Harus Nempel

Private transfer tidak berarti bebas aturan. Ada pre-check policy dan proof sebelum tx.

---

## Scene 7 — Selective Disclosure

**Durasi:** 3:05 - 3:30  
**Route:** `/disclosures`  
**Visual yang ditampilkan:** grantee, asset, scope, granted by, expires at, status.

### Instruksi Recording

- Buka `/disclosures`.
- Tunjukkan tabel grants.
- Highlight grantee address, scope, expiry.

### Voice-over

> Confidentiality is only useful if authorized parties can still review what they are allowed to review.
>
> That is why RWAOS includes selective disclosure.
>
> An issuer can grant a specific wallet access to a specific disclosure scope, with an expiry period. The auditor or regulator gets the evidence they need, without opening the entire ledger to the public.
>
> This is the difference between privacy and secrecy. RWAOS is private, but still accountable.

### Pesan Yang Harus Nempel

Private bukan berarti opaque. Auditor tetap bisa diberi akses terbatas.

---

## Scene 8 — Compliance Passport And Audit Trail

**Durasi:** 3:30 - 3:55  
**Routes:** `/compliance/passports`, lalu `/audit`  
**Visual yang ditampilkan:** passport list, policy hash, anchor hash, audit event trail.

### Instruksi Recording

- Buka `/compliance/passports`.
- Tunjukkan policy hash dan anchor hash.
- Pindah cepat ke `/audit`.
- Tunjukkan latest events dan verification bundle.

### Voice-over

> After a transfer, RWAOS can produce a compliance passport.
>
> The passport links the transfer record, disclosure scope, policy hash, and audit anchor into one reviewable evidence package.
>
> Then the audit trail shows the operational lifecycle: asset issuance, disclosure, confidential transfer, passport issuance, and verification events.
>
> The important point is simple: auditors can verify that the process happened correctly, without needing every private amount to become public.

### Pesan Yang Harus Nempel

Auditability tetap ada walaupun amount confidential.

---

## Scene 9 — Closing

**Durasi:** 3:55 - 4:05  
**Route:** kembali ke `/dashboard` atau title card sederhana.

### Instruksi Recording

- Kembali ke dashboard.
- Jangan buka halaman baru lagi.
- Tahan frame 2-3 detik setelah kalimat terakhir.

### Voice-over

> RWAOS shows how institutions can use public blockchains without exposing sensitive financial activity.
>
> With iExec NOX, ERC-7984 confidential tokens, selective disclosure, and audit-ready workflows, tokenized assets can be private, compliant, and verifiable at the same time.
>
> That is the future RWAOS is building.

### Pesan Yang Harus Nempel

Private, compliant, verifiable.

---

## Complete Timeline

| Time | Scene | Route | Main Message |
|---|---|---|---|
| 0:00 - 0:25 | Problem Hook | `/dashboard` or landing | Public chains expose too much for institutions |
| 0:25 - 0:50 | Product Overview | `/dashboard` | RWAOS is an operating layer, not just a contract |
| 0:50 - 1:20 | Tenant Setup | `/onboarding` | Institution owns its contract bundle |
| 1:20 - 1:55 | USDT to cUSDT | `/settlement` | Public USDT boundary, confidential internal settlement |
| 1:55 - 2:25 | Asset Issuance | `/assets/new` | Confidential mint with NOX proof |
| 2:25 - 3:05 | Transfer Flow | `/transfers/new` | Private transfer with compliance pre-checks |
| 3:05 - 3:30 | Disclosure | `/disclosures` | Authorized parties get scoped access |
| 3:30 - 3:55 | Passport + Audit | `/compliance/passports`, `/audit` | Verify process without revealing private amount |
| 3:55 - 4:05 | Closing | `/dashboard` | Private, compliant, verifiable |

---

## Human Delivery Notes

- Jangan baca terlalu cepat. Target 135-145 words per minute.
- Ucapkan istilah teknis dengan jelas:
  - iExec NOX
  - ERC-7984
  - confidential token
  - selective disclosure
  - compliance passport
- Jangan terdengar seperti menjual hype. Nada harus profesional, seperti founder menjelaskan produk ke investor teknis.
- Setiap scene harus punya satu pesan utama. Jangan menjelaskan semua detail teknis sekaligus.
- Kalau ada transaksi wallet yang lama, jangan tunggu kosong terlalu lama. Jelaskan sambil menunggu:
  > "This wallet confirmation is important because the institution remains the owner and signer of the infrastructure."

---

## Lines To Memorize

Gunakan kalimat ini persis atau hampir persis:

1. "Standard ERC-20 infrastructure exposes too much. Fully off-chain systems hide too much."
2. "RWAOS is built for the space in between."
3. "The institution remains the owner of its asset infrastructure."
4. "Public USDT enters the vault, while internal settlement uses confidential cUSDT."
5. "The transaction submits the encrypted amount and proof, not a public transfer value."
6. "This is the difference between privacy and secrecy. RWAOS is private, but still accountable."
7. "Private, compliant, and verifiable at the same time."

---

## Optional Text Overlays

Kalau video diedit, tambahkan overlay singkat:

| Time | Overlay |
|---|---|
| 0:05 | Public chains expose institutional activity |
| 0:35 | RWAOS: Confidential RWA Operating Layer |
| 1:05 | Tenant-owned contracts |
| 1:30 | USDT → cUSDT confidential settlement |
| 2:05 | NOX encrypted amount + input proof |
| 2:40 | Compliance pre-checks before transfer |
| 3:15 | Selective disclosure, not public leakage |
| 3:45 | Auditability without revealing private amounts |

---

## Demo Risk Notes

- Jika `/settlement` masih menampilkan "Settlement contracts not configured", berarti tenant yang login belum deploy settlement bundle. Jalankan `/onboarding` ulang dengan settlement asset terisi.
- Jika tombol transfer blocked, gunakan readiness checklist untuk menjelaskan bahwa sistem sengaja mencegah transfer tanpa disclosure/operator permission.
- Jika wallet confirmation lama, jangan panik. Itu bagian dari cerita: institusi menandatangani sendiri transaksi ownership.
- Jangan menyebut "production ready" secara absolut. Lebih aman:
  > "This is a working end-to-end demo on Arbitrum Sepolia."

