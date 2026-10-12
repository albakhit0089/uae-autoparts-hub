"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { useData } from "@/lib/hooks";
import { useI18n } from "@/lib/i18n";
import { relaxations } from "@/lib/search";
import { CATEGORIES, categoryLabel, partTypeLabel } from "@/lib/data/taxonomy";
import { EMIRATES, emirateLabel, findEmirate } from "@/lib/data/emirates";
import { makeLabel, modelLabel } from "@/lib/data/vehicles";
import { CardSkeleton, Empty, Field, PartCard, PartGrid, VehicleSelector } from "@/components/ui";
import { Icon } from "@/components/icons";
import type { Condition, Emirate, SearchFilters } from "@/lib/types";

const KEYS = ["q", "make", "model", "year", "engine", "transmission", "category", "partType", "oem", "emirate", "area", "minPrice", "maxPrice", "condition", "warranty", "sort"] as const;

function readFilters(sp: URLSearchParams): SearchFilters {
  const f: Record<string, unknown> = {};
  for (const k of KEYS) {
    const v = sp.get(k);
    if (!v) continue;
    f[k] = ["year", "minPrice", "maxPrice"].includes(k) ? Number(v) : k === "warranty" ? v === "true" : v;
  }
  return f as SearchFilters;
}

function toQuery(f: SearchFilters) {
  const p = new URLSearchParams();
  Object.entries(f).forEach(([k, v]) => {
    if (v !== undefined && v !== "" && v !== false && v !== null) p.set(k, String(v));
  });
  return p.toString();
}

function SearchInner() {
  const sp = useSearchParams();
  const router = useRouter();
  const { t, lang, fmtNum, fmtPrice } = useI18n();
  const filters = useMemo(() => readFilters(new URLSearchParams(sp.toString())), [sp]);
  const key = sp.toString();
  const { data, loading } = useData(() => api.search(filters), [key]);
  const [draft, setDraft] = useState<SearchFilters>(filters);
  const [showFilters, setShowFilters] = useState(false);
  useEffect(() => setDraft(filters), [filters]);

  const push = (f: SearchFilters) => router.push(`/search/?${toQuery(f)}`);
  const apply = (patch: Partial<SearchFilters>) => push({ ...filters, ...patch });
  const setD = (patch: Partial<SearchFilters>) => setDraft((d) => ({ ...d, ...patch }));

  const parsed = data?.parsed;
  const applied = data?.applied;
  const understood: string[] = [];
  if (parsed && applied) {
    if (applied.make) understood.push(makeLabel(applied.make, lang));
    if (applied.model) understood.push(modelLabel(applied.make!, applied.model, lang) + (parsed.variant ? ` ${parsed.variant}` : ""));
    if (applied.year) understood.push(String(applied.year));
    if (applied.engine) understood.push(`${t("engine")} ${applied.engine}`);
    if (applied.partType) understood.push(partTypeLabel(applied.partType, lang));
    else if (applied.category) understood.push(categoryLabel(applied.category, lang));
    if (applied.emirate) understood.push(emirateLabel(applied.emirate, lang));
    if (applied.maxPrice != null) understood.push(`≤ ${fmtPrice(applied.maxPrice)}`);
    if (applied.oem) understood.push(`OEM ${applied.oem}`);
    if (applied.condition) understood.push(t(`cond_${applied.condition}`));
    if (applied.warranty) understood.push(t("with_warranty"));
    parsed.keywords.forEach((k) => understood.push(`“${k}”`));
  }

  const areaOptions = draft.emirate ? findEmirate(draft.emirate)?.areas ?? [] : EMIRATES.flatMap((e) => e.areas);

  const filterPanel = (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        setShowFilters(false);
        push({ ...draft, q: draft.q });
      }}
    >
      <Field label={t("search")}>
        <input className="input" value={draft.q ?? ""} onChange={(e) => setD({ q: e.target.value })} placeholder="gearbox C200 2015…" />
      </Field>
      <div className="grid gap-3 [&>div]:grid-cols-2 [&>div]:md:grid-cols-2">
        <VehicleSelector value={{ make: draft.make, model: draft.model, year: draft.year, engine: draft.engine }} onChange={(v) => setD({ make: v.make, model: v.model, year: v.year, engine: v.engine })} />
      </div>
      <Field label={t("transmission")}>
        <select className="input" value={draft.transmission ?? ""} onChange={(e) => setD({ transmission: e.target.value || undefined })}>
          <option value="">{t("any")}</option>
          {["automatic", "CVT", "7G-Tronic", "9G-Tronic", "ZF 8HP", "manual"].map((x) => <option key={x} value={x}>{x}</option>)}
        </select>
      </Field>
      <Field label={t("category")}>
        <select className="input" value={draft.partType ? `t:${draft.partType}` : draft.category ? `c:${draft.category}` : ""} onChange={(e) => {
          const v = e.target.value;
          setD(v.startsWith("t:") ? { partType: v.slice(2), category: undefined } : v.startsWith("c:") ? { category: v.slice(2), partType: undefined } : { category: undefined, partType: undefined });
        }}>
          <option value="">{t("any")}</option>
          {CATEGORIES.map((c) => (
            <optgroup key={c.id} label={lang === "ar" ? c.ar : c.en}>
              <option value={`c:${c.id}`}>{lang === "ar" ? `كل ${c.ar}` : `All ${c.en.toLowerCase()}`}</option>
              {c.types.map((tp) => <option key={tp.id} value={`t:${tp.id}`}>{lang === "ar" ? tp.ar : tp.en}</option>)}
            </optgroup>
          ))}
        </select>
      </Field>
      <Field label={t("oem")}>
        <input className="input font-mono" value={draft.oem ?? ""} onChange={(e) => setD({ oem: e.target.value || undefined })} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t("emirate")}>
          <select className="input" value={draft.emirate ?? ""} onChange={(e) => setD({ emirate: (e.target.value || undefined) as Emirate, area: undefined })}>
            <option value="">{t("any")}</option>
            {EMIRATES.map((e) => <option key={e.id} value={e.id}>{lang === "ar" ? e.ar : e.en}</option>)}
          </select>
        </Field>
        <Field label={t("area")}>
          <select className="input" value={draft.area ?? ""} onChange={(e) => setD({ area: e.target.value || undefined })}>
            <option value="">{t("any")}</option>
            {areaOptions.map((a) => <option key={a.id} value={a.id}>{lang === "ar" ? a.ar : a.en}</option>)}
          </select>
        </Field>
        <Field label={t("min_price")}>
          <input className="input" type="number" min={0} value={draft.minPrice ?? ""} onChange={(e) => setD({ minPrice: e.target.value ? Number(e.target.value) : undefined })} />
        </Field>
        <Field label={t("max_price")}>
          <input className="input" type="number" min={0} value={draft.maxPrice ?? ""} onChange={(e) => setD({ maxPrice: e.target.value ? Number(e.target.value) : undefined })} />
        </Field>
      </div>
      <Field label={t("condition")}>
        <select className="input" value={draft.condition ?? ""} onChange={(e) => setD({ condition: (e.target.value || undefined) as Condition })}>
          <option value="">{t("any")}</option>
          {(["used", "tested", "refurbished"] as const).map((c) => <option key={c} value={c}>{t(`cond_${c}`)}</option>)}
        </select>
      </Field>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!draft.warranty} onChange={(e) => setD({ warranty: e.target.checked })} />{t("with_warranty")}</label>
      <div className="flex gap-2">
        <button className="btn-primary flex-1">{t("apply")}</button>
        <button type="button" className="btn-ghost" onClick={() => push({})}>{t("clear")}</button>
      </div>
    </form>
  );

  return (
    <div className="container-x py-8">
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[300px_1fr]">
        <aside className="hidden lg:block">
          <div className="card sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto p-5">
            <h2 className="mb-4 flex items-center gap-2 font-semibold"><Icon.search size={16} />{t("filters")}</h2>
            {filterPanel}
          </div>
        </aside>

        <div className="min-w-0">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-bold text-navy-900 dark:text-white">
                {loading && !data ? t("loading") : `${fmtNum(data?.results.length ?? 0)} ${lang === "en" && data?.results.length === 1 ? "result" : t("results")}`}
              </h1>
              {filters.q && <p className="text-sm text-charcoal-500">“{filters.q}”</p>}
            </div>
            <div className="flex items-center gap-2">
              <button className="btn-ghost btn-sm lg:hidden" onClick={() => setShowFilters((s) => !s)}><Icon.search size={14} />{t("filters")}</button>
              <label className="flex items-center gap-2 text-sm">
                <span className="hidden text-charcoal-500 sm:inline">{t("sort")}</span>
                <select className="input py-1.5" value={filters.sort ?? "relevance"} onChange={(e) => apply({ sort: e.target.value as SearchFilters["sort"] })}>
                  <option value="relevance">{t("sort_relevance")}</option>
                  <option value="price-asc">{t("sort_price_asc")}</option>
                  <option value="price-desc">{t("sort_price_desc")}</option>
                  <option value="newest">{t("sort_newest")}</option>
                </select>
              </label>
            </div>
          </div>

          {showFilters && <div className="card mb-6 p-5 lg:hidden">{filterPanel}</div>}

          {understood.length > 0 && (
            <div className="mb-5 flex flex-wrap items-center gap-2 rounded-xl border border-navy-100 bg-navy-50 px-4 py-3 text-sm dark:border-navy-900 dark:bg-navy-950/50">
              <Icon.sparkle size={16} className="text-accent-500" />
              <span className="font-semibold text-navy-800 dark:text-navy-200">{t("understood")}:</span>
              {understood.map((u, i) => <span key={i} className="chip bg-white text-navy-800 ring-1 ring-navy-200 dark:bg-charcoal-900 dark:text-navy-200 dark:ring-navy-800">{u}</span>)}
            </div>
          )}

          {!data && loading ? (
            <CardSkeleton n={8} />
          ) : data && data.results.length ? (
            <PartGrid>
              {data.results.map((r) => <PartCard key={r.part.id} part={r.part} supplier={data.suppliers[r.part.supplierId]} compatibility={r.compatibility} />)}
            </PartGrid>
          ) : (
            <Empty>
              <p className="text-base font-semibold text-charcoal-800 dark:text-charcoal-100">{t("no_results")}</p>
              <p>{t("no_results_tip")}</p>
              <div className="flex flex-wrap justify-center gap-2">
                {applied && relaxations(applied).map((r) => (
                  <button key={r.label} className="btn-ghost btn-sm" onClick={() => push(r.filters)}>{t(r.label as "relaxEmirate")}</button>
                ))}
                <Link className="btn-primary btn-sm" href={`/request/?${toQuery({ make: applied?.make, model: applied?.model, year: applied?.year, partType: applied?.partType } as SearchFilters)}`}>{t("nav_request")}</Link>
              </div>
            </Empty>
          )}

          <p className="mt-8 text-xs text-charcoal-500">
            Results come only from supplier inventory on the platform. Fitment labels: <strong>{t("compat_verified")}</strong> — {t("compat_verified_d")} <strong>{t("compat_likely")}</strong> — {t("compat_likely_d")} <strong>{t("compat_confirm")}</strong> — {t("compat_confirm_d")}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="container-x py-8"><CardSkeleton n={8} /></div>}>
      <SearchInner />
    </Suspense>
  );
}
