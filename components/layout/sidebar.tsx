"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useState } from "react";
import {
  Banknote,
  ChartColumn,
  ClipboardList,
  HandCoins,
  LayoutDashboard,
  LogOut,
  Menu,
  Plus,
  ReceiptText,
  ShoppingBag,
  Store,
  TrendingUp,
  Truck,
  Users,
  UsersRound,
  Wallet,
  X,
} from "lucide-react";
import { logout } from "@/lib/actions/auth";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Treat these path prefixes as active too. */
  match?: string[];
}

const NAV: { heading?: string; items: NavItem[] }[] = [
  {
    items: [{ href: "/", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    heading: "Purchases · suppliers (maal lena)",
    items: [
      { href: "/bills", label: "Bills / Pattis", icon: ReceiptText, match: ["/bills"] },
      { href: "/transactions", label: "Payments & Advances", icon: HandCoins, match: ["/transactions"] },
      { href: "/parties", label: "Supplier Parties", icon: Truck, match: ["/parties"] },
    ],
  },
  {
    heading: "Sales · customers (maal dena)",
    items: [
      { href: "/sales", label: "Khata Entries", icon: ShoppingBag, match: ["/sales"] },
      { href: "/customers", label: "Customer Parties", icon: Users, match: ["/customers"] },
    ],
  },
  {
    heading: "Shop",
    items: [
      { href: "/cash", label: "Cash in Hand", icon: Banknote, match: ["/cash"] },
      { href: "/expenses", label: "Shop Expenses", icon: Wallet, match: ["/expenses"] },
      { href: "/partners", label: "Partners", icon: UsersRound, match: ["/partners"] },
    ],
  },
  {
    heading: "Reports",
    items: [
      { href: "/reports", label: "Profit & Loss", icon: ChartColumn },
      { href: "/reports/parties", label: "Supplier Summary", icon: Store },
      { href: "/reports/sales", label: "Sales & Dues", icon: TrendingUp },
      { href: "/reports/expenses", label: "Expense Reports", icon: ClipboardList },
    ],
  },
];

function isActive(pathname: string | null, item: NavItem): boolean {
  if (pathname === null) return false;
  if (item.href === "/") return pathname === "/";
  if (pathname === item.href) return true;
  if (item.match) return item.match.some((m) => pathname.startsWith(`${m}/`) || pathname === m);
  return false;
}

interface NavListProps {
  pathname: string | null;
  authEnabled: boolean;
  onNavigate?: () => void;
}

/** Presentational nav. `pathname === null` renders without an active state (Suspense fallback). */
function NavList({ pathname, authEnabled, onNavigate }: NavListProps) {
  return (
    <nav className="flex flex-1 flex-col gap-5 overflow-y-auto px-3 py-4">
      <div className="grid gap-2">
        <Link
          href="/bills/new"
          onClick={onNavigate}
          className="flex items-center justify-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
        >
          <Plus className="size-4" /> New Bill (Patti)
        </Link>
        <Link
          href="/sales"
          onClick={onNavigate}
          className="flex items-center justify-center gap-2 rounded-md border border-sidebar-accent px-3 py-2 text-sm font-semibold text-sidebar-foreground transition-colors hover:bg-sidebar-accent"
        >
          <ShoppingBag className="size-4" /> Customer Entry
        </Link>
      </div>
      {NAV.map((group, i) => (
        <div key={i}>
          {group.heading ? (
            <p className="mb-1 px-2 text-[11px] font-semibold uppercase tracking-wider text-sidebar-muted">{group.heading}</p>
          ) : null}
          <ul className="space-y-0.5">
            {group.items.map((item) => {
              const active = isActive(pathname, item);
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium text-sidebar-foreground/85 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground",
                      active && "bg-sidebar-accent text-white",
                    )}
                  >
                    <Icon className="size-4 shrink-0" />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
      <div className="mt-auto space-y-3 px-2 pt-4 text-xs text-sidebar-muted">
        {authEnabled ? (
          <form action={logout}>
            <button
              type="submit"
              className="flex w-full items-center gap-2 rounded-md px-1 py-1.5 text-sm font-medium text-sidebar-foreground/85 hover:bg-sidebar-accent hover:text-white"
            >
              <LogOut className="size-4" /> Sign out
            </button>
          </form>
        ) : null}
        <p>Market 48 Shop · v1.0</p>
      </div>
    </nav>
  );
}

/** Reads the URL – kept inside Suspense so the app shell can still be prerendered. */
function ActiveNavList(props: Omit<NavListProps, "pathname">) {
  const pathname = usePathname();
  return <NavList pathname={pathname} {...props} />;
}

export function Sidebar({ shopName, authEnabled }: { shopName: string; authEnabled: boolean }) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  const nav = (
    <Suspense fallback={<NavList pathname={null} authEnabled={authEnabled} />}>
      <ActiveNavList authEnabled={authEnabled} onNavigate={close} />
    </Suspense>
  );

  return (
    <>
      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-card px-4 py-3 lg:hidden no-print">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <span className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Store className="size-4" />
          </span>
          {shopName}
        </Link>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          className="rounded-md p-2 hover:bg-muted"
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </header>

      {/* Mobile drawer */}
      {open ? (
        <div className="fixed inset-0 z-40 lg:hidden no-print">
          <button type="button" aria-label="Close menu" className="absolute inset-0 bg-black/50" onClick={close} />
          <aside className="absolute inset-y-0 left-0 flex w-72 max-w-[85%] flex-col bg-sidebar text-sidebar-foreground shadow-xl">
            <div className="flex items-center justify-between px-4 py-4">
              <span className="font-semibold">{shopName}</span>
              <button type="button" onClick={close} aria-label="Close menu" className="rounded-md p-1 hover:bg-sidebar-accent">
                <X className="size-5" />
              </button>
            </div>
            {nav}
          </aside>
        </div>
      ) : null}

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 flex-col bg-sidebar text-sidebar-foreground lg:flex no-print">
        <Link href="/" className="flex items-center gap-2.5 px-5 py-5">
          <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
            <Store className="size-5" />
          </span>
          <span className="leading-tight">
            <span className="block text-base font-semibold text-white">{shopName}</span>
            <span className="block text-[11px] text-sidebar-muted">Supplier & customer khata</span>
          </span>
        </Link>
        {nav}
      </aside>
    </>
  );
}
