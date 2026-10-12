"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon } from "./icons";
import { api, isDemo } from "@/lib/api";
import { useAuth, useTheme, useToast } from "@/lib/hooks";
import { useI18n } from "@/lib/i18n";
import { DEMO_PASSWORD } from "@/lib/data/seed";

export function Logo({ light = false }: { light?: boolean }) {
  return (
    <span className="flex items-center gap-2">
      <svg width="34" height="34" viewBox="0 0 40 40" aria-hidden>
        <rect width="40" height="40" rx="10" className="fill-navy-800 dark:fill-navy-600" />
        <circle cx="20" cy="20" r="10" fill="none" stroke="#f97a1f" strokeWidth="3.2" strokeDasharray="5 2.85" />
        <circle cx="20" cy="20" r="4" fill="#fff" />
      </svg>
      <span className={`leading-none ${light ? "text-white" : "text-navy-900 dark:text-white"}`}>
        <span className="block text-[15px] font-extrabold tracking-tight">UAE AutoParts</span>
        <span className="block text-[11px] font-semibold uppercase tracking-[0.2em] text-accent-500">Hub</span>
      </span>
    </span>
  );
}

function HeaderSearch({ className = "" }: { className?: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const [q, setQ] = useState("");
  return (
    <form
      role="search"
      className={`relative ${className}`}
      onSubmit={(e) => {
        e.preventDefault();
        if (q.trim()) router.push(`/search/?q=${encodeURIComponent(q.trim())}`);
      }}
    >
      <Icon.search size={18} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-charcoal-400" />
      <input className="input ps-10" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("search_placeholder")} aria-label={t("search")} />
    </form>
  );
}

export function Header() {
  const { t, lang, setLang } = useI18n();
  const { theme, toggle } = useTheme();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  useEffect(() => setOpen(false), [pathname]);

  const dash = user?.role === "admin" ? ["/dashboard/admin/", t("admin_dashboard")] : user?.role === "supplier" ? ["/dashboard/supplier/", t("supplier_dashboard")] : user ? ["/account/", t("my_account")] : null;
  const nav = [
    ["/search/", t("nav_search")],
    ["/suppliers/", t("nav_suppliers")],
    ["/request/", t("nav_request")],
    ["/#how", t("nav_how")],
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-charcoal-200/80 bg-white/90 backdrop-blur dark:border-charcoal-800 dark:bg-charcoal-950/90">
      <div className="container-x flex h-16 items-center gap-4">
        <Link href="/" aria-label={t("brand")} className="shrink-0"><Logo /></Link>
        <HeaderSearch className="hidden flex-1 md:block md:max-w-md lg:max-w-lg" />
        <nav className="ms-auto hidden items-center gap-1 lg:flex">
          {nav.map(([h, l]) => (
            <Link key={h} href={h} className={`rounded-lg px-3 py-2 text-sm font-medium transition hover:bg-charcoal-100 dark:hover:bg-charcoal-800 ${pathname === h ? "text-accent-600" : "text-charcoal-700 dark:text-charcoal-200"}`}>{l}</Link>
          ))}
        </nav>
        <div className="ms-auto flex items-center gap-1 lg:ms-0">
          <button className="btn-ghost btn-sm h-9" onClick={() => setLang(lang === "en" ? "ar" : "en")} aria-label="Switch language">
            <Icon.globe size={16} /> <span className="font-semibold">{lang === "en" ? "عربي" : "EN"}</span>
          </button>
          <button className="btn-ghost btn-sm h-9 w-9 px-0" onClick={toggle} aria-label="Toggle dark mode">
            {theme === "dark" ? <Icon.sun size={16} /> : <Icon.moon size={16} />}
          </button>
          <div className="hidden items-center gap-1 sm:flex">
            {dash ? (
              <>
                <Link href={dash[0]} className="btn-navy btn-sm h-9"><Icon.user size={16} />{dash[1]}</Link>
                <button className="btn-ghost btn-sm h-9" onClick={() => api.logout()}>{t("logout")}</button>
              </>
            ) : (
              <>
                <Link href="/login/" className="btn-ghost btn-sm h-9">{t("login")}</Link>
                <Link href="/register/supplier/" className="btn-primary btn-sm h-9"><Icon.store size={16} />{t("supplier_register")}</Link>
              </>
            )}
          </div>
          <button className="btn-ghost btn-sm h-9 w-9 px-0 lg:hidden" onClick={() => setOpen((o) => !o)} aria-label="Menu" aria-expanded={open}>
            {open ? <Icon.close size={18} /> : <Icon.menu size={18} />}
          </button>
        </div>
      </div>
      {open && (
        <div className="border-t border-charcoal-200 bg-white px-4 pb-4 pt-3 lg:hidden dark:border-charcoal-800 dark:bg-charcoal-950">
          <HeaderSearch className="mb-3 md:hidden" />
          <nav className="grid gap-1">
            {nav.map(([h, l]) => (
              <Link key={h} href={h} className="rounded-lg px-3 py-2.5 font-medium hover:bg-charcoal-100 dark:hover:bg-charcoal-800">{l}</Link>
            ))}
            {dash ? (
              <>
                <Link href={dash[0]} className="rounded-lg px-3 py-2.5 font-medium text-navy-700 hover:bg-charcoal-100 dark:text-navy-300">{dash[1]}</Link>
                <button className="rounded-lg px-3 py-2.5 text-start font-medium hover:bg-charcoal-100" onClick={() => api.logout()}>{t("logout")}</button>
              </>
            ) : (
              <div className="mt-2 grid grid-cols-2 gap-2">
                <Link href="/login/" className="btn-ghost">{t("login")}</Link>
                <Link href="/register/supplier/" className="btn-primary">{t("supplier_register")}</Link>
              </div>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}

export function DemoBanner() {
  const { t } = useI18n();
  const toast = useToast();
  const router = useRouter();
  const [show, setShow] = useState(false);
  if (!isDemo) return null;
  const quick = async (email: string, to: string) => {
    try {
      await api.login(email, DEMO_PASSWORD);
      setShow(false);
      router.push(to);
    } catch (e) {
      toast((e as Error).message, "err");
    }
  };
  return (
    <div className="bg-navy-900 text-navy-50 dark:bg-navy-950">
      <div className="container-x flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2 text-xs">
        <p className="flex items-center gap-2"><Icon.alert size={14} className="shrink-0 text-accent-400" />{t("demo_banner")}</p>
        <div className="relative flex items-center gap-3">
          <button className="font-semibold text-accent-400 underline-offset-2 hover:underline" onClick={() => setShow((s) => !s)} aria-expanded={show}>{t("demo_accounts")} ▾</button>
          <button
            className="text-navy-200 underline-offset-2 hover:underline"
            onClick={async () => {
              await api.reset();
              toast("Demo data reset");
              router.push("/");
            }}
          >
            {t("demo_reset")}
          </button>
          {show && (
            <div className="absolute end-0 top-6 z-50 w-72 rounded-xl border border-charcoal-200 bg-white p-3 text-charcoal-800 shadow-xl dark:border-charcoal-700 dark:bg-charcoal-900 dark:text-charcoal-100">
              <p className="mb-2 text-[11px] text-charcoal-500">Password for all: <code className="font-mono font-semibold">{DEMO_PASSWORD}</code></p>
              {[
                ["customer@demo.ae", "Customer", "/account/"],
                ["supplier@demo.ae", "Supplier (Al Sajaa)", "/dashboard/supplier/"],
                ["admin@demo.ae", "Administrator", "/dashboard/admin/"],
              ].map(([email, label, to]) => (
                <button key={email} onClick={() => quick(email, to)} className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-start text-sm hover:bg-charcoal-100 dark:hover:bg-charcoal-800">
                  <span className="font-semibold">{label}</span>
                  <span className="font-mono text-[11px] text-charcoal-500">{email}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function Footer() {
  const { t } = useI18n();
  return (
    <footer className="mt-20 bg-navy-950 text-navy-100">
      <div className="container-x grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div className="lg:col-span-2">
          <Logo light />
          <p className="mt-4 max-w-md text-sm text-navy-200/80">{t("footer_about")}</p>
          <p className="mt-4 text-xs text-navy-300/70">Prices in AED. Listings are provided by independent suppliers; UAE AutoParts Hub does not sell parts directly. Always confirm the part number with the supplier before purchase.</p>
        </div>
        <div>
          <h3 className="mb-3 text-sm font-semibold text-white">{t("footer_support")}</h3>
          <ul className="space-y-2 text-sm text-navy-200/80">
            <li><Link className="hover:text-white" href="/search/">{t("nav_search")}</Link></li>
            <li><Link className="hover:text-white" href="/request/">{t("nav_request")}</Link></li>
            <li><Link className="hover:text-white" href="/suppliers/">{t("nav_suppliers")}</Link></li>
            <li><Link className="hover:text-white" href="/register/supplier/">{t("supplier_register")}</Link></li>
            <li><a className="hover:text-white" href="mailto:support@example.com">{t("contact")}: support@example.com</a></li>
          </ul>
        </div>
        <div>
          <h3 className="mb-3 text-sm font-semibold text-white">{t("footer_legal")}</h3>
          <ul className="space-y-2 text-sm text-navy-200/80">
            <li><Link className="hover:text-white" href="/legal/privacy/">{t("privacy")}</Link></li>
            <li><Link className="hover:text-white" href="/legal/terms/">{t("terms")}</Link></li>
            <li><Link className="hover:text-white" href="/legal/safety/">{t("safety")}</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="container-x flex flex-wrap justify-between gap-2 py-4 text-xs text-navy-300/70">
          <span>© {new Date().getFullYear()} UAE AutoParts Hub</span>
          <span>Made for the UAE · قطع غيار سيارات مستعملة الإمارات</span>
        </div>
      </div>
    </footer>
  );
}
