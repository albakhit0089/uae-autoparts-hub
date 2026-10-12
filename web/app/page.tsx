"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api";
import { useData } from "@/lib/hooks";
import { useI18n } from "@/lib/i18n";
import { MAKES } from "@/lib/data/vehicles";
import { CATEGORIES } from "@/lib/data/taxonomy";
import { EMIRATES } from "@/lib/data/emirates";
import { CardSkeleton, Field, PartCard, PartGrid, VehicleSelector, type VehicleValue } from "@/components/ui";
import { CategoryGlyph, Icon } from "@/components/icons";
import { RequestForm } from "@/components/request-form";

function HeroArt() {
  return (
    <svg viewBox="0 0 600 360" className="h-full w-full" aria-hidden>
      <defs>
        <linearGradient id="hl" x1="0" x2="1">
          <stop offset="0" stopColor="#f97a1f" stopOpacity="0" />
          <stop offset=".5" stopColor="#f97a1f" />
          <stop offset="1" stopColor="#f97a1f" stopOpacity="0" />
        </linearGradient>
      </defs>
      <g fill="none" stroke="rgba(255,255,255,.75)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M60 250h40m400 0h40M100 250c0-30 20-50 50-50s50 20 50 50m200 0c0-30 20-50 50-50s50 20 50 50M200 250h200M60 250v-35l40-15 70-55c15-12 30-17 50-17h120c25 0 45 8 60 22l55 50 55 10c15 3 25 12 25 25v15" />
        <path d="M195 190l45-38h75v38zM330 152h45c12 0 22 4 30 12l26 26h-101z" strokeOpacity=".55" />
        <circle cx="150" cy="250" r="34" />
        <circle cx="150" cy="250" r="12" />
        <circle cx="450" cy="250" r="34" />
        <circle cx="450" cy="250" r="12" />
      </g>
      <g stroke="#f97a1f" strokeWidth="2" fill="none" strokeDasharray="4 6" opacity=".9">
        <path d="M300 150 L330 70" />
        <path d="M450 215 L520 120" />
        <path d="M150 215 L80 120" />
      </g>
      <g fill="#0d1a3a" stroke="#f97a1f" strokeWidth="2">
        <rect x="300" y="38" width="64" height="40" rx="8" />
        <circle cx="520" cy="110" r="22" />
        <circle cx="80" cy="110" r="22" />
      </g>
      <g fill="none" stroke="#fff" strokeWidth="1.8">
        <path d="M312 50h40M312 58h28M312 66h34" />
        <circle cx="520" cy="110" r="9" />
        <path d="M70 110h20M80 100v20" />
      </g>
      <rect x="60" y="292" width="480" height="2" fill="url(#hl)" />
    </svg>
  );
}

function Hero() {
  const { t, lang } = useI18n();
  const router = useRouter();
  const [tab, setTab] = useState<"vehicle" | "ai" | "oem">("vehicle");
  const [vehicle, setVehicle] = useState<VehicleValue>({});
  const [partType, setPartType] = useState("");
  const [emirate, setEmirate] = useState("");
  const [q, setQ] = useState("");
  const [oem, setOem] = useState("");

  const go = (e: React.FormEvent) => {
    e.preventDefault();
    const p = new URLSearchParams();
    if (tab === "vehicle") {
      Object.entries({ ...vehicle, partType, emirate }).forEach(([k, v]) => v && p.set(k, String(v)));
    } else if (tab === "ai") {
      if (q.trim()) p.set("q", q.trim());
    } else if (oem.trim()) p.set("oem", oem.trim());
    router.push(`/search/?${p.toString()}`);
  };

  const tabs = [
    ["vehicle", t("hero_tab_vehicle"), <Icon.car key="c" size={16} />],
    ["ai", t("hero_tab_ai"), <Icon.sparkle key="s" size={16} />],
    ["oem", t("hero_tab_oem"), <Icon.search key="o" size={16} />],
  ] as const;

  return (
    <section className="relative overflow-hidden bg-navy-900 text-white dark:bg-navy-950">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(249,122,31,.18),transparent_55%),radial-gradient(ellipse_at_bottom_left,rgba(84,118,193,.35),transparent_60%)]" />
      <div className="absolute inset-0 opacity-[0.07] [background-image:linear-gradient(white_1px,transparent_1px),linear-gradient(90deg,white_1px,transparent_1px)] [background-size:44px_44px]" />
      <div className="container-x relative grid items-center gap-10 py-12 lg:grid-cols-[1.15fr_.85fr] lg:py-20">
        <div>
          <p className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-accent-400 ring-1 ring-white/15">
            <Icon.pin size={14} /> Al Sajaa · Sharjah · Dubai · Abu Dhabi · {lang === "ar" ? "وكل الإمارات" : "all emirates"}
          </p>
          <h1 className="max-w-2xl text-3xl font-extrabold leading-tight tracking-tight sm:text-5xl">{t("hero_title")}</h1>
          <p className="mt-4 max-w-xl text-base text-navy-100/85 sm:text-lg">{t("hero_sub")}</p>

          <form onSubmit={go} className="mt-8 rounded-2xl bg-white p-4 text-charcoal-900 shadow-2xl ring-1 ring-black/5 sm:p-5 dark:bg-charcoal-900 dark:text-charcoal-100">
            <div className="mb-4 flex gap-1 rounded-xl bg-charcoal-100 p-1 dark:bg-charcoal-800" role="tablist">
              {tabs.map(([id, label, icon]) => (
                <button type="button" role="tab" aria-selected={tab === id} key={id} onClick={() => setTab(id)} className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-semibold transition sm:text-sm ${tab === id ? "bg-white text-navy-900 shadow dark:bg-charcoal-950 dark:text-white" : "text-charcoal-600 dark:text-charcoal-300"}`}>
                  {icon}
                  {label}
                </button>
              ))}
            </div>
            {tab === "vehicle" && (
              <div className="grid gap-3">
                <VehicleSelector value={vehicle} onChange={setVehicle} />
                <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
                  <Field label={t("part")}>
                    <select className="input" value={partType} onChange={(e) => setPartType(e.target.value)}>
                      <option value="">{t("any")}</option>
                      {CATEGORIES.map((c) => (
                        <optgroup key={c.id} label={lang === "ar" ? c.ar : c.en}>
                          {c.types.map((tp) => <option key={tp.id} value={tp.id}>{lang === "ar" ? tp.ar : tp.en}</option>)}
                        </optgroup>
                      ))}
                    </select>
                  </Field>
                  <Field label={t("emirate")}>
                    <select className="input" value={emirate} onChange={(e) => setEmirate(e.target.value)}>
                      <option value="">{t("any")}</option>
                      {EMIRATES.map((e) => <option key={e.id} value={e.id}>{lang === "ar" ? e.ar : e.en}</option>)}
                    </select>
                  </Field>
                  <button className="btn-primary self-end py-3"><Icon.search size={18} />{t("find_parts")}</button>
                </div>
              </div>
            )}
            {tab === "ai" && (
              <div className="grid gap-3">
                <textarea className="input min-h-20 text-base" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("search_placeholder")} aria-label={t("hero_tab_ai")} />
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs text-charcoal-500">{t("ai_hint")}</p>
                  <button className="btn-primary"><Icon.sparkle size={18} />{t("find_parts")}</button>
                </div>
              </div>
            )}
            {tab === "oem" && (
              <div className="flex flex-col gap-3 sm:flex-row">
                <input className="input font-mono text-base" value={oem} onChange={(e) => setOem(e.target.value)} placeholder={t("oem_placeholder")} aria-label={t("oem")} />
                <button className="btn-primary"><Icon.search size={18} />{t("find_parts")}</button>
              </div>
            )}
          </form>
        </div>
        <div className="hidden lg:block"><HeroArt /></div>
      </div>
    </section>
  );
}

function SectionHead({ title, link }: { title: string; link?: string }) {
  const { t } = useI18n();
  return (
    <div className="mb-6 flex items-end justify-between gap-4">
      <h2 className="section-title">{title}</h2>
      {link && <Link href={link} className="text-sm font-semibold text-accent-600 hover:underline">{t("view_all")} →</Link>}
    </div>
  );
}

export default function Home() {
  const { t, lang, fmtNum } = useI18n();
  const featured = useData(() => api.featured(8));
  const recent = useData(() => api.recent(8));
  const suppliers = useData(() => api.listSuppliers());

  const byEmirate = EMIRATES.map((e) => {
    const list = suppliers.data?.filter((s) => s.emirate === e.id) ?? [];
    return { e, count: list.length, listings: list.reduce((n, s) => n + s.listings, 0) };
  });

  return (
    <>
      <Hero />

      <section className="container-x py-14">
        <SectionHead title={t("popular_brands")} link="/search/" />
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {MAKES.map((m) => (
            <Link key={m.id} href={`/search/?make=${m.id}`} className="card flex flex-col items-center justify-center gap-0.5 px-3 py-5 text-center transition hover:-translate-y-0.5 hover:border-accent-400 hover:shadow-md">
              <span className="text-base font-bold tracking-tight text-navy-900 dark:text-white">{m.name}</span>
              <span className="text-xs text-charcoal-500">{m.nameAr}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="bg-white py-14 dark:bg-charcoal-900">
        <div className="container-x">
          <SectionHead title={t("browse_categories")} />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {CATEGORIES.map((c) => (
              <Link key={c.id} href={`/search/?category=${c.id}`} className="group flex items-center gap-3 rounded-2xl border border-charcoal-200 p-4 transition hover:border-navy-300 hover:bg-navy-50 dark:border-charcoal-800 dark:hover:bg-charcoal-800">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-navy-800 text-white transition group-hover:bg-accent-500"><CategoryGlyph id={c.id} size={30} /></span>
                <span>
                  <span className="block text-sm font-semibold text-navy-900 dark:text-white">{lang === "ar" ? c.ar : c.en}</span>
                  <span className="block text-xs text-charcoal-500">{c.types.length} types</span>
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="container-x py-14">
        <SectionHead title={t("featured_parts")} link="/search/" />
        {featured.data ? (
          <PartGrid>{featured.data.parts.map((p) => <PartCard key={p.id} part={p} supplier={featured.data!.suppliers[p.supplierId]} />)}</PartGrid>
        ) : <CardSkeleton />}
      </section>

      <section className="container-x pb-14">
        <SectionHead title={t("recent_parts")} link="/search/?sort=newest" />
        {recent.data ? (
          <PartGrid>{recent.data.parts.map((p) => <PartCard key={p.id} part={p} supplier={recent.data!.suppliers[p.supplierId]} />)}</PartGrid>
        ) : <CardSkeleton />}
      </section>

      <section className="bg-white py-14 dark:bg-charcoal-900">
        <div className="container-x">
          <SectionHead title={t("suppliers_by_emirate")} link="/suppliers/" />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {byEmirate.map(({ e, count, listings }) => (
              <Link key={e.id} href={`/suppliers/?emirate=${e.id}`} className={`relative overflow-hidden rounded-2xl p-5 transition hover:-translate-y-0.5 ${e.id === "sharjah" ? "bg-navy-800 text-white sm:col-span-2" : "border border-charcoal-200 dark:border-charcoal-800"}`}>
                <div className="text-lg font-bold">{lang === "ar" ? e.ar : e.en}</div>
                <div className={`text-xs ${e.id === "sharjah" ? "text-navy-100" : "text-charcoal-500"}`}>{e.areas.map((a) => (lang === "ar" ? a.ar : a.en)).join(" · ")}</div>
                <div className="mt-4 flex gap-6 text-sm">
                  <span><strong className="text-2xl">{fmtNum(count)}</strong> {t("suppliers_count")}</span>
                  <span><strong className="text-2xl">{fmtNum(listings)}</strong> {t("listings_count")}</span>
                </div>
                {e.id === "sharjah" && <Icon.pin size={90} className="absolute -bottom-3 end-3 text-white/10" />}
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section id="how" className="container-x scroll-mt-24 py-14">
        <SectionHead title={t("how_title")} />
        <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {([1, 2, 3, 4] as const).map((n) => (
            <li key={n} className="card relative p-5">
              <span className="mb-3 flex h-9 w-9 items-center justify-center rounded-full bg-accent-500 text-sm font-bold text-white">{n}</span>
              <h3 className="font-semibold text-navy-900 dark:text-white">{t(`how_${n}_t`)}</h3>
              <p className="mt-1 text-sm text-charcoal-600 dark:text-charcoal-400">{t(`how_${n}_d`)}</p>
            </li>
          ))}
        </ol>
        <div className="mt-6 grid gap-3 rounded-2xl border border-charcoal-200 p-5 text-sm sm:grid-cols-3 dark:border-charcoal-800">
          {(["verified", "likely", "confirm"] as const).map((c) => (
            <div key={c}>
              <div className="font-semibold">{t(`compat_${c}`)}</div>
              <p className="text-charcoal-600 dark:text-charcoal-400">{t(`compat_${c}_d`)}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="request" className="bg-navy-50 py-14 dark:bg-navy-950/40">
        <div className="container-x grid gap-8 lg:grid-cols-[.8fr_1.2fr]">
          <div>
            <h2 className="section-title">{t("request_cta_t")}</h2>
            <p className="mt-3 text-charcoal-600 dark:text-charcoal-300">{t("request_cta_d")}</p>
            <ul className="mt-6 space-y-2 text-sm">
              {["Matched by make & part category", "Compare offers side by side", "No spam: phone verified, rate-limited"].map((x) => (
                <li key={x} className="flex items-center gap-2"><Icon.check size={16} className="text-emerald-600" />{x}</li>
              ))}
            </ul>
          </div>
          <RequestForm compact />
        </div>
      </section>

      <section className="container-x py-14">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-navy-800 to-navy-950 p-8 text-white sm:p-12">
          <div className="absolute -end-10 -top-10 h-56 w-56 rounded-full bg-accent-500/20 blur-3xl" />
          <div className="relative grid items-center gap-8 lg:grid-cols-[1.4fr_1fr]">
            <div>
              <h2 className="text-2xl font-bold sm:text-3xl">{t("supplier_cta_t")}</h2>
              <p className="mt-3 max-w-xl text-navy-100/85">{t("supplier_cta_d")}</p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link href="/register/supplier/" className="btn-primary"><Icon.store size={18} />{t("supplier_register")}</Link>
                <Link href="/suppliers/" className="btn border border-white/25 text-white hover:bg-white/10">{t("nav_suppliers")}</Link>
              </div>
            </div>
            <ul className="grid gap-3 text-sm">
              {[
                [Icon.upload, "Excel / CSV bulk upload with import report"],
                [Icon.whatsapp, "WhatsApp inquiries straight to your phone"],
                [Icon.scale, "Quote on matched customer requests"],
                [Icon.shield, "Verified-supplier badge after document review"],
              ].map(([I, text], i) => {
                const C = I as (p: { size?: number }) => React.ReactElement;
                return (
                  <li key={i} className="flex items-center gap-3 rounded-xl bg-white/5 p-3 ring-1 ring-white/10"><C size={18} />{text as string}</li>
                );
              })}
            </ul>
          </div>
        </div>
      </section>
    </>
  );
}
