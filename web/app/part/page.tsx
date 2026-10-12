"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { api, isDemo } from "@/lib/api";
import { useAuth, useData, useToast } from "@/lib/hooks";
import { useI18n } from "@/lib/i18n";
import { assessCompatibility } from "@/lib/search";
import { findPartType, partTypeLabel, categoryLabel } from "@/lib/data/taxonomy";
import { makeLabel, modelLabel } from "@/lib/data/vehicles";
import { areaLabel, emirateLabel } from "@/lib/data/emirates";
import { CompatBadge, ConditionBadge, Empty, Modal, PartCard, PartGrid, PartImage, StatusBadge, VehicleSelector, useAgo, type VehicleValue } from "@/components/ui";
import { Icon } from "@/components/icons";

function PartInner() {
  const id = useSearchParams().get("id") ?? "";
  const { t, lang, fmtPrice } = useI18n();
  const { user } = useAuth();
  const toast = useToast();
  const ago = useAgo();
  const { data, error } = useData(() => api.getPart(id), [id]);
  const more = useData(async () => (data ? (await api.getSupplier(data.part.supplierId)).parts.filter((p) => p.id !== id).slice(0, 4) : []), [data?.part.supplierId, id]);
  const [fav, setFav] = useState(false);
  const [img, setImg] = useState(0);
  const [vehicle, setVehicle] = useState<VehicleValue>({});
  const [reportOpen, setReportOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [waNote, setWaNote] = useState(false);

  useEffect(() => {
    if (user) api.isFavourite(id).then(setFav).catch(() => {});
  }, [id, user]);

  useEffect(() => {
    if (data) document.title = `${partTypeLabel(data.part.partTypeId, lang)} ${makeLabel(data.part.make, lang)} ${modelLabel(data.part.make, data.part.model, lang)} | UAE AutoParts Hub`;
  }, [data, lang]);

  if (error) return <div className="container-x py-16"><Empty>{error}</Empty></div>;
  if (!data) return <div className="container-x py-16 text-center text-charcoal-500">{t("loading")}</div>;
  const { part, supplier } = data;
  const pt = findPartType(part.partTypeId);
  const compat = vehicle.make && vehicle.model && vehicle.year ? assessCompatibility(part, vehicle) : null;

  const contact = async () => {
    // Open the window synchronously (popup blockers), then point it at the logged link.
    const w = window.open("", "_blank");
    try {
      const r = await api.logInquiry(part.id, lang, user?.name);
      if (r.isSample) setWaNote(true);
      if (w) w.location.href = r.url;
      else window.location.href = r.url;
    } catch (e) {
      w?.close();
      toast((e as Error).message, "err");
    }
  };

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: part.name,
    sku: part.id,
    mpn: part.oem,
    category: categoryLabel(part.categoryId),
    itemCondition: part.condition === "refurbished" ? "https://schema.org/RefurbishedCondition" : "https://schema.org/UsedCondition",
    offers: {
      "@type": "Offer",
      priceCurrency: "AED",
      price: part.price,
      availability: part.status === "available" ? "https://schema.org/InStock" : "https://schema.org/LimitedAvailability",
      seller: { "@type": "AutoPartsStore", name: supplier.name, address: { "@type": "PostalAddress", addressRegion: emirateLabel(supplier.emirate), addressCountry: "AE" } },
    },
  };

  const specs: [string, React.ReactNode][] = [
    [t("category"), categoryLabel(part.categoryId, lang)],
    [t("fits"), `${makeLabel(part.make, lang)} ${modelLabel(part.make, part.model, lang)} ${part.generation ?? ""} · ${part.yearFrom}–${part.yearTo}`],
    [t("engine"), part.engine ?? "—"],
    [t("transmission"), part.transmission ?? "—"],
    [t("oem"), part.oem ? <code key="o" className="font-mono">{part.oem}</code> : "—"],
    [t("market_spec"), part.marketSpec],
    [t("condition"), <ConditionBadge key="c" value={part.condition} />],
    [t("warranty"), part.warrantyDays > 0 ? `${part.warrantyDays} ${t("days_warranty")}` : t("no_warranty")],
    [t("quantity"), part.quantity],
    [t("donor_vehicle"), part.donorVehicle ?? "—"],
    [t("last_verified"), ago(part.lastVerified)],
  ];

  return (
    <div className="container-x py-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <nav className="mb-4 text-sm text-charcoal-500">
        <Link href="/search/" className="hover:underline">{t("nav_search")}</Link> /{" "}
        <Link href={`/search/?make=${part.make}`} className="hover:underline">{makeLabel(part.make, lang)}</Link> /{" "}
        <Link href={`/search/?make=${part.make}&model=${part.model}`} className="hover:underline">{modelLabel(part.make, part.model, lang)}</Link>
      </nav>
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1.1fr_.9fr]">
        <div>
          <div className="card aspect-[4/3] overflow-hidden"><PartImage part={part} large index={img} /></div>
          {part.images.length > 1 && (
            <div className="mt-3 flex gap-2">
              {part.images.map((_, i) => (
                <button key={i} onClick={() => setImg(i)} className={`h-16 w-20 overflow-hidden rounded-lg ring-2 ${i === img ? "ring-accent-500" : "ring-transparent"}`} aria-label={`Photo ${i + 1}`}>
                  <PartImage part={part} index={i} />
                </button>
              ))}
            </div>
          )}
          <div className="card mt-6 p-5">
            <h2 className="mb-3 font-semibold">{t("description")}</h2>
            <p className="whitespace-pre-line text-sm text-charcoal-700 dark:text-charcoal-300">{part.description || "—"}</p>
            <dl className="mt-5 grid grid-cols-1 gap-x-6 text-sm sm:grid-cols-2">
              {specs.map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 border-b border-charcoal-100 py-2 dark:border-charcoal-800">
                  <dt className="text-charcoal-500">{k}</dt>
                  <dd className="text-end font-medium">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>

        <div className="space-y-4">
          <div className="card p-6">
            <div className="mb-2 flex flex-wrap gap-2">
              <StatusBadge value={part.status} />
              <CompatBadge value={compat ?? assessCompatibility(part, {})} />
              {part.isSample && <span className="chip bg-accent-500/10 text-accent-700 dark:text-accent-400">{t("sample_record")}</span>}
            </div>
            <h1 className="text-2xl font-bold leading-tight text-navy-900 dark:text-white">
              {partTypeLabel(part.partTypeId, lang)} — {makeLabel(part.make, lang)} {modelLabel(part.make, part.model, lang)} {part.generation}
            </h1>
            <p className="mt-1 text-sm text-charcoal-500">{part.yearFrom}–{part.yearTo}{part.engine ? ` · ${part.engine}` : ""}</p>
            <div className="mt-4 text-3xl font-extrabold text-navy-900 dark:text-white">{fmtPrice(part.price)}</div>
            <div className="mt-5 grid gap-2">
              <button className="btn-whatsapp py-3 text-base" onClick={contact} disabled={part.status === "sold"}>
                <Icon.whatsapp size={20} /> {t("contact_supplier")}
              </button>
              {waNote && <p className="rounded-lg bg-amber-50 p-2 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-200">{t("sample_whatsapp_note")}</p>}
              <div className="grid grid-cols-3 gap-2">
                <Link href={`/compare/?id=${part.id}`} className="btn-ghost btn-sm"><Icon.scale size={14} />{t("compare_prices")}</Link>
                <button
                  className="btn-ghost btn-sm"
                  onClick={async () => {
                    if (!user) return toast(t("login_required"), "err");
                    setFav(await api.toggleFavourite(part.id));
                  }}
                >
                  {fav ? <Icon.heartFill size={14} className="text-accent-500" /> : <Icon.heart size={14} />}
                  {fav ? t("saved") : t("save")}
                </button>
                <button className="btn-ghost btn-sm" onClick={() => setReportOpen(true)}><Icon.flag size={14} />{t("report")}</button>
              </div>
            </div>
            {pt?.safetyCritical && (
              <p className="mt-4 flex gap-2 rounded-xl bg-red-50 p-3 text-xs text-red-800 dark:bg-red-950 dark:text-red-200">
                <Icon.alert size={16} className="shrink-0" />
                {t("safety_notice")}
              </p>
            )}
          </div>

          <div className="card p-5">
            <h2 className="mb-3 flex items-center gap-2 font-semibold"><Icon.car size={18} />Check fit for your vehicle</h2>
            <VehicleSelector value={vehicle} onChange={setVehicle} />
            {compat && (
              <div className="mt-3 rounded-xl bg-charcoal-50 p-3 text-sm dark:bg-charcoal-800">
                <CompatBadge value={compat} /> <span className="ms-1 text-charcoal-600 dark:text-charcoal-300">{t(`compat_${compat}_d`)}</span>
              </div>
            )}
          </div>

          <div className="card p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-charcoal-500">{t("supplier")}</div>
                <Link href={`/shop/?id=${supplier.id}`} className="text-lg font-bold text-navy-900 hover:underline dark:text-white">{lang === "ar" && supplier.nameAr ? supplier.nameAr : supplier.name}</Link>
                <div className="mt-1 flex items-center gap-1 text-sm text-charcoal-600 dark:text-charcoal-300"><Icon.pin size={14} />{areaLabel(supplier.emirate, supplier.area, lang)}, {emirateLabel(supplier.emirate, lang)}</div>
                <div className="mt-1 flex items-center gap-1 text-sm text-charcoal-600 dark:text-charcoal-300"><Icon.truck size={14} />{supplier.delivery ? t("delivery") : t("no_delivery")}</div>
              </div>
              {supplier.status === "approved" && <span className="chip bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"><Icon.shield size={12} />Verified</span>}
            </div>
            <div className="mt-4 flex gap-2">
              <Link href={`/shop/?id=${supplier.id}`} className="btn-ghost btn-sm flex-1">{t("view_shop")}</Link>
              <a className="btn-ghost btn-sm flex-1" target="_blank" rel="noopener noreferrer" href={`https://www.google.com/maps/dir/?api=1&destination=${supplier.lat},${supplier.lng}`}>{t("directions")}</a>
            </div>
          </div>
        </div>
      </div>

      {!!more.data?.length && (
        <section className="mt-12">
          <h2 className="section-title mb-5 text-xl">More from {supplier.name}</h2>
          <PartGrid>{more.data.map((p) => <PartCard key={p.id} part={p} />)}</PartGrid>
        </section>
      )}

      <Modal open={reportOpen} onClose={() => setReportOpen(false)} title={t("report")}>
        <form
          className="grid gap-3"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await api.reportListing(part.id, reason);
              setReportOpen(false);
              setReason("");
              toast("Thanks — our team will review this listing.");
            } catch (err) {
              toast((err as Error).message, "err");
            }
          }}
        >
          <textarea className="input min-h-28" required minLength={5} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Wrong photos, misleading price, already sold, unsafe part…" />
          <button className="btn-primary">{t("report")}</button>
        </form>
      </Modal>
      {isDemo && <p className="mt-10 text-center text-xs text-charcoal-400">Demo mode: inquiries are logged in your browser only.</p>}
    </div>
  );
}

export default function PartPage() {
  return (
    <Suspense fallback={<div className="container-x py-16" />}>
      <PartInner />
    </Suspense>
  );
}
