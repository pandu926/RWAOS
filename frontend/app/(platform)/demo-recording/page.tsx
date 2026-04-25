import { Button, DetailList, InlineNotice, PageHeader, SectionCard, StatusBadge } from "@/components/ui";

export const dynamic = "force-dynamic";

const recordingSteps = [
  {
    scene: "Scene 1",
    title: "Pembukaan dan konteks produk",
    route: "/dashboard",
    duration: "10-15 detik",
    focus:
      "Tampilkan bahwa platform ini untuk transfer aset RWA secara confidential, tapi tetap audit-ready.",
    show: [
      "Header dashboard",
      "Live backend snapshot",
      "Operations queue",
    ],
    narration:
      "Ini adalah Confidential RWA OS. Fokusnya adalah transfer aset privat dengan selective disclosure dan jejak audit yang tetap bisa diverifikasi.",
  },
  {
    scene: "Scene 2",
    title: "Cek data demo yang sudah siap",
    route: "/transfers/new",
    duration: "15-20 detik",
    focus:
      "Pastikan audience melihat bahwa sender, recipient, asset, dan transfer record sudah berasal dari backend yang hidup.",
    show: [
      "Asset demo: Demo Arbitrum Sepolia Treasury Note",
      "Sender: Demo Sender SPV",
      "Recipient: Demo Recipient SPV",
      "Wallet sender dan recipient yang sudah termapping",
    ],
    narration:
      "Untuk demo ini, saya memakai skenario seeded yang sudah siap. Wallet investor sumber dan penerima sudah termapping ke backend, jadi bukan input dummy manual.",
  },
  {
    scene: "Scene 3",
    title: "Tunjukkan readiness transfer",
    route: "/transfers/new",
    duration: "20-30 detik",
    focus:
      "Perlihatkan pre-check sebelum submit agar juri paham kontrol compliance terjadi sebelum transaksi dikirim.",
    show: [
      "Disclosure picker",
      "Readiness checklist",
      "Status operator",
      "Tombol set operator bila diperlukan",
    ],
    narration:
      "Sebelum transfer dijalankan, sistem mengecek disclosure, operator permission, dan payload proof. Jadi yang ditonjolkan bukan sekadar tombol submit, tapi kontrol sebelum transaksi on-chain.",
  },
  {
    scene: "Scene 4",
    title: "Selective disclosure",
    route: "/disclosures",
    duration: "15-20 detik",
    focus:
      "Tunjukkan bahwa akses data sensitif diberikan dengan scope yang jelas, ke wallet atau pihak tertentu.",
    show: [
      "Grantee",
      "Scope disclosure",
      "Expires at",
      "Status Active atau Expired",
    ],
    narration:
      "Di sini terlihat bahwa akses ke data privat tidak dibuka ke semua orang. Disclosure diberikan ke grantee tertentu, punya scope, dan bisa punya masa berlaku.",
  },
  {
    scene: "Scene 5",
    title: "Compliance passport",
    route: "/compliance/passports",
    duration: "20-25 detik",
    focus:
      "Jelaskan bahwa transfer menghasilkan bukti compliance yang bisa diaudit tanpa membuka semua isi transaksi ke publik.",
    show: [
      "Transfer record ID",
      "Transfer ID on-chain",
      "Policy hash",
      "Anchor hash",
      "Disclosure scope",
    ],
    narration:
      "Compliance passport ini menjadi bukti bahwa transfer yang dilakukan punya jejak kebijakan, anchor audit, dan scope disclosure yang jelas.",
  },
  {
    scene: "Scene 6",
    title: "Penutup",
    route: "/audit",
    duration: "10-15 detik",
    focus:
      "Tutup dengan pesan bahwa sistem ini menjaga tiga hal sekaligus: privasi, compliance, dan auditability.",
    show: [
      "Audit trail",
      "Event terbaru",
      "Ringkasan status operasional",
    ],
    narration:
      "Intinya, sistem ini tidak memaksa memilih antara privasi atau kepatuhan. Keduanya dijaga bersama lewat transfer confidential, selective disclosure, dan audit trail.",
  },
];

const sceneChecklist = [
  "Gunakan wallet admin atau operator yang sudah ada di allowlist backend.",
  "Pastikan jaringan wallet berada di Arbitrum Sepolia.",
  "Jangan tampilkan halaman kosong, mulai dari route yang sudah ada data seeded.",
  "Kalau ingin demo aman, fokus ke flow yang sudah seeded: disclosure, transfer readiness, passport, audit.",
  "Siapkan browser dengan zoom 90-100% agar tabel tidak terpotong saat rekam.",
];

const avoidDuringRecording = [
  "Jangan rekam saat ganti network wallet bila tidak perlu.",
  "Jangan mulai dari form kosong yang belum punya investor mapping.",
  "Jangan tampilkan error teknis kecuali memang ingin demo failure handling.",
  "Jangan buka halaman internal yang narasinya belum untuk audience eksternal.",
];

export default function DemoRecordingPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Panduan Demo"
        title="Guide Recording Demo"
        description="Halaman briefing untuk recording video demo dalam bahasa Indonesia. Tujuannya bukan mengganti halaman yang ada, tetapi memberi alur narasi, urutan scene, dan apa yang harus tampil di layar."
        meta={<StatusBadge tone="accent">Bahasa Indonesia</StatusBadge>}
        actions={
          <>
            <Button href="/dashboard" variant="secondary">Mulai dari dashboard</Button>
            <Button href="/transfers/new">Buka flow utama</Button>
          </>
        }
      />

      <InlineNotice
        title="Tujuan halaman ini"
        description="Halaman ini khusus untuk operator atau presenter sebelum recording. Jadi narasi halaman lama tetap dipertahankan, sementara alur demo dijelaskan di sini dalam bahasa Indonesia."
        tone="neutral"
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <SectionCard title="Narasi utama" description="Pesan besar yang harus konsisten sepanjang video.">
          <DetailList
            columns={1}
            items={[
              { label: "Nilai utama", value: "Privasi transaksi tetap terjaga." },
              { label: "Nilai compliance", value: "Selective disclosure dan policy evidence tetap tersedia." },
              { label: "Nilai audit", value: "Setiap langkah penting tetap punya jejak yang bisa diverifikasi." },
            ]}
          />
        </SectionCard>

        <SectionCard title="Skenario demo" description="Data yang sebaiknya dipakai saat recording.">
          <DetailList
            columns={1}
            items={[
              { label: "Asset demo", value: "Demo Arbitrum Sepolia Treasury Note" },
              { label: "Sender", value: "Demo Sender SPV" },
              { label: "Wallet sender", value: "0xEc08da877d409293C006523DB95BA291f43E3249" },
              { label: "Recipient", value: "Demo Recipient SPV" },
              { label: "Disclosure", value: "Demo Confidential Transfer Disclosure" },
            ]}
          />
        </SectionCard>

        <SectionCard title="Struktur video" description="Urutan yang paling aman untuk presentasi singkat 1-2 menit.">
          <DetailList
            columns={1}
            items={[
              { label: "Awal", value: "Dashboard untuk konteks dan positioning produk." },
              { label: "Tengah", value: "Transfer readiness, disclosure, lalu passport." },
              { label: "Akhir", value: "Audit trail sebagai penutup yang kuat." },
            ]}
          />
        </SectionCard>
      </div>

      <SectionCard title="Alur Scene" description="Urutan scene yang disarankan saat rekam layar.">
        <div className="space-y-4">
          {recordingSteps.map((step) => (
            <article key={step.scene} className="rounded-2xl border border-border bg-surface-soft p-5">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-3">
                    <StatusBadge tone="accent">{step.scene}</StatusBadge>
                    <h2 className="text-lg font-semibold text-foreground">{step.title}</h2>
                  </div>
                  <p className="text-sm leading-6 text-muted">{step.focus}</p>
                </div>
                <div className="rounded-2xl border border-border bg-surface px-4 py-3 text-sm">
                  <p className="font-semibold text-foreground">{step.route}</p>
                  <p className="mt-1 text-muted">{step.duration}</p>
                </div>
              </div>

              <div className="mt-5 grid gap-4 lg:grid-cols-2">
                <div className="rounded-2xl border border-border bg-surface px-4 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">Yang Harus Ditampilkan</p>
                  <ul className="mt-3 space-y-2 text-sm leading-6 text-foreground">
                    {step.show.map((item) => (
                      <li key={item}>• {item}</li>
                    ))}
                  </ul>
                </div>

                <div className="rounded-2xl border border-border bg-surface px-4 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">Contoh Narasi</p>
                  <p className="mt-3 text-sm leading-6 text-foreground">{step.narration}</p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </SectionCard>

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <SectionCard title="Checklist Sebelum Recording" description="Hal yang perlu dicek sebelum mulai rekam.">
          <ul className="space-y-3 text-sm leading-6 text-foreground">
            {sceneChecklist.map((item) => (
              <li key={item} className="rounded-2xl border border-border bg-surface-soft px-4 py-3">
                {item}
              </li>
            ))}
          </ul>
        </SectionCard>

        <SectionCard title="Yang Sebaiknya Tidak Ditampilkan" description="Untuk menjaga alur demo tetap rapi dan meyakinkan.">
          <ul className="space-y-3 text-sm leading-6 text-foreground">
            {avoidDuringRecording.map((item) => (
              <li key={item} className="rounded-2xl border border-border bg-surface-soft px-4 py-3">
                {item}
              </li>
            ))}
          </ul>
        </SectionCard>
      </div>

      <InlineNotice
        title="Route yang disarankan saat demo"
        description="Urutan aman: /dashboard -> /transfers/new -> /disclosures -> /compliance/passports -> /audit. Kalau ingin video lebih pendek, cukup dashboard -> transfers/new -> compliance/passports -> audit."
        tone="accent"
      />
    </div>
  );
}
