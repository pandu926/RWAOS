import { Icon } from "@/components/icons";
import { Button, SectionCard, StatusBadge } from "@/components/ui";
import { organization } from "@/lib/site-data";

const solutionCards = [
  {
    title: "Confidential Asset Management",
    description:
      "Manage tokenized assets without exposing allocations, nominal values, or bilateral movement publicly.",
    icon: "building" as const,
  },
  {
    title: "Private Transfers",
    description:
      "Transfers execute on-chain while amounts remain visible only to authorized stakeholders and relevant counterparties.",
    icon: "lock" as const,
  },
  {
    title: "Selective Disclosure",
    description:
      "Auditors, regulators, and operators access data according to explicit grants rather than the full ledger.",
    icon: "eye" as const,
  },
];

const useCases = [
  "Tokenized treasury unit allocation",
  "Confidential fund subscription and redemption",
  "Internal treasury movement with protected amount",
  "Auditor review with role-scoped disclosure",
];

const trustPillars = [
  "Role-based access with explicit scope",
  "Audit trail that still preserves privacy",
  "Institutional operating model, not token mockup",
];

export default function LandingPage() {
  return (
    <main className="grain-overlay relative overflow-hidden">
      <section className="relative border-b border-border bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
              <Icon name="shield" className="size-5" />
            </div>
            <div>
              <p className="text-lg font-semibold tracking-tight text-foreground">
                Confidential RWA OS
              </p>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted">
                Tokenized finance privacy layer
              </p>
            </div>
          </div>

          <nav className="hidden items-center gap-8 text-sm font-medium text-muted md:flex">
            <a href="#problem" className="transition-colors hover:text-foreground">
              Problem
            </a>
            <a href="#solution" className="transition-colors hover:text-foreground">
              Solution
            </a>
            <a href="#use-cases" className="transition-colors hover:text-foreground">
              Use cases
            </a>
            <a href="#trust" className="transition-colors hover:text-foreground">
              Trust
            </a>
          </nav>

          <div className="flex items-center gap-2">
            <Button href="/login" variant="secondary" className="hidden sm:inline-flex">
              Login
            </Button>
            <Button href="/dashboard" size="sm" className="!text-white">Launch app</Button>
          </div>
        </div>
      </section>

      <section className="relative px-4 pb-14 pt-12 sm:px-6 sm:pb-20 sm:pt-16 lg:px-8 lg:pb-28 lg:pt-24">
        <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[1.1fr_.9fr] lg:items-center">
          <div className="space-y-6 sm:space-y-8">
            <StatusBadge tone="accent">Enterprise privacy layer on public networks</StatusBadge>
            <div className="space-y-4 sm:space-y-5">
              <h1 className="max-w-4xl text-3xl font-semibold tracking-tight text-foreground sm:text-4xl lg:text-6xl">
                Confidential asset infrastructure for tokenized finance.
              </h1>
              <p className="max-w-2xl text-sm leading-7 text-muted sm:text-base sm:leading-8">
                Manage assets and on-chain transfers without exposing nominal values, balances,
                or allocations to the public. The product shell, selective disclosure controls,
                and audit trail are ready for demonstrations and pilot execution.
              </p>
            </div>
            <div className="flex flex-wrap gap-4">
              <Button href="/login" size="lg" className="!text-white">
                Access application
              </Button>
              <Button href="/dashboard" variant="secondary" size="lg">
                View solution concept
              </Button>
            </div>
            <div className="flex flex-wrap gap-3">
              <StatusBadge tone="success">{organization.networkName}</StatusBadge>
              <StatusBadge tone="neutral">Zero-knowledge ready</StatusBadge>
              <StatusBadge tone="neutral">Selective disclosure by default</StatusBadge>
            </div>
          </div>

          <div className="relative">
            <div className="absolute inset-0 -translate-y-3 translate-x-2 rounded-[2rem] bg-accent blur-3xl sm:-translate-y-6 sm:translate-x-6" />
            <div className="relative rounded-[2rem] border border-border bg-surface p-5 shadow-soft">
              <div className="rounded-[1.75rem] border border-border bg-primary px-5 py-4 text-primary-foreground">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/80">
                      Live workflow
                    </p>
                    <p className="mt-2 text-xl font-semibold">Institutional Treasury</p>
                  </div>
                  <StatusBadge tone="success">Protected</StatusBadge>
                </div>
                <div className="mt-6 grid gap-4 sm:mt-8 sm:grid-cols-2">
                  <div className="rounded-2xl bg-white/8 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/80">
                      Confidential transfer
                    </p>
                    <p className="mt-3 text-2xl font-semibold sm:text-3xl">$1.25M</p>
                    <p className="mt-2 text-sm text-white/85">
                      Visible only to counterparties and authorized auditors.
                    </p>
                  </div>
                  <div className="rounded-2xl bg-white/8 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/80">
                      Disclosure scope
                    </p>
                    <p className="mt-3 text-2xl font-semibold sm:text-3xl">3 grants</p>
                    <p className="mt-2 text-sm text-white/85">
                      Managed centrally from a single operational shell.
                    </p>
                  </div>
                </div>
              </div>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <SectionCard title="Privacy">
                  <p className="text-sm leading-6 text-muted">
                    Hide amounts, balances, and allocations while preserving operational
                    usability.
                  </p>
                </SectionCard>
                <SectionCard title="Auditability">
                  <p className="text-sm leading-6 text-muted">
                    Generate evidence trail and proof references for every sensitive action.
                  </p>
                </SectionCard>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="problem" className="border-y border-border bg-surface-soft px-4 py-14 sm:px-6 sm:py-16 lg:px-8 lg:py-20">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[.8fr_1.2fr]">
          <div className="space-y-4">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted">
              The problem
            </p>
            <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              Public chain transparency is useful for verification, but too open for
              institutional operations.
            </h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <SectionCard title="Asset movement is visible">
              <p className="text-sm leading-6 text-muted">
                Competitors and external observers can map liquidity strategy from transfer
                patterns alone.
              </p>
            </SectionCard>
            <SectionCard title="Privacy tools often break auditability">
              <p className="text-sm leading-6 text-muted">
                Institutions need both confidentiality and compliance-ready verification in
                one system.
              </p>
            </SectionCard>
            <SectionCard title="Selective access is not optional">
              <p className="text-sm leading-6 text-muted">
                Auditors and operators should not see the same dataset, and neither should
                the public.
              </p>
            </SectionCard>
            <SectionCard title="Demo must feel like a product">
              <p className="text-sm leading-6 text-muted">
                MVP credibility comes from coherent workflows, not isolated mock screens.
              </p>
            </SectionCard>
          </div>
        </div>
      </section>

      <section id="solution" className="px-4 py-14 sm:px-6 sm:py-16 lg:px-8 lg:py-20">
        <div className="mx-auto max-w-7xl space-y-10">
          <div className="space-y-3 text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted">
              Solution
            </p>
            <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              One operating system for private movement, selective disclosure, and controlled
              audit.
            </h2>
          </div>
          <div className="grid gap-5 lg:grid-cols-3">
            {solutionCards.map((card) => (
              <SectionCard key={card.title} className="h-full">
                <div className="space-y-5">
                  <div className="flex size-12 items-center justify-center rounded-2xl bg-surface-muted text-foreground">
                    <Icon name={card.icon} className="size-5" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-xl font-semibold text-foreground">{card.title}</h3>
                    <p className="text-sm leading-6 text-muted">{card.description}</p>
                  </div>
                </div>
              </SectionCard>
            ))}
          </div>
        </div>
      </section>

      <section id="use-cases" className="px-4 py-14 sm:px-6 sm:py-16 lg:px-8 lg:py-20">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[.9fr_1.1fr]">
          <SectionCard title="Built for the financial flows that cannot be fully public.">
            <div className="space-y-4">
              {useCases.map((useCase) => (
                <div key={useCase} className="flex items-start gap-3 rounded-2xl bg-surface-soft p-4">
                  <div className="mt-1 rounded-full bg-primary p-1 text-primary-foreground">
                    <Icon name="check" className="size-3.5" />
                  </div>
                  <p className="text-sm leading-6 text-foreground">{useCase}</p>
                </div>
              ))}
            </div>
          </SectionCard>
          <SectionCard title="How the product frames trust">
            <div className="space-y-6">
              {trustPillars.map((pillar) => (
                <div key={pillar} className="flex items-start gap-4 border-b border-border pb-4 last:border-b-0 last:pb-0">
                  <div className="rounded-2xl bg-accent p-3 text-foreground">
                    <Icon name="sparkles" className="size-4" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-base font-semibold text-foreground">{pillar}</p>
                    <p className="text-sm leading-6 text-muted">
                      Consistent IA, responsive shell, and reusable components keep the
                      product credible from landing to settings.
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>
      </section>

      <section id="trust" className="px-4 pb-16 pt-6 sm:px-6 sm:pb-20 sm:pt-8 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-6 rounded-[2rem] border border-border bg-primary px-5 py-7 text-primary-foreground shadow-soft sm:px-6 sm:py-8 lg:grid-cols-[1fr_auto] lg:items-center">
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/80">
              Ready for pilot production
            </p>
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Demo narrative, operational UX, and privacy posture are aligned from day one.
            </h2>
            <p className="max-w-3xl text-sm leading-7 text-white/85">
              This frontend represents a unified end-to-end shell across assets, transfers,
              disclosures, audit, reporting, and system settings, so reviewers and
              stakeholders experience one coherent product.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button href="/login" variant="secondary" size="lg" className="border-white/20 bg-white/8 text-white hover:bg-white/12">
              Connect wallet
            </Button>
            <Button href="/dashboard" size="lg">
              Open dashboard
            </Button>
          </div>
        </div>
      </section>
    </main>
  );
}
