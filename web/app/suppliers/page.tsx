"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { useData } from "@/lib/hooks";
import { useI18n } from "@/lib/i18n";
import { EMIRATES, areaLabel, emirateLabel, findEmirate } from "@/lib/data/emirates";
import { makeLabel } from "@/lib/data/vehicles";
import { Empty, PageHeader } from "@/components/ui";
import { Icon } from "@/components/icons";

const SupplierMap = dynamic(() => import("@/components/supplier-map"), { ssr: false, loading: () => <div className="h-full min-h-[320px] animate-pulse rounded-2xl bg-charcoal-100 dark:bg-charcoal-800" /> });

function km(a: [number, number], b: [number, number]) {
  const R = 6371;
  const dLat = ((b[0] - a[0]) * Math.PI) / 180;
  const dLng = ((b[1] - a[1]) * Math.PI) / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos((a[0] * Math.PI) / 180) * Math.cos((b[0] * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

function SuppliersInner() {
  const { t, lang } = useI18n();
  const sp = useSearchParams();
  const router = useRouter();
  const emirate = sp.get("emirate") ?? "";
  const area = sp.get("area") ?? "";
  const { data } = useData(() => api.listSuppliers());
  const [me, setMe] = useState<[number, number] | null>(null);
  const [geoErr, setGeoErr] = useState("");
  const [selected, setSelected] = useState<string | null>(null);

  const list = useMemo(() => {
    let l = (data ?? []).filter((s) => (!emirate || s.emirate === emirate) && (!area || s.area === area));
    if (me) l = [...l].sort((a, b) => km(me, [a.lat, a.lng]) - km(me, [b.lat, b.lng]));
    else l = [...l].sort((a, b) => Number(b.featured) - Number(a.featured) || Number(b.emirate === "sharjah") - Number(a.emirate === "sharjah"));
    return l;
  }, [data, emirate, area, me]);

  const set = (k: string, v: string) => {
    const p = new URLSearchParams(sp.toString());
    if (v) p.set(k, v);
    else p.delete(k);
    if (k === "emirate") p.delete("area");
    router.replace(`/suppliers/?${p.toString()}`);
  };

  const locate = () => {
    setGeoErr("");
    if (!navigator.geolocation) return setGeoErr(t("near_me_denied"));
    // Location is used only in this browser to sort the list — it is never sent or stored.
    navigator.geolocation.getCurrentPosition(
      (pos) => setMe([pos.coords.latitude, pos.coords.longitude]),
      () => setGeoErr(t("near_me_denied")),
      { maximumAge: 600_000, timeout: 10_000 },
    );
  };

  const areas = emirate ? findEmirate(emirate)?.areas ?? [] : EMIRATES.flatMap((e) => e.areas);

  return (
    <>
      <PageHeader title={t("suppliers_title")} sub={t("suppliers_sub")}>
        <Link href="/register/supplier/" className="btn-primary btn-sm"><Icon.store size={16} />{t("supplier_register")}</Link>
      </PageHeader>
      <div className="container-x py-8">
        <div className="mb-5 flex flex-wrap items-end gap-3">
          <label className="w-full sm:w-auto">
            <span className="label">{t("emirate")}</span>
            <select className="input" value={emirate} onChange={(e) => set("emirate", e.target.value)}>
              <option value="">{t("any")}</option>
              {EMIRATES.map((e) => <option key={e.id} value={e.id}>{lang === "ar" ? e.ar : e.en}</option>)}
            </select>
          </label>
          <label className="w-full sm:w-auto">
            <span className="label">{t("area")}</span>
            <select className="input" value={area} onChange={(e) => set("area", e.target.value)}>
              <option value="">{t("any")}</option>
              {areas.map((a) => <option key={a.id} value={a.id}>{lang === "ar" ? a.ar : a.en}</option>)}
            </select>
          </label>
          <button className="btn-ghost" onClick={locate}><Icon.pin size={16} />{t("near_me")}</button>
          {geoErr && <span className="text-sm text-red-600">{geoErr}</span>}
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_1.1fr]">
          <div className="h-[340px] lg:sticky lg:top-24 lg:h-[calc(100vh-8rem)]">
            <SupplierMap suppliers={list} me={me} onSelect={(id) => { setSelected(id); document.getElementById(`sup-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" }); }} />
          </div>
          <div className="grid min-w-0 content-start gap-3">
            {!data && <div className="card h-40 animate-pulse" />}
            {data && !list.length && <Empty>{t("nothing_here")}</Empty>}
            {list.map((s) => (
              <div id={`sup-${s.id}`} key={s.id} className={`card p-5 transition ${selected === s.id ? "ring-2 ring-accent-500" : ""}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <Link href={`/shop/?id=${s.id}`} className="text-lg font-bold text-navy-900 hover:underline dark:text-white">{lang === "ar" && s.nameAr ? s.nameAr : s.name}</Link>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-charcoal-600 dark:text-charcoal-300">
                      <span className="flex items-center gap-1"><Icon.pin size={14} />{areaLabel(s.emirate, s.area, lang)}, {emirateLabel(s.emirate, lang)}</span>
                      {me && <span className="font-semibold text-emerald-700">{km(me, [s.lat, s.lng]).toFixed(1)} {t("km")}</span>}
                      <span className="flex items-center gap-1"><Icon.truck size={14} />{s.delivery ? t("delivery") : t("no_delivery")}</span>
                    </div>
                  </div>
                  <div className="text-end">
                    <div className="text-2xl font-bold text-navy-900 dark:text-white">{s.listings}</div>
                    <div className="text-xs text-charcoal-500">{t("listings_count")}</div>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {s.makes.map((m) => <span key={m} className="chip bg-navy-50 text-navy-800 dark:bg-navy-950 dark:text-navy-200">{makeLabel(m, lang)}</span>)}
                </div>
                <div className="mt-4 flex gap-2">
                  <Link href={`/shop/?id=${s.id}`} className="btn-navy btn-sm">{t("view_shop")}</Link>
                  <a className="btn-ghost btn-sm" target="_blank" rel="noopener noreferrer" href={`https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lng}`}>{t("directions")}</a>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

export default function SuppliersPage() {
  return (
    <Suspense fallback={null}>
      <SuppliersInner />
    </Suspense>
  );
}
