# iExec Vibe Coding Challenge (DoraHacks) — Syarat, Ketentuan, Kriteria, dan Resources

Sumber utama:
- https://dorahacks.io/hackathon/vibe-coding-iexec/detail
- https://dorahacks.io/hackathon/vibe-coding-iexec

Dokumen ini merangkum isi event secara terstruktur untuk kebutuhan eksekusi submission.

## 1. Ringkasan Event

- Nama event: **iExec Vibe Coding Challenge**
- Platform: **DoraHacks**
- Format: **Virtual**
- Prize pool: **USD 1,500** (dibayar dalam **RLC tokens**)
- Fokus teknis: **NOX Protocol + Confidential Tokens** (iExec), use case DeFi/RWA/tokenization
- Ekosistem chain: **Arbitrum** (dengan keharusan deploy di Arbitrum Sepolia/Arbitrum)

## 2. Timeline Resmi

- Pre-registration: **24 Maret 2026 23:00**
- Submission mulai: **5 April 2026 22:00**
- Deadline submission: **1 Mei 2026 21:59**

Catatan waktu di atas mengikuti yang ditampilkan pada halaman event.

## 3. Challenge Statement (Inti Tantangan)

Peserta diminta membangun aplikasi menggunakan:
- **NOX Protocol**
- **Confidential Tokens** dari iExec

Proyek harus mengeksplorasi use case privacy-enabled di area:
- DeFi
- RWA (real-world assets)
- tokenization

Tujuan utama:
- Menunjukkan confidential + programmable financial logic yang tetap menjaga:
  - privasi
  - komposabilitas

## 4. Team Size & Collaboration Rules

- Maksimal **5 orang per tim**
- Boleh bentuk tim sebelumnya atau saat event berjalan
- Channel Discord disediakan untuk cari teammate

## 5. Prize Breakdown

- Juara 1: **USD 750**
- Juara 2: **USD 500**
- Juara 3: **USD 250**
- Distribusi hadiah: **RLC tokens**

## 6. Syarat & Ketentuan Partisipasi (Wajib)

## 6.1 Langkah partisipasi

1. Join channel challenge di Discord iExec.
2. Build app (AI-assisted coding boleh, traditional coding juga boleh).
3. Integrasi Confidential Tokens via NOX Protocol.
4. Submit project via X post sesuai ketentuan.

## 6.2 Aturan kritikal

- Aplikasi **harus bekerja end-to-end**.
- Penggunaan **mock data** untuk alur utama dapat menyebabkan **diskualifikasi**.
- Project harus benar-benar mengintegrasikan Confidential Tokens dengan utility nyata.

## 6.3 Utility token yang diterima (contoh)

- rewards
- governance
- private payments
- in-app currency
- access control

## 6.4 Ketentuan submission di X (wajib)

Post di X harus memuat:
- deskripsi singkat project
- video demo
- link repo GitHub

Wajib tag:
- `@iEx_ec`
- `@Chain_GPT`

## 7. Deliverables (Wajib untuk dinilai)

Submission harus mencakup:
- Repository GitHub publik berisi:
  - source code lengkap yang bisa dilihat
  - README dengan instruksi install/usage
  - dokumentasi setup/deploy/usage yang jelas
- Frontend dApp yang fungsional
- Video demo singkat (maksimal **4 menit**)
- Originalitas karya + patuh hak kekayaan intelektual
- Jika memakai basis project lama: jelaskan bagian mana yang dikerjakan selama hackathon

Catatan tambahan dari penyelenggara:
- iExec berhak menahan bounty bila submission tidak memenuhi track requirement.

## 8. Evaluation / Judging Criteria

Poin evaluasi yang disebutkan di halaman event:

1. **Harus end-to-end tanpa mock data** (high priority)
2. **Deploy di Sepolia Arbitrum atau Arbitrum** (high priority)
3. **Menyertakan feedback iExec tools** melalui file `feedback.md` di repo
4. **Video maksimal 4 menit**
5. Kualitas implementasi teknis:
   - seberapa baik Confidential Tokens + NOX dimanfaatkan
6. Real-world use case quality:
   - apakah menyelesaikan problem nyata di DeFi/RWA
7. Kualitas code:
   - maintainability dan kualitas engineering
8. UX quality:
   - usability dan kejelasan pengalaman pengguna

## 9. Builder Ideas Resmi (Contoh Arah Produk)

Kategori ide yang disorot:

- Confidential RWA & tokenization:
  - Private on-chain stocks
  - Private securities & commodities
  - Private yield (T-Bills/Bonds)

- Confidential DeFi:
  - Confidential Vault
  - Private lending/borrowing/yield

Catatan standar ERC yang disebut:
- ERC-3643
- ERC-7540
- ERC-7984

Penyelenggara menekankan implementasi harus mengikuti spesifikasi secara benar.

## 10. Workshops & Office Hours

Yang tercantum di detail event:

- Workshop #1 (Nox & Confidential Token Discovery): **9 April 2026, 17:00 (GMT+2)**
- Workshop #2 (Hello World with Nox): **17 April 2026, 17:00 (GMT+2)**
- Workshop #3 (Confidential Primitives): **23 April 2026, 17:00 (GMT+2)**
- Office Hours: **24 April 2026, 17:00 (GMT+2)**
- Workshop #4 (Build & Showcase): **30 April 2026, 17:00 (GMT+2)**

## 11. Developer Resources (Resmi)

- NOX docs (getting started):  
  https://docs.iex.ec/nox-protocol/getting-started/welcome

- iExec Nox npm org packages:  
  https://www.npmjs.com/org/iexec-nox?activeTab=packages

- Confidential smart contracts wizard:  
  https://cdefi-wizard.iex.ec/

- Additional developer links (Linktree):  
  https://linktr.ee/iexec.tech

- Confidential Token demo + faucet:  
  https://cdefi.iex.ec/

- ChainGPT developer docs:  
  https://docs.chaingpt.org/dev-docs-b2b-saas-api-and-sdk/introduction-to-chaingpts-developer-tools

- ChainGPT app / AI hub:  
  https://app.chaingpt.org/

## 12. Technical Support / Komunitas

- Discord iExec (support channel challenge):  
  https://discord.gg/RXYHBJceMe

Di channel ini peserta bisa:
- tanya teknis
- cari teammate
- share ide
- menerima announcement resmi

## 13. Checklist Submission Praktis

- [ ] App berjalan end-to-end (tanpa mock data pada flow inti)
- [ ] Deploy ke Arbitrum Sepolia/Arbitrum
- [ ] Integrasi NOX + Confidential Tokens nyata
- [ ] Repo publik + README + dokumentasi deploy/usage
- [ ] Frontend fungsional
- [ ] Video demo <= 4 menit
- [ ] X post berisi deskripsi + demo + link repo
- [ ] Tag `@iEx_ec` dan `@Chain_GPT`
- [ ] `feedback.md` tersedia di root repo

