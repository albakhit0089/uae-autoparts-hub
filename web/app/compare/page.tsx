"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { api } from "@/lib/api";
import { useData } from "@/lib/hooks";
import { useI18n } from "@/lib/i18n";
import { assessCompatibility } from "@/lib/search";
import { partTypeLabel } from "@/lib/data/taxonomy";
import { makeLabel, modelLabel } from "@/lib/data/vehicles";
import { emirateLabel } from "@/lib/data/emirates";
import { CompatBadge, ConditionBadge, Empty, PageHeader, StatusBadge, useAgo } from "@/components/ui";
import { Icon } from "@/components/icons";

function CompareInner() {
  const id = useSearchParams().get("id") ?? "";
  const { t, lang, fmtPrice } = useI18n();
  const ago = useAgo();
  const { data, error } = useData(() => api.compare(id), [id]);
  if (error) return <div className="container-x py-16"><Empty>{error}</Empty></div>;
  if (!data) return <div className="container-x py-16 text-center text-charcoal-500">{t("loading")}</div>;
  const { base, rows, suppliers } = data;
  const prices = rows.map((r) => r.part.price);
  const min = Math.min(...prices);

  return (
    <>
      <PageHeader
        title={`${t("compare_title")}: ${partTypeLabel(base.partTypeId, lang)} — ${makeLabel(base.make, lang)} ${modelLabel(base.make, base.model, lang)}`}
        sub={`${base.generation ?? ""} ${base.yearFrom}–${base.yearTo}${base.engine ? ` · ${base.engine}` : ""}${base.oem ? ` · OEM ${base.oem}` : ""}`}
      >
        <Link href={`/part/?id=${base.id}`} className="btn-ghost btn-sm">← {t("back")}</Link>
      </PageHeader>
      <div className="container-x py-8">
        <p className="mb-4 flex gap-2 rounded-xl bg-navy-50 p-3 text-sm text-navy-900 dark:bg-navy-950/50 dark:text-navy-100"><Icon.scale size={18} className="shrink-0" />{t("compare_note")}</p>
        {rows.length <= 1 && <Empty>Only one supplier currently lists this exact part. <Link className="btn-primary btn-sm" href="/request/">{t("nav_request")}</Link></Empty>}
        {rows.length > 1 && (
          <div className="card overflow-x-auto">
            <table className="table-x min-w-[860px]">
              <thead>
                <tr>
                  <th>{t("price")}</th>
                  <th>{t("supplier")}</th>
                  <th>{t("emirate")}</th>
                  <th>{t("condition")}</th>
                  <th>{t("warranty")}</th>
                  <th>{t("last_verified")}</th>
                  <th>{t("delivery")}</th>
                  <th>Fitment</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ part, basis }) => {
                  const s = suppliers[part.supplierId];
                  return (
                    <tr key={part.id} className={part.id === base.id ? "bg-accent-500/5" : ""}>
                      <td className="font-bold tabular-nums">
                        {fmtPrice(part.price)}
                        {part.price === min && <span className="chip ms-2 bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">Lowest</span>}
                      </td>
                      <td>{lang === "ar" && s?.nameAr ? s.nameAr : s?.name}</td>
                      <td>{emirateLabel(part.emirate, lang)}</td>
                      <td><ConditionBadge value={part.condition} /></td>
                      <td>{part.warrantyDays > 0 ? `${part.warrantyDays}d` : "—"}</td>
                      <td className="whitespace-nowrap"><StatusBadge value={part.status} /> <span className="text-xs text-charcoal-500">{ago(part.lastVerified)}</span></td>
                      <td>{s?.delivery ? <Icon.check size={16} className="text-emerald-600" /> : "—"}</td>
                      <td>
                        <CompatBadge value={assessCompatibility(part, { make: base.make, model: base.model, year: base.yearFrom, engine: base.engine, oem: base.oem })} />
                        <div className="mt-1 text-[11px] text-charcoal-500">{basis === "oem" ? t("compare_basis_oem") : t("compare_basis_fitment")}</div>
                      </td>
                      <td><Link href={`/part/?id=${part.id}`} className="btn-navy btn-sm">View</Link></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

export default function ComparePage() {
  return (
    <Suspense fallback={null}>
      <CompareInner />
    </Suspense>
  );
}
