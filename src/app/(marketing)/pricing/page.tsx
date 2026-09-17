import Link from 'next/link';

interface Tier {
  name: string;
  price: string;
  status: 'available' | 'coming';
  tagline: string;
  features: string[];
  cta: { label: string; href: string; external?: boolean };
}

const TIERS: Tier[] = [
  {
    name: 'Free',
    price: '$0',
    status: 'available',
    tagline: 'Bring your own keys, keep everything you build.',
    features: [
      'BYOK: connect OpenAI, Anthropic, Google, OpenRouter, or local Ollama',
      'Task-aware routing engine (Auto/Quality/Speed/Cost/Privacy/Manual)',
      '"Why this model?" explainability trace on every request',
      'Compare mode across 2-4 models side by side',
      'Usage dashboard with per-model cost, latency, and estimated savings',
      'Envelope-encrypted key storage',
    ],
    cta: { label: 'Sign up free', href: '/signup' },
  },
  {
    name: 'Pro',
    price: 'Coming',
    status: 'coming',
    tagline: 'For people who want routing to get smarter about their own usage.',
    features: [
      'Everything in Free',
      'Routing history & learning: reliability scores tuned to your own workloads',
      'Projects: group conversations and usage by project',
      'Priority support',
    ],
    cta: { label: 'Join waitlist', href: 'mailto:hello@aicontrolplane.example?subject=Pro%20waitlist' },
  },
  {
    name: 'Team',
    price: 'Coming',
    status: 'coming',
    tagline: 'Shared routing and usage visibility across a small team.',
    features: [
      'Everything in Pro',
      'Shared workspace with role-based access',
      'Team-wide usage and cost dashboard',
      'Shared provider connections',
    ],
    cta: { label: 'Join waitlist', href: 'mailto:hello@aicontrolplane.example?subject=Team%20waitlist' },
  },
  {
    name: 'Enterprise',
    price: 'Coming',
    status: 'coming',
    tagline: 'Run the whole control plane inside your own infrastructure.',
    features: [
      'Everything in Team',
      'Self-hosted gateway - your data never leaves your network',
      'SSO and audit logging',
      'Custom model registry and routing policy',
    ],
    cta: { label: 'Contact us', href: 'mailto:hello@aicontrolplane.example?subject=Enterprise%20inquiry' },
  },
];

export default function PricingPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
      <div className="max-w-2xl">
        <h1 className="text-3xl font-semibold tracking-tight text-ink">Pricing</h1>
        <p className="mt-3 text-muted">
          Free covers everything that's actually built today. Pro, Team, and Enterprise
          describe real plans on the roadmap - they are not wired to billing yet, so their
          buttons open an email instead of a checkout page. We'd rather tell you that
          plainly than fake a payment form.
        </p>
      </div>

      <div className="mt-12 grid gap-6 lg:grid-cols-4">
        {TIERS.map((tier) => (
          <div
            key={tier.name}
            className="flex flex-col rounded-lg border border-border bg-surface p-6 shadow-card"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-ink">{tier.name}</h2>
              {tier.status === 'coming' && (
                <span className="rounded-full bg-warning-bg px-2 py-0.5 text-xs font-medium text-warning-text">
                  Coming
                </span>
              )}
            </div>
            <p className="mt-2 text-2xl font-semibold text-ink">
              {tier.price}
              {tier.status === 'available' && <span className="text-sm font-normal text-faint"> / forever</span>}
            </p>
            <p className="mt-2 text-sm text-muted">{tier.tagline}</p>

            <ul className="mt-6 flex-1 space-y-2 text-sm text-muted">
              {tier.features.map((f) => (
                <li key={f} className="flex gap-2">
                  <span className="mt-0.5 text-brand-600">✓</span>
                  <span>{f}</span>
                </li>
              ))}
            </ul>

            <Link
              href={tier.cta.href}
              className={`mt-6 block rounded px-4 py-2 text-center text-sm font-medium ${
                tier.status === 'available'
                  ? 'bg-brand-600 text-white hover:bg-brand-700'
                  : 'border border-border text-ink hover:bg-bg'
              }`}
            >
              {tier.cta.label}
            </Link>
          </div>
        ))}
      </div>

      <p className="mt-10 max-w-2xl text-sm text-faint">
        There is no payment processor integrated yet. The Free tier's signup is fully
        real; the other tiers' buttons only open a pre-filled email so we can hear what
        you need before we build billing for it.
      </p>
    </div>
  );
}
