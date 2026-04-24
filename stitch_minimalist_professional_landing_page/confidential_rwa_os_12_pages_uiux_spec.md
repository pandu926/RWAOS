# Confidential RWA OS — 12 Halaman MVP UI/UX Blueprint

**Versi Dokumen:** 1.0  
**Tanggal:** 2026-04-22  
**Status:** Ready for Product Design & MVP Build  
**Target Pembaca:** Founder, Product Owner, UI/UX Designer, Frontend Engineer, Backend Engineer, Technical Lead  
**Konteks Stack:** Frontend React, Backend Rust + Axum, Database PostgreSQL  

---

# 1. Tujuan Dokumen

Dokumen ini mendefinisikan **12 halaman inti** untuk MVP **Confidential RWA OS** yang ditujukan untuk:
- submission hackathon yang benar-benar berjalan,
- menjadi fondasi product yang dapat diteruskan ke pilot production,
- memberi acuan detail bagi perancangan UI/UX,
- menyelaraskan ekspektasi product, engineering, dan demo narrative.

Dokumen ini sengaja fokus pada:
- struktur halaman,
- isi tiap halaman,
- komponen UI,
- state UX,
- perilaku sistem,
- validasi,
- role visibility,
- dependency data.

Dokumen ini **tidak** berfokus pada coding tutorial atau source code panjang.

---

# 2. Prinsip MVP 12 Halaman

## Tujuan MVP
MVP ini harus mampu memperlihatkan bahwa solusi berikut **benar-benar hidup**:
1. issuer/admin dapat mengelola asset confidential,
2. transfer asset dapat dilakukan,
3. nominal transfer / balance tidak terbuka ke publik,
4. selective disclosure dapat diberikan ke pihak tertentu,
5. aktivitas dapat diaudit,
6. aplikasi terasa seperti product sungguhan, bukan demo mock.

## Prinsip desain
- **Sedikit halaman, dalam fungsi.**
- **Flow end-to-end lebih penting daripada banyak menu.**
- **Setiap halaman harus punya tujuan tunggal yang jelas.**
- **Setiap halaman harus punya empty state, loading state, error state, dan success state.**
- **Role-based visibility harus konsisten.**
- **Navigasi harus sederhana dan tidak memecah fokus user.**

## Role utama untuk MVP
- **Admin / Issuer**: mengelola asset, transfer, disclosure, report, settings.
- **Operator / Finance**: menjalankan transfer dan monitoring operasional.
- **Auditor / Reviewer**: melihat data tertentu jika mendapat disclosure access.
- **Investor / Holder**: melihat asset miliknya dan histori terkait sesuai hak akses.

## Asumsi
- MVP fokus pada satu organisasi/issuer terlebih dahulu.
- Belum multi-tenant penuh.
- Belum perlu marketplace terbuka.
- Autentikasi dapat dimulai dari wallet-based auth dengan role mapping backend.
- Network target dapat disiapkan di Sepolia Arbitrum untuk demo/hackathon.

## Hal yang perlu divalidasi
- Apakah investor persona benar-benar perlu login di MVP, atau cukup direpresentasikan sebagai address dengan role-based access?
- Apakah create asset perlu jadi halaman sendiri atau cukup lewat seeded asset untuk mengurangi scope?
- Seberapa jauh auditor perlu export/report capability pada MVP?

---

# 3. Ringkasan 12 Halaman

| No | Route | Nama Halaman | Fokus Utama | Persona Dominan |
|---|---|---|---|---|
| 1 | `/` | Landing | Menjelaskan value proposition | Semua |
| 2 | `/login` | Login | Autentikasi & akses role | Semua |
| 3 | `/dashboard` | Dashboard | Ringkasan operasional | Admin, Operator |
| 4 | `/assets` | Assets List | Daftar asset | Admin, Operator |
| 5 | `/assets/:id` | Asset Detail | Detail asset & aksi terkait | Admin, Operator, Auditor |
| 6 | `/investors` | Investors | Daftar holder/investor | Admin, Operator |
| 7 | `/transfers` | Transfers | Histori transfer | Admin, Operator, Auditor |
| 8 | `/transfers/new` | Create Transfer | Eksekusi transfer confidential | Admin, Operator |
| 9 | `/disclosures` | Disclosures | Grant/revoke akses data | Admin |
| 10 | `/audit` | Audit View | Jejak audit & verifikasi | Admin, Auditor |
| 11 | `/reports` | Reports | Ringkasan business & compliance | Admin, Auditor |
| 12 | `/settings` | Settings | Konfigurasi organisasi & sistem | Admin |

---

# 4. Struktur Navigasi Global

## 4.1 Layout aplikasi
Aplikasi sebaiknya menggunakan **app shell** yang konsisten agar terasa production-ready walau hanya 12 halaman.

### Sidebar kiri
Menu utama:
- Dashboard
- Assets
- Investors
- Transfers
- Disclosures
- Audit
- Reports
- Settings

### Topbar
Elemen topbar:
- nama organisasi,
- badge environment/network,
- wallet address singkat,
- role badge,
- quick notifications,
- user menu/logout.

### Main content area
Konten tiap halaman ditampilkan di area utama dengan pola:
- page header,
- contextual action,
- filter/sort jika perlu,
- konten utama,
- secondary panel jika perlu,
- feedback area (toast/inline alerts).

## 4.2 Komponen global yang sebaiknya konsisten
- **Breadcrumb** untuk halaman detail.
- **Status badge** dengan warna konsisten.
- **Action button hierarchy**: primary, secondary, destructive.
- **Toast notification** untuk success/error.
- **Confirmation modal** untuk action sensitif.
- **Access denied state** untuk role yang tidak berhak.
- **Inline help / tooltip** untuk istilah confidential/disclosure.

## 4.3 Global states
Setiap halaman minimal harus memperhatikan state berikut:
- loading initial data,
- refreshing state,
- empty state,
- no permission state,
- validation error state,
- backend/network error state,
- success state.

---

# 5. Detail Halaman

---

## Halaman 1 — `/` — Landing Page

## Tujuan halaman
Landing page berfungsi sebagai:
- pembuka narasi solusi,
- penjelas problem yang diselesaikan,
- validasi bahwa app ini bukan sekadar token UI,
- pintu masuk ke login.

Pada hackathon, halaman ini juga berfungsi sebagai **pembingkai demo** agar juri langsung memahami konteks produk sebelum masuk ke aplikasi.

## Target user
- juri hackathon,
- calon user bisnis,
- founder/internal stakeholder,
- user yang belum login.

## Outcome yang diharapkan
Setelah melihat halaman ini, user harus memahami dalam < 20 detik:
- produk ini tentang apa,
- masalah apa yang diselesaikan,
- siapa yang akan mendapat manfaat,
- mengapa confidential transfer dan selective disclosure penting.

## Struktur konten

### A. Hero section
Isi:
- headline utama,
- subheadline yang jelas,
- dua CTA,
- visual product mockup ringan.

Contoh struktur:
- Headline: **Confidential Asset Infrastructure for Tokenized Finance**
- Subheadline: **Kelola asset dan transfer on-chain tanpa membuka nominal, saldo, atau alokasi ke publik.**
- Primary CTA: **Masuk ke Aplikasi**
- Secondary CTA: **Lihat Konsep Solusi**

### B. Problem block
Tujuan:
menjelaskan problem market dengan bahasa singkat.

Isi:
- public blockchain terlalu transparan,
- asset movement mudah dipantau,
- issuer butuh privacy + auditability,
- tokenized finance perlu selective disclosure.

### C. Solution block
Tiga kartu solusi:
- Confidential Asset Management
- Private Transfers
- Selective Disclosure & Auditability

### D. Use case block
Contoh use case:
- tokenized treasury unit,
- confidential fund unit transfer,
- private internal treasury movement,
- controlled auditor access.

### E. Product trust block
Isi singkat:
- dibangun untuk public chain,
- transaction state nyata,
- access control berbasis role,
- siap menjadi fondasi pilot.

## Komponen UI
- Hero text block
- CTA buttons
- Feature cards
- Problem/solution section
- Simple architecture illustration
- Footer mini dengan environment/network note

## Perilaku halaman
- Public page
- Tidak membutuhkan login
- CTA login mengarah ke `/login`
- CTA eksplorasi dapat scroll ke section bawah atau anchor

## State yang perlu ada
- normal state,
- mobile responsive state,
- fallback state jika image/illustration gagal dimuat.

## Catatan UX
- Jangan terlalu banyak teks.
- Pastikan istilah “confidential” tidak ambigu; beri subtitle yang membumi.
- Landing page harus terasa kredibel, bukan marketing bombastis.
- Untuk hackathon, jaga narasi tetap tajam pada satu masalah inti.

## Data dependency
- Tidak membutuhkan backend wajib.
- Dapat statis.

## Catatan visual
- Dominan clean enterprise UI.
- Jangan terlalu Web3 noisy.
- Gunakan visual yang mengarah ke “control panel” bukan “trading app”.

---

## Halaman 2 — `/login` — Login Page

## Tujuan halaman
Mengizinkan user masuk ke aplikasi dan menghubungkan identitas wallet/address dengan role sistem.

## Target user
- admin,
- operator,
- auditor,
- investor/holder yang diizinkan.

## Outcome yang diharapkan
- user berhasil login,
- role dikenali,
- user diarahkan ke dashboard sesuai context.

## Struktur konten

### A. Login card
Isi:
- judul halaman,
- penjelasan singkat tentang requirement koneksi,
- tombol connect wallet,
- informasi network,
- bantuan jika akses belum diberikan.

### B. Access note
Isi:
- hanya address yang telah di-whitelist yang dapat masuk,
- user tanpa akses akan melihat pesan terbatas.

### C. Optional support block
Isi:
- kontak admin/internal,
- petunjuk jika wallet salah network.

## Komponen UI
- Connect wallet button
- Network status indicator
- Wallet connected summary
- Role preview label
- Error alert area
- Loading spinner

## Validasi
- wallet harus terkoneksi,
- network harus sesuai,
- address harus dikenal backend,
- session harus berhasil dibuat.

## Perilaku halaman
1. User klik connect wallet.
2. Wallet connect berhasil.
3. Frontend kirim address/signature ke backend.
4. Backend validasi mapping role.
5. Jika valid, session/token dibuat.
6. Redirect ke `/dashboard`.

## State yang perlu ada
- idle state,
- connecting wallet,
- wallet connected but role pending,
- wrong network,
- unauthorized address,
- backend unavailable,
- success redirect.

## Error messages yang harus jelas
- “Wallet belum terkoneksi.”
- “Network tidak sesuai. Pindahkan ke Arbitrum Sepolia.”
- “Address Anda belum memiliki akses ke organisasi ini.”
- “Terjadi gangguan saat membuat sesi. Coba lagi.”

## Catatan UX
- Jangan memaksa terlalu banyak langkah.
- Hackathon flow harus mulus: connect → masuk.
- Bila unauthorized, jangan langsung hard fail; beri penjelasan next step.

## Data dependency
- endpoint auth login/challenge,
- endpoint session profile,
- role mapping data.

---

## Halaman 3 — `/dashboard` — Dashboard

## Tujuan halaman
Memberi ringkasan sistem dan menjadi titik awal navigasi operasional.

## Target user
- admin,
- operator,
- auditor (dengan konten terbatas).

## Outcome yang diharapkan
- user melihat kondisi platform saat ini,
- tahu action penting berikutnya,
- dapat masuk ke workflow utama tanpa kebingungan.

## Struktur konten

### A. Page header
Isi:
- judul: Dashboard,
- deskripsi singkat,
- timestamp last updated.

### B. KPI summary cards
Minimal 4 kartu:
- Total Assets
- Active Investors / Holders
- Total Transfers
- Pending Disclosures / Pending Actions

Optional tambahan:
- compliance alerts,
- failed operations count.

### C. Recent activity feed
Daftar aktivitas terbaru:
- transfer dibuat,
- disclosure diberikan,
- akses dicabut,
- status asset berubah.

### D. Quick action panel
Tombol cepat:
- Create Transfer
- View Assets
- Manage Disclosures
- Open Reports

### E. Alerts / risk panel
Isi:
- transfer gagal,
- address belum whitelist,
- pending issue,
- network issue.

## Komponen UI
- Summary cards
- Activity timeline/feed
- Quick action buttons
- Alert banner(s)
- Refresh control

## Role visibility
- **Admin**: melihat semua summary.
- **Operator**: melihat aktivitas operasional.
- **Auditor**: melihat hanya area audit/reports yang diizinkan.
- **Investor**: bila diaktifkan pada MVP, dashboard sebaiknya sangat sederhana.

## Perilaku halaman
- load summary data dari backend,
- tampilkan aktivitas terbaru,
- aksi cepat mengarah ke halaman operasional.

## State yang perlu ada
- loading skeleton cards,
- no activity state,
- partial data unavailable,
- permission-restricted cards,
- refresh success.

## Catatan UX
- Dashboard tidak boleh terlalu padat.
- Fokus dashboard adalah orientasi, bukan semua detail.
- Gunakan bahasa status yang mudah dipahami non-technical user.

## Data dependency
- summary aggregates,
- recent activity list,
- pending issues/disclosures,
- profile/role.

---

## Halaman 4 — `/assets` — Assets List

## Tujuan halaman
Menampilkan daftar asset yang dikelola organisasi.

## Target user
- admin,
- operator,
- auditor (read-only subset).

## Outcome yang diharapkan
- user dapat menemukan asset,
- memahami status masing-masing asset,
- masuk ke detail asset dengan cepat.

## Struktur konten

### A. Header
Isi:
- judul halaman,
- jumlah total asset,
- deskripsi singkat,
- tombol aksi jika diperlukan.

### B. Search & filter row
Filter minimal:
- search by asset name/symbol,
- filter status,
- filter asset type.

### C. Assets table / list
Kolom minimal:
- Asset Name
- Symbol / Code
- Asset Type
- Status
- Holders Count
- Last Activity
- Actions

Catatan:
- total supply bisa ditampilkan sebagai **restricted / confidential** bila perlu,
- hindari memaksa semua angka terbuka.

### D. Empty state
Jika belum ada asset:
- jelaskan sistem belum punya asset,
- arahkan ke seeded data atau create flow jika ada.

## Komponen UI
- Search input
- Filter dropdown(s)
- Sort control
- Data table
- Pagination / infinite list sederhana
- Action menu per row

## Aksi utama
- View Asset Detail
- Copy asset address/identifier
- Open transfers related to asset

## State yang perlu ada
- loading table,
- empty state,
- no search result,
- API error state,
- permission-limited columns.

## Catatan UX
- Table harus mudah discan.
- Asset status harus konsisten warna/labelnya.
- Jangan terlalu banyak kolom di MVP.
- Gunakan row click + action menu secukupnya.

## Data dependency
- list assets,
- filters meta,
- status enum,
- last activity summary.

---

## Halaman 5 — `/assets/:id` — Asset Detail

## Tujuan halaman
Menjadi pusat informasi untuk satu asset dan gateway ke workflow terkait asset tersebut.

## Target user
- admin,
- operator,
- auditor dengan akses tertentu.

## Outcome yang diharapkan
Setelah masuk ke halaman ini, user bisa:
- memahami identitas asset,
- melihat status dan metadata penting,
- meninjau aktivitas terkait,
- mengeksekusi action yang relevan.

## Struktur konten

### A. Header area
Isi:
- asset name,
- symbol/code,
- status badge,
- asset type,
- primary actions.

Primary action yang disarankan:
- Create Transfer
- Grant Disclosure
- View Audit Trail

### B. Asset summary cards
Kartu ringkas:
- Asset Status
- Total Holders
- Recent Transfer Count
- Disclosure Rules Active

### C. Main content tabs
Disarankan tiga tab agar halaman tetap rapi.

#### Tab 1 — Overview
Isi:
- deskripsi asset,
- metadata asset,
- issuance info,
- operational status,
- basic ownership visibility (tanpa membuka data sensitif ke role yang tidak boleh).

#### Tab 2 — Activity
Isi:
- daftar transfer terkait asset,
- event log terkait asset,
- state changes.

#### Tab 3 — Access / Disclosure
Isi:
- siapa punya akses lihat data tertentu,
- disclosure status,
- shortcut ke manage disclosure.

## Komponen UI
- Breadcrumb
- Header with action buttons
- Status badges
- Summary cards
- Tabs
- Related activity list
- Inline access note

## Aksi utama
- Create transfer for this asset
- Go to disclosures page filtered by asset
- Copy asset info / contract reference

## Role visibility
- **Admin**: semua area terlihat.
- **Operator**: bisa melihat operasional, disclosure ringkas.
- **Auditor**: hanya data yang diotorisasi.
- **Unauthorized role**: overview terbatas atau access denied.

## State yang perlu ada
- asset not found,
- permission denied,
- no activity yet,
- disclosure empty state,
- refreshing data,
- partial backend failure.

## Catatan UX
- Jangan campur semua informasi jadi satu scroll panjang tanpa struktur.
- Gunakan tab jika kontennya cukup padat.
- Tampilkan access note dengan jelas, misalnya: “Some values are hidden based on your access level.”

## Data dependency
- asset detail,
- asset activity,
- disclosure summary,
- role-based visibility rules.

---

## Halaman 6 — `/investors` — Investors / Holders List

## Tujuan halaman
Menampilkan daftar investor/holder/address yang terkait dengan organisasi atau asset tertentu.

## Target user
- admin,
- operator,
- compliance-like role (jika ada di MVP).

## Outcome yang diharapkan
- user dapat menemukan address/holder,
- melihat status akses dan whitelist,
- memahami siapa aktor utama dalam sistem.

## Struktur konten

### A. Header
Isi:
- judul halaman,
- jumlah investors/holders,
- deskripsi singkat.

### B. Filter row
Filter minimal:
- search by wallet/address/name alias,
- filter by status whitelist,
- filter by role.

### C. Investors table
Kolom minimal:
- Address / Name Alias
- Role
- Whitelist Status
- Assets Count
- Last Activity
- Actions

### D. Inline actions
Action yang relevan:
- view related transfers,
- filter disclosures by investor,
- copy wallet address.

## Komponen UI
- Search field
- Filter pills/dropdowns
- Table
- Row action menu
- Status chips

## Catatan data sensitif
- Jangan tampilkan balance detail di sini jika tidak dibutuhkan.
- Fokus halaman ini adalah **identity and eligibility**, bukan portfolio exposure penuh.

## State yang perlu ada
- loading table,
- no investor found,
- no whitelist results,
- backend error,
- restricted information notice.

## Catatan UX
- Untuk MVP, tidak wajib punya investor detail page jika ingin menjaga scope.
- Table harus cukup informatif agar investor detail page tidak wajib.

## Data dependency
- holders list,
- roles/whitelist status,
- related counts.

---

## Halaman 7 — `/transfers` — Transfers List

## Tujuan halaman
Menampilkan histori transfer dan menjadi pusat monitoring transaksi confidential.

## Target user
- admin,
- operator,
- auditor (tergantung akses).

## Outcome yang diharapkan
- user dapat melihat status transfer,
- memfilter transaksi,
- memahami apakah operasi berjalan sukses atau gagal.

## Struktur konten

### A. Header
Isi:
- judul halaman,
- jumlah transfer,
- tombol create transfer.

### B. Filter & search
Filter minimal:
- by asset,
- by status,
- by date range,
- by sender/recipient.

### C. Transfers table
Kolom minimal:
- Transfer ID / Ref
- Asset
- From
- To
- Amount Visibility
- Status
- Timestamp
- Actions

Catatan amount:
- untuk role yang tidak diizinkan, tampilkan **Hidden**,
- untuk role yang diizinkan, tampilkan nilai sesuai disclosure policy.

### D. Transfer status explanation block
Berguna untuk MVP agar status tidak ambigu.
Contoh status:
- Pending
- Submitted
- Confirmed
- Failed
- Rejected

## Komponen UI
- Search input
- Advanced filter drawer/modal (optional)
- Table
- Status badges
- Row action menu
- Export button (opsional ringan)

## Aksi utama
- Open create transfer
- View audit related logs
- Filter related to asset/investor

## State yang perlu ada
- loading table,
- empty state,
- filtered empty state,
- failed fetch state,
- partially hidden data state.

## Catatan UX
- Status harus sangat jelas.
- Jangan biarkan user bingung apakah transfer sukses atau hanya tersubmit.
- Row detail dapat menggunakan modal ringan bila tidak ingin menambah route baru.

## Data dependency
- transfer list,
- status metadata,
- role-based field masking,
- filter options.

---

## Halaman 8 — `/transfers/new` — Create Transfer

## Tujuan halaman
Menjadi halaman paling penting dalam MVP: menjalankan transfer confidential yang nyata.

## Target user
- admin,
- operator.

## Outcome yang diharapkan
- user bisa memilih asset,
- memilih recipient,
- memasukkan nominal,
- sistem memproses transfer dengan alur yang jelas,
- user menerima feedback sukses/gagal yang dapat dipercaya.

## Posisi halaman ini
Ini adalah **core demo page**. Jika halaman ini buruk, MVP kehilangan nilai utamanya.

## Struktur konten

### A. Header
Isi:
- judul halaman,
- deskripsi singkat tentang transfer confidential,
- link kembali ke transfers list.

### B. Transfer form
Field minimal:
- Select Asset
- Recipient Address / Select Investor
- Amount
- Optional Reference / Note

### C. Transfer preview panel
Sebelum submit, tampilkan ringkasan:
- asset terpilih,
- recipient,
- visibility note,
- disclosure implication (jika ada),
- network info.

### D. Submission state panel
Saat submit:
- show progress steps,
- show tx pending status,
- show final confirmation/error.

## Komponen UI
- Form card
- Asset selector
- Recipient selector/search
- Amount input
- Note/reference input
- Preview box
- Submit button
- Progress indicator

## Validasi form
- asset wajib dipilih,
- recipient wajib valid,
- amount wajib valid,
- recipient harus eligible/whitelisted jika policy mengharuskan,
- amount > 0,
- user harus punya role yang boleh transfer.

## Validasi bisnis
- asset status harus active,
- transfer tidak boleh ke recipient terlarang,
- amount tidak boleh melanggar policy limit jika ada,
- request harus ditandatangani dengan benar.

## State yang perlu ada
- pristine empty form,
- validation inline errors,
- loading recipients/assets,
- submit in progress,
- pending confirmation,
- success confirmation,
- failed submission,
- on-chain/backend mismatch handling.

## Pesan sukses yang harus baik
Contoh:
- “Transfer berhasil diajukan.”
- “Transfer telah dikonfirmasi.”
- “Data amount tetap tidak terlihat bagi pihak yang tidak memiliki akses.”

## Pesan error yang harus jelas
Contoh:
- “Recipient tidak memenuhi syarat whitelist.”
- “Asset tidak aktif untuk transfer.”
- “Terjadi kegagalan saat mengirim transaksi. Silakan coba lagi.”
- “Transfer belum terkonfirmasi. Cek kembali status di daftar transfer.”

## Catatan UX sangat penting
- Gunakan step clarity walau halaman satu layar.
- Jangan membuat user takut submit.
- Preview sebelum submit sangat penting untuk mencegah kesalahan.
- Untuk demo hackathon, progress state harus sangat meyakinkan.

## Data dependency
- list asset,
- investor/recipient list,
- policy/eligibility checks,
- transfer submit endpoint,
- transaction status tracking.

---

## Halaman 9 — `/disclosures` — Disclosures Management

## Tujuan halaman
Mengelola akses selective disclosure: siapa boleh melihat data tertentu dan dalam konteks apa.

## Target user
- admin utama,
- compliance-like operator terbatas.

## Outcome yang diharapkan
- admin dapat memahami daftar access grant aktif,
- dapat memberi akses baru,
- dapat mencabut akses,
- dapat menjelaskan kepada juri/user bahwa sistem tidak hanya privat, tetapi juga auditable.

## Struktur konten

### A. Header
Isi:
- judul halaman,
- deskripsi singkat,
- tombol Grant Access.

### B. Disclosure summary cards
Kartu ringkas:
- Active Grants
- Assets with Disclosures
- Auditors / Reviewers with Access
- Recent Changes

### C. Disclosure table
Kolom minimal:
- Access Grantee (address/role)
- Related Asset
- Scope of Access
- Granted By
- Granted At
- Status
- Actions

### D. Grant access modal / drawer
Field minimal:
- Grantee address / role
- Asset
- Scope
- Duration / status note (optional)

### E. Revoke confirmation modal
Destruktif, harus konfirmasi jelas.

## Komponen UI
- Summary cards
- Data table
- Primary action button
- Modal/drawer for grant
- Confirmation modal for revoke
- Filter/search

## Scope disclosure yang dapat dimodelkan untuk MVP
Contoh scope:
- View specific asset balances
- View transfer amounts for asset X
- Audit read access for address Y

Tidak perlu terlalu kompleks. Lebih baik sederhana tapi nyata.

## State yang perlu ada
- loading list,
- empty state,
- no grants yet,
- grant success,
- revoke success,
- revoke failed,
- duplicate grant attempt,
- restricted role access.

## Catatan UX
- Ini adalah halaman “wow factor” kedua setelah transfer.
- Visualisasikan konsep privilege dengan sederhana.
- Gunakan wording yang mudah dipahami: “Can view transfer amounts for Asset A”.

## Data dependency
- disclosures list,
- assets list,
- grantee list,
- grant/revoke endpoints.

---

## Halaman 10 — `/audit` — Audit View

## Tujuan halaman
Memberi ruang bagi review operasional dan audit trail yang dapat diverifikasi.

## Target user
- admin,
- auditor,
- internal reviewer.

## Outcome yang diharapkan
- user dapat melihat jejak perubahan penting,
- dapat memahami siapa melakukan apa,
- dapat menelusuri event tanpa membuka semua data ke publik.

## Struktur konten

### A. Header
Isi:
- judul halaman,
- penjelasan singkat fungsi audit,
- filter bar.

### B. Audit log table / timeline
Kolom minimal:
- Event Type
- Actor
- Target Entity
- Timestamp
- Visibility Level
- Reference

Contoh event:
- Transfer Created
- Transfer Confirmed
- Disclosure Granted
- Disclosure Revoked
- Access Attempt Failed
- Settings Updated

### C. Audit filter panel
Filter minimal:
- by event type,
- by actor,
- by asset,
- by time range.

### D. Event detail side panel / modal
Ketika row dipilih, tampilkan detail event:
- actor,
- target,
- time,
- contextual notes,
- access visibility note.

## Komponen UI
- Filter toolbar
- Timeline/table
- Event detail drawer
- Copy reference button
- Status/visibility tag

## State yang perlu ada
- loading logs,
- no logs,
- no result from filters,
- restricted detail state,
- failed load.

## Catatan UX
- Audit halaman harus terasa “serius” dan terpercaya.
- Jangan terlalu visual eksperimental; prioritaskan kejelasan.
- Bisa gunakan timeline atau table, tetapi table biasanya lebih efisien untuk scan cepat.

## Data dependency
- audit events,
- filter metadata,
- role-based access masking.

---

## Halaman 11 — `/reports` — Reports

## Tujuan halaman
Menampilkan ringkasan business/compliance yang lebih mudah dikonsumsi oleh stakeholder non-operasional.

## Target user
- admin,
- founder,
- auditor,
- stakeholder internal.

## Outcome yang diharapkan
- user dapat memahami kondisi sistem secara ringkas,
- dapat menjawab pertanyaan “apa yang terjadi dalam periode tertentu?”,
- dapat menunjukkan bahwa aplikasi punya sisi reporting, bukan hanya transaksi.

## Struktur konten

### A. Header
Isi:
- judul halaman,
- period selector,
- export/light share action (opsional ringan).

### B. KPI cards
Contoh:
- Total Transfers This Period
- Active Assets
- Active Holders
- Disclosure Actions

### C. Charts / summaries
Gunakan secukupnya, jangan berlebihan.
Contoh:
- transfer volume trend (tanpa membuka data yang tak boleh tampil),
- count of operational events,
- asset activity comparison.

### D. Tabular summaries
Tabel ringkas:
- per asset activity,
- status summary,
- access/disclosure summary.

## Komponen UI
- Date range selector
- KPI cards
- 1–2 simple charts
- Summary table
- Export action (optional)

## State yang perlu ada
- loading report,
- no data in selected period,
- restricted chart data,
- export unavailable,
- backend error.

## Catatan UX
- Report page bukan BI dashboard penuh.
- Cukup tampilkan insight yang mendukung narasi product.
- Gunakan chart seminimal mungkin agar tidak terasa fake.

## Data dependency
- aggregated metrics,
- period filters,
- role-aware masking.

---

## Halaman 12 — `/settings` — Settings

## Tujuan halaman
Menjadi tempat konfigurasi dasar organisasi dan sistem pada MVP.

## Target user
- admin.

## Outcome yang diharapkan
- admin dapat melihat konfigurasi penting,
- admin dapat mengelola parameter dasar,
- halaman ini menutup loop product agar terasa operasional dan production-minded.

## Struktur konten

### A. Header
Isi:
- judul halaman,
- deskripsi bahwa beberapa perubahan berdampak operasional.

### B. Organization settings section
Field contoh:
- Organization name
- Environment label
- Support contact

### C. Access & role settings section
Isi:
- daftar role aktif,
- penjelasan hak akses ringkas,
- who can transfer,
- who can manage disclosure.

### D. Network / system settings section
Isi:
- active network,
- environment note,
- API/backend health summary ringan.

### E. Security / operational notes
Isi:
- last config update,
- updated by,
- warning banner jika ada perubahan sensitif.

## Komponen UI
- Section cards
- Read-only and editable fields
- Save button
- Confirmation modal for sensitive changes
- Inline validation

## State yang perlu ada
- loading settings,
- save in progress,
- save success,
- validation error,
- permission denied,
- partial failure.

## Catatan UX
- Settings harus sederhana.
- Jangan menaruh terlalu banyak konfigurasi teknis di MVP.
- Fokus pada yang mendukung demo dan operasional dasar.

## Data dependency
- org settings,
- role configuration summary,
- environment summary.

---

# 6. Cross-Page Design Rules

## 6.1 Konsistensi istilah
Gunakan istilah yang konsisten di seluruh aplikasi:
- Asset
- Transfer
- Disclosure
- Audit
- Holder / Investor
- Role
- Status

Hindari berganti-ganti istilah seperti:
- permission vs access vs visibility tanpa definisi jelas,
- holder vs investor jika konteksnya sama.

## 6.2 Status system
Buat enumerasi status yang seragam.

### Contoh status asset
- Active
- Paused
- Restricted
- Archived

### Contoh status transfer
- Draft (optional, jika dipakai)
- Submitted
- Pending
- Confirmed
- Failed
- Rejected

### Contoh status disclosure
- Active
- Revoked
- Expired (optional)

## 6.3 Visibility language
Untuk data sensitif, gunakan wording yang konsisten:
- Hidden
- Restricted
- Visible to authorized users only
- Confidential

## 6.4 Empty states
Setiap halaman perlu empty state yang bukan sekadar kosong.

Contoh pola:
- jelaskan mengapa belum ada data,
- beri langkah berikutnya,
- beri CTA bila relevan.

## 6.5 Error states
Error copy harus operasional, bukan teknis mentah.

Contoh:
- “Kami tidak dapat memuat daftar transfer saat ini.”
- “Coba muat ulang dalam beberapa saat.”
- “Jika masalah berlanjut, hubungi admin sistem.”

---

# 7. Komponen Desain yang Direkomendasikan

## Komponen wajib
- App shell layout
- Sidebar navigation
- Topbar
- Summary cards
- Data table reusable
- Status badge
- Search/filter toolbar
- Form fields reusable
- Modal & drawer
- Toast notifications
- Empty state component
- Error state component
- Skeleton loader
- Access notice banner

## Komponen opsional tetapi berguna
- Timeline component for audit
- Step indicator for transfer submission
- Inline help tooltip
- Copy-to-clipboard control

---

# 8. Data Model View untuk UI/UX

Bagian ini bukan schema database penuh, tetapi membantu desainer memahami entity utama.

## Entity utama
- **User**
- **Role**
- **Organization**
- **Asset**
- **Transfer**
- **Disclosure Grant**
- **Audit Event**
- **Report Aggregate**

## Relasi sederhana
- Satu organization memiliki banyak asset.
- Satu asset memiliki banyak transfer.
- Satu transfer terkait satu asset dan dua aktor utama.
- Satu disclosure grant memberi access tertentu kepada actor tertentu untuk asset atau scope tertentu.
- Banyak audit events tercatat dari tindakan di atas.

## Dampak ke UI
- Asset detail harus mampu memanggil transfer dan disclosure terkait.
- Transfers page harus bisa difilter berdasarkan asset dan aktor.
- Disclosures harus dapat dikaitkan ke asset dan grantee.
- Audit page harus bisa merujuk ke entity target.

---

# 9. Blueprint Interaksi Inti

## 9.1 Flow inti 1 — Login ke dashboard
1. User membuka landing.
2. User klik login.
3. Wallet terkoneksi.
4. Sistem validasi akses.
5. User diarahkan ke dashboard.

## 9.2 Flow inti 2 — View asset lalu create transfer
1. User buka dashboard.
2. User masuk ke assets.
3. User pilih asset.
4. User klik create transfer.
5. User isi recipient dan amount.
6. User review preview.
7. User submit.
8. User melihat status transfer.
9. Transfer tercatat di transfers dan audit.

## 9.3 Flow inti 3 — Grant disclosure
1. Admin buka disclosures.
2. Admin klik grant access.
3. Admin pilih grantee dan asset.
4. Admin tentukan scope.
5. Admin submit.
6. Disclosure tercatat.
7. Auditor kini dapat melihat data tertentu.

## 9.4 Flow inti 4 — Audit verification
1. Auditor login.
2. Auditor buka audit.
3. Auditor filter event yang relevan.
4. Auditor melihat detail event.
5. Auditor membuka reports jika dibutuhkan.

---

# 10. Prioritas Desain untuk 30 Hari

## Prioritas Tier 1 — Wajib paling bagus
- Login
- Dashboard
- Assets list
- Asset detail
- Transfers list
- Create transfer
- Disclosures

## Prioritas Tier 2 — Harus cukup rapi
- Investors
- Audit
- Reports
- Settings

## Prioritas Tier 3 — Nice to refine jika ada waktu
- Landing polish
- subtle animation
- advanced filtering
- export/report improvement

---

# 11. Guidance UI/UX per Persona

## Admin
Butuh:
- overview cepat,
- kendali jelas,
- akses ke semua workflow penting,
- feedback bahwa aksi berhasil.

## Operator
Butuh:
- task-oriented screens,
- validasi kuat,
- status transaksi jelas,
- sedikit distraksi.

## Auditor
Butuh:
- trustable log,
- data relevan,
- access explanation,
- consistency.

## Investor/Holder
Pada MVP, kebutuhan utamanya jika diaktifkan:
- melihat status dirinya,
- melihat asset yang relevan,
- tidak perlu terlalu banyak kontrol.

---

# 12. Checklist Kualitas UI/UX sebelum Build

## Checklist struktur
- [ ] Semua 12 halaman punya tujuan tunggal yang jelas.
- [ ] Navigasi utama tidak membingungkan.
- [ ] Tidak ada halaman yang hanya dekoratif.
- [ ] Semua route punya hubungan logis.

## Checklist konten
- [ ] Istilah confidential dijelaskan secara sederhana.
- [ ] Status system konsisten.
- [ ] Error messages terbaca manusia.
- [ ] CTA utama di tiap halaman jelas.

## Checklist state
- [ ] Ada loading state.
- [ ] Ada empty state.
- [ ] Ada error state.
- [ ] Ada permission state.
- [ ] Ada success feedback.

## Checklist demo readiness
- [ ] Flow login lancar.
- [ ] Flow transfer bisa didemokan tanpa kebingungan.
- [ ] Flow disclosure mudah dipahami juri.
- [ ] Audit trail terlihat nyata.
- [ ] Dashboard dan reports memperkuat narasi, bukan sekadar hiasan.

---

# 13. Rekomendasi Urutan Desain Figma / UI Build

Urutan terbaik agar efisien:
1. App shell + design system mini
2. Login
3. Dashboard
4. Assets list
5. Asset detail
6. Transfers list
7. Create transfer
8. Disclosures
9. Audit
10. Reports
11. Investors
12. Settings
13. Landing

Alasan:
- flow inti lebih cepat hidup,
- reuse komponen lebih tinggi,
- demo value muncul lebih cepat,
- tim tidak terjebak polishing terlalu awal.

---

# 14. Penutup

Untuk hackathon 30 hari, **12 halaman ini cukup** asalkan:
- setiap halaman benar-benar punya fungsi,
- flow inti transfer dan disclosure hidup,
- tidak bergantung pada mock semata,
- UI/UX dirancang untuk memperjelas nilai produk, bukan sekadar mempercantik layar.

Dokumen ini dirancang agar bisa dipakai langsung sebagai:
- blueprint Figma,
- referensi implementasi React,
- referensi endpoint/backend planning,
- dasar review bersama founder, designer, dan engineer.

Jika fase berikutnya dibutuhkan, dokumen ini dapat diperluas menjadi:
- wireframe specification,
- API mapping per halaman,
- component inventory,
- user flow diagram,
- acceptance criteria per screen.
