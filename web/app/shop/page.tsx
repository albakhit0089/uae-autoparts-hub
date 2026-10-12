"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { api } from "@/lib/api";
import { useData } from "@/lib/hooks";
import { useI18n } from "@/lib/i18n";
import { areaLabel, emirateLabel } from "@/lib/data/emirates";
import { CATEGORIES } from "@/lib/data/taxonomy";
import { makeLabel } from "@/lib/data/vehicles";
import { Empty, PartCard, PartGrid } from "@/components/ui";
import { Icon } from "@/components/icons";

function ShopInner() {
  const id = useSearchParams().get("id") ?? "";
  const { t, lang } = useI18n();
  const { data, error } = useData(() => api.getSupplier(id), [id]);
  const [cat, setCat] = useState("");
  if (error) return <div className="container-x py-16"><Empty>{error}</Empty></div>;
  if (!data) return <div className="container-x py-16 text-center text-charcoal-500">{t("loading")}</div>;
  const { supplier: s, parts } = data;
  const shown = parts.filter((p) => !cat || p.categoryId === cat);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "AutoPartsStore",
    name: s.name,
    address: { "@type": "PostalAddress", streetAddress: s.address, addressRegion: emirateLabel(s.emirate), addressCountry: "AE" },
    geo: { "@type": "GeoCoordinates", latitude: s.lat, longitude: s.lng },
  };
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="bg-navy-900 text-white">
        <div className="container-x flex flex-wrap items-end justify-between gap-6 py-10">
          <div>
            <div className="mb-2 flex gap-2">
              <span className="chip bg-emerald-500/20 text-emerald-200"><Icon.shield size={12} />Verified supplier</span>
              {s.isSample && <span className="chip bg-accent-500/20 text-accent-400">{t("sample_record")}</span>}
            </div>
            <h1 className="text-3xl font-bold">{lang === "ar" && s.nameAr ? s.nameAr : s.name}</h1>
            <p className="mt-2 flex items-center gap-1 text-navy-100"><Icon.pin size={16} />{s.address} · {areaLabel(s.emirate, s.area, lang)}, {emirateLabel(s.emirate, lang)}</p>
            <p className="mt-1 flex items-center gap-1 text-sm text-navy-200"><Icon.truck size={16} />{s.delivery ? `${t("delivery")}: ${s.emiratesServed.map((e) => emirateLabel(e, lang)).join(", ")}` : t("no_delivery")}</p>
            <div className="mt-3 flex flex-wrap gap-1.5">{s.makes.map((m) => <span key={m} className="chip bg-white/10">{makeLabel(m, lang)}</span>)}</div>
          </div>
          <a className="btn-primary" target="_blank" rel="noopener noreferrer" href={`https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lng}`}><Icon.pin size={16} />{t("directions")}</a>
        </div>
      </div>
      <div className="container-x py-8">
        <div className="mb-5 flex flex-wrap gap-2">
          <button className={`chip px-3 py-1.5 ${!cat ? "bg-navy-800 text-white" : "bg-charcoal-100 dark:bg-charcoal-800"}`} onClick={() => setCat("")}>{t("any")} ({parts.length})</button>
          {CATEGORIES.filter((c) => parts.some((p) => p.categoryId === c.id)).map((c) => (
            <button key={c.id} className={`chip px-3 py-1.5 ${cat === c.id ? "bg-navy-800 text-white" : "bg-charcoal-100 dark:bg-charcoal-800"}`} onClick={() => setCat(c.id)}>
              {lang === "ar" ? c.ar : c.en} ({parts.filter((p) => p.categoryId === c.id).length})
            </button>
          ))}
        </div>
        {shown.length ? <PartGrid>{shown.map((p) => <PartCard key={p.id} part={p} />)}</PartGrid> : <Empty>{t("nothing_here")}</Empty>}
      </div>
    </>
  );
}

export default function ShopPage() {
  return (
    <Suspense fallback={null}>
      <ShopInner />
    </Suspense>
  );
}
