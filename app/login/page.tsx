import type { Metadata } from "next";
import {
  ArrowDownRight,
  ArrowUpRight,
  ChartColumn,
  Leaf,
  ReceiptText,
  ShieldCheck,
  ShoppingBag,
  Store,
  Truck,
  UsersRound,
  Wallet,
} from "lucide-react";
import { Suspense } from "react";
import { LoginForm } from "@/components/forms/login-form";
import { DEFAULT_USERNAME, DEFAULT_PASSWORD, getCredentials, isUsingDefaultCredentials } from "@/lib/auth";
import { SHOP } from "@/lib/constants";
import { firstParam } from "@/lib/utils";
import "./login.css";

export const metadata: Metadata = { title: "Sign in" };

const FEATURES = [
  {
    icon: ReceiptText,
    title: "Supplier pattis",
    text: "Lot, rate, commission and mandi charges – net to party in one slip.",
    tone: "green",
  },
  {
    icon: ShoppingBag,
    title: "Customer khata",
    text: "Udhaar, receipts and running balance for every buyer, day by day.",
    tone: "amber",
  },
  {
    icon: Wallet,
    title: "Expenses & partners",
    text: "Shop kharcha by head, split between partners at settlement.",
    tone: "green",
  },
  {
    icon: ChartColumn,
    title: "Reports & profit",
    text: "Daily, monthly and yearly – dues, sales, P&L and statements to print.",
    tone: "amber",
  },
] as const;

const TICKER = [
  "Tomato · 40 crates · Rs 1,250",
  "Haji Karim & Sons · net Rs 45,400",
  "Bismillah Traders · due Rs 1,28,400",
  "Onion · 120 bags · Rs 2,100",
  "Shop rent · Rs 35,000",
  "Partner split · 50 / 50",
  "Kinnow · 85 peti · Rs 1,900",
  "Al-Madina Fruit · received Rs 60,000",
];

export default function LoginPage(props: PageProps<"/login">) {
  const usingDefaults = isUsingDefaultCredentials();
  const { username } = getCredentials();

  return (
    <div className="m48-login relative flex min-h-screen flex-col overflow-hidden">
      {/* atmosphere */}
      <div className="m48-stars pointer-events-none absolute inset-0" aria-hidden="true" />
      <div className="m48-grid-floor pointer-events-none" aria-hidden="true" />
      <div
        className="m48-orb"
        style={{ width: 520, height: 520, left: "-10%", top: "-20%", background: "rgba(16,185,129,0.45)" }}
        aria-hidden="true"
      />
      <div
        className="m48-orb"
        style={{
          width: 460,
          height: 460,
          right: "-8%",
          top: "5%",
          background: "rgba(245,158,11,0.32)",
          animationDelay: "-7s",
        }}
        aria-hidden="true"
      />
      <div
        className="m48-ring hidden lg:block"
        style={{ width: 260, height: 260, left: "15%", top: "16%" }}
        aria-hidden="true"
      />
      <div
        className="m48-ring hidden lg:block"
        style={{ width: 140, height: 140, left: "19%", top: "22%", animationDirection: "reverse" }}
        aria-hidden="true"
      />

      {/* header */}
      <header className="relative z-10 mx-auto flex w-full max-w-[1500px] items-center justify-between gap-4 px-5 pt-6 sm:px-8 lg:px-10">
        <div className="flex items-center gap-3">
          <span className="m48-logo flex size-11 items-center justify-center rounded-xl text-[#04150c]">
            <Store className="size-5.5" />
          </span>
          <div className="leading-tight">
            <p className="text-base font-semibold tracking-tight">{SHOP.name}</p>
            <p className="text-xs text-[var(--m48-ink-muted)]">
              {SHOP.address || "Sabzi Mandi"} · Commission ledger
            </p>
          </div>
        </div>
        <div className="m48-pill hidden md:inline-flex">
          <span className="m48-dot" />
          Suppliers · Customers · Expenses · PKR
        </div>
      </header>

      {/* body */}
      <main className="relative z-10 mx-auto grid w-full max-w-[1500px] flex-1 items-center gap-10 px-5 py-10 sm:px-8 lg:grid-cols-[minmax(0,1fr)_420px] lg:gap-12 lg:px-10 lg:py-14">
        {/* hero */}
        <section className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_460px] xl:items-start">
          <div className="m48-enter max-w-2xl">
            <div className="m48-pill">
              <span className="m48-dot" />
              Live khata · pattis, udhaar &amp; partner settlement in one ledger
            </div>
            <h1 className="mt-6 text-[2.6rem] font-semibold leading-[1.02] tracking-tight sm:text-[3.4rem] lg:text-[3.9rem]">
              Every patti, every khata,
              <br />
              <span className="m48-gradient-text">settled</span> on one screen.
            </h1>
            <p className="mt-6 max-w-xl text-base leading-relaxed text-[var(--m48-ink-muted)] sm:text-lg">
              Run the mandi shop the way the counter actually works: cut the supplier&apos;s patti the moment a lot
              sells, post the buyer&apos;s udhaar, log the day&apos;s kharcha, and see what each partner takes home.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-[var(--m48-ink-faint)]">
              <span className="inline-flex items-center gap-1.5">
                <Truck className="size-3.5 text-[var(--m48-green)]" /> Supplier parties
              </span>
              <span className="inline-flex items-center gap-1.5">
                <UsersRound className="size-3.5 text-[var(--m48-amber)]" /> Customers &amp; partners
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Leaf className="size-3.5 text-[var(--m48-green)]" /> Fruit &amp; sabzi, kg to maund
              </span>
            </div>
          </div>

          <FloatingScene />

          <div className="m48-enter grid gap-4 sm:grid-cols-2 xl:col-span-2" style={{ animationDelay: "120ms" }}>
            {FEATURES.map((f) => (
              <article key={f.title} className="m48-glass m48-feature flex gap-4 rounded-2xl p-4 sm:p-5">
                <span
                  className={
                    "m48-feature-icon flex size-11 shrink-0 items-center justify-center rounded-xl " +
                    (f.tone === "green"
                      ? "bg-[rgba(52,211,153,0.14)] text-[var(--m48-green)]"
                      : "bg-[rgba(251,191,36,0.14)] text-[var(--m48-amber)]")
                  }
                >
                  <f.icon className="size-5" />
                </span>
                <div>
                  <h2 className="text-[15px] font-semibold tracking-tight">{f.title}</h2>
                  <p className="mt-1 text-sm leading-relaxed text-[var(--m48-ink-muted)]">{f.text}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* sign-in panel */}
        <aside className="m48-enter order-first w-full lg:order-none lg:justify-self-end" style={{ animationDelay: "80ms" }}>
          <div className="m48-panel relative rounded-3xl p-7 sm:p-8">
            <span className="flex size-12 items-center justify-center rounded-2xl bg-[rgba(52,211,153,0.14)] text-[var(--m48-green)] shadow-[0_0_40px_-10px_rgba(52,211,153,0.8)]">
              <ShieldCheck className="size-6" />
            </span>
            <h2 className="mt-6 text-3xl font-semibold tracking-tight">Welcome back</h2>
            <p className="mt-2 text-sm leading-relaxed text-[var(--m48-ink-muted)]">
              Sign in to open today&apos;s khata, cut pattis and check who owes what.
            </p>

            <div className="mt-7">
              <Suspense fallback={<LoginForm next="/" defaultUsername={username} />}>
                <LoginFormWithNext searchParams={props.searchParams} defaultUsername={username} />
              </Suspense>
            </div>

            {usingDefaults ? (
              <p className="mt-6 rounded-xl border border-[rgba(251,191,36,0.3)] bg-[rgba(251,191,36,0.08)] px-3.5 py-2.5 text-xs leading-relaxed text-[#fde68a]">
                Default login is <span className="font-mono font-semibold">{DEFAULT_USERNAME}</span> /{" "}
                <span className="font-mono font-semibold">{DEFAULT_PASSWORD}</span>. Change{" "}
                <span className="font-mono">APP_USERNAME</span> and <span className="font-mono">APP_PASSWORD</span> in{" "}
                <span className="font-mono">.env</span> before going live.
              </p>
            ) : null}

            <p className="mt-6 text-center text-xs text-[var(--m48-ink-faint)]">
              Confidential shop data · Only the shop owner and partners may sign in.
            </p>
          </div>
        </aside>
      </main>

      {/* ticker + footer */}
      <footer className="relative z-10 mx-auto w-full max-w-[1500px] px-5 pb-6 sm:px-8 lg:px-10">
        <div className="m48-ticker rounded-full border border-[var(--m48-line)] bg-[rgba(8,24,15,0.5)] py-2 text-xs text-[var(--m48-ink-muted)]">
          <div className="m48-ticker-track px-6">
            {[...TICKER, ...TICKER].map((t, i) => (
              <span key={i} className="inline-flex items-center gap-2 whitespace-nowrap">
                <span className="size-1 rounded-full bg-[var(--m48-green)]" />
                {t}
              </span>
            ))}
          </div>
        </div>
        <div className="mt-4 flex flex-col items-start justify-between gap-2 text-xs text-[var(--m48-ink-faint)] sm:flex-row sm:items-center">
          <span>
            © {SHOP.name}
            {SHOP.address ? ` · ${SHOP.address}` : ""}
          </span>
          <span>Sessions expire after 12 hours · 30 days when remembered</span>
        </div>
      </footer>
    </div>
  );
}

async function LoginFormWithNext({
  searchParams,
  defaultUsername,
}: Pick<PageProps<"/login">, "searchParams"> & { defaultUsername: string }) {
  const sp = await searchParams;
  return <LoginForm next={firstParam(sp.next) ?? "/"} defaultUsername={defaultUsername} />;
}

/** Floating 3D ledger cards – a glimpse of what is inside. Decorative only. */
function FloatingScene() {
  const bars = [38, 52, 44, 70, 58, 86, 64];
  return (
    <div className="m48-scene relative hidden h-[420px] xl:block" aria-hidden="true">
      {/* supplier patti */}
      <div className="m48-scene-card is-a w-[280px] p-4" style={{ left: 20, top: 10 }}>
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-[var(--m48-green)]">
            <ReceiptText className="size-3.5" /> Patti · P-00342
          </span>
          <span className="rounded-full bg-[rgba(52,211,153,0.16)] px-2 py-0.5 text-[10px] text-[var(--m48-green)]">
            Paid
          </span>
        </div>
        <p className="mt-2 text-sm font-semibold">Haji Karim &amp; Sons</p>
        <p className="text-[11px] text-[var(--m48-ink-muted)]">Tomato · 40 crates @ Rs 1,250</p>
        <div className="mt-3">
          <div className="m48-row">
            <span>Gross</span>
            <strong>50,000</strong>
          </div>
          <div className="m48-row">
            <span>Commission 8%</span>
            <strong>−4,000</strong>
          </div>
          <div className="m48-row">
            <span>Mandi fee &amp; labour</span>
            <strong>−600</strong>
          </div>
          <div className="m48-row">
            <span className="text-[var(--m48-ink)]">Net to party</span>
            <strong className="text-[var(--m48-green)]">Rs 45,400</strong>
          </div>
        </div>
      </div>

      {/* customer khata */}
      <div className="m48-scene-card is-b is-amber w-[240px] p-4" style={{ right: 0, top: 70 }}>
        <span className="inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-[var(--m48-amber)]">
          <ShoppingBag className="size-3.5" /> Customer khata
        </span>
        <p className="mt-2 text-sm font-semibold">Bismillah Traders</p>
        <p className="mt-1 text-[11px] text-[var(--m48-ink-muted)]">Balance due</p>
        <p className="text-2xl font-semibold tabular-nums text-[var(--m48-amber)]">Rs 1,28,400</p>
        <div className="mt-3 space-y-1.5 text-[11px]">
          <div className="flex items-center justify-between text-[var(--m48-ink-muted)]">
            <span className="inline-flex items-center gap-1">
              <ArrowUpRight className="size-3 text-[var(--m48-red)]" /> Today&apos;s sale
            </span>
            <span className="tabular-nums text-[var(--m48-ink)]">+18,500</span>
          </div>
          <div className="flex items-center justify-between text-[var(--m48-ink-muted)]">
            <span className="inline-flex items-center gap-1">
              <ArrowDownRight className="size-3 text-[var(--m48-green)]" /> Received
            </span>
            <span className="tabular-nums text-[var(--m48-ink)]">−10,000</span>
          </div>
        </div>
      </div>

      {/* weekly sales */}
      <div className="m48-scene-card is-c w-[250px] p-4" style={{ left: 60, bottom: 30 }}>
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-[var(--m48-green)]">
            <ChartColumn className="size-3.5" /> This week
          </span>
          <span className="text-[11px] text-[var(--m48-ink-muted)]">Sales</span>
        </div>
        <p className="mt-1 text-xl font-semibold tabular-nums">Rs 6,42,300</p>
        <div className="m48-bars mt-3">
          {bars.map((h, i) => (
            <span
              key={i}
              className={"m48-bar" + (i === bars.length - 2 ? " is-amber" : "")}
              style={{ height: `${h}%`, animationDelay: `${300 + i * 90}ms` }}
            />
          ))}
        </div>
        <div className="mt-1.5 flex justify-between text-[9px] text-[var(--m48-ink-faint)]">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
            <span key={d}>{d}</span>
          ))}
        </div>
      </div>

      {/* partner split */}
      <div className="m48-scene-card is-d w-[210px] p-3.5" style={{ right: 30, bottom: 0 }}>
        <span className="inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-[var(--m48-ink-muted)]">
          <UsersRound className="size-3.5 text-[var(--m48-green)]" /> Partner split
        </span>
        <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-[rgba(255,255,255,0.06)]">
          <span className="w-1/2 bg-[var(--m48-green)]" />
          <span className="w-1/2 bg-[var(--m48-amber)]" />
        </div>
        <div className="mt-2 flex justify-between text-[11px]">
          <span className="text-[var(--m48-ink-muted)]">
            Net profit <strong className="font-medium text-[var(--m48-ink)]">Rs 2,15,000</strong>
          </span>
          <span className="tabular-nums text-[var(--m48-ink)]">50 / 50</span>
        </div>
      </div>
    </div>
  );
}
