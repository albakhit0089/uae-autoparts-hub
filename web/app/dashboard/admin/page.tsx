"use client";

import Link from "next/link";
import { Fragment, useState } from "react";
import { api } from "@/lib/api";
import { useData, useToast } from "@/lib/hooks";
import { useI18n } from "@/lib/i18n";
import { CATEGORIES, partTypeLabel } from "@/lib/data/taxonomy";
import { MAKES, makeLabel, modelLabel } from "@/lib/data/vehicles";
import { emirateLabel } from "@/lib/data/emirates";
import { BarChart } from "@/components/charts";
import { Empty, PageHeader, RequireRole, Stat, StatusBadge, Tabs, useAgo } from "@/components/ui";
import { ImportReport } from "@/components/import-report";
import type { Supplier } from "@/lib/types";

type Tab = "overview" | "suppliers" | "moderation" | "stale" | "duplicates" | "imports" | "inquiries" | "reports" | "taxonomy" | "plans" | "audit";

function useAct() {
  const toast = useToast();
  return async (fn: () => Promise<unknown>, ok?: string) => {
    try {
      await fn();
      if (ok) toast(ok);
    } catch (e) {
      toast((e as Error).message, "err");
    }
  };
}

function Overview() {
  const { t, fmtNum } = useI18n();
  const { data } = useData(() => api.adminOverview());
  if (!data) return <p>{t("loading")}</p>;
  const weeks = (arr: number[]) => arr.map((value, i) => ({ label: i === arr.length - 1 ? "This wk" : `-${arr.length - 1 - i}w`, value }));
  return (
    <div className="grid gap-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Stat label="Approved suppliers" value={fmtNum(data.suppliers.approved)} />
        <Stat label="Pending suppliers" value={fmtNum(data.suppliers.pending)} tone="amber" />
        <Stat label="Live listings" value={fmtNum(data.listings)} tone="green" />
        <Stat label="Listings to review" value={fmtNum(data.pendingListings)} tone="amber" />
        <Stat label="Inquiries (30d)" value={fmtNum(data.inquiries30d)} tone="accent" />
        <Stat label="Request response rate" value={`${data.responseRate}%`} hint={`${fmtNum(data.openReports)} open reports`} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <BarChart title="Approved + pending suppliers (cumulative)" data={weeks(data.charts.supplierGrowth)} />
        <BarChart title="Listed inventory (cumulative)" data={weeks(data.charts.inventory)} />
        <BarChart title="Search demand per day (last 30 days)" data={data.charts.searches.map((s) => ({ label: s.day.slice(5), value: s.count }))} />
        <BarChart title="WhatsApp inquiries per week" data={weeks(data.charts.inquiries)} />
      </div>
      <p className="text-xs text-charcoal-500">Sample activity is generated for the demo; production charts read from the inquiries, searches and suppliers tables.</p>
    </div>
  );
}

function Suppliers() {
  const { t, lang } = useI18n();
  const act = useAct();
  const { data } = useData(() => api.adminSuppliers());
  const [filter, setFilter] = useState<"all" | Supplier["status"]>("pending");
  const [open, setOpen] = useState<string | null>(null);
  if (!data) return <p>{t("loading")}</p>;
  const list = data.filter((s) => filter === "all" || s.status === filter);
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap gap-2">
        {(["pending", "approved", "suspended", "rejected", "all"] as const).map((f) => (
          <button key={f} className={`chip px-3 py-1.5 capitalize ${filter === f ? "bg-navy-800 text-white" : "bg-charcoal-100 dark:bg-charcoal-800"}`} onClick={() => setFilter(f)}>
            {f} ({f === "all" ? data.length : data.filter((s) => s.status === f).length})
          </button>
        ))}
      </div>
      {!list.length ? <Empty>{t("nothing_here")}</Empty> : (
        <div className="card overflow-x-auto">
          <table className="table-x min-w-[860px]">
            <thead><tr><th>{t("supplier")}</th><th>{t("location")}</th><th>{t("trade_licence")}</th><th>{t("listings")}</th><th>{t("status")}</th><th>{t("actions")}</th></tr></thead>
            <tbody>
              {list.map((s) => (
                <Fragment key={s.id}>
                  <tr>
                    <td>
                      <div className="font-medium">{s.name}</div>
                      <div className="text-xs text-charcoal-500">{s.email} · {s.phone || "—"}</div>
                      {s.isSample && <span className="chip mt-1 bg-accent-500/10 text-accent-700">{t("sample_record")}</span>}
                    </td>
                    <td className="text-xs">{emirateLabel(s.emirate, lang)}<br />{s.address}</td>
                    <td className="font-mono text-xs">{s.tradeLicence}</td>
                    <td className="tabular-nums">{s.listings}</td>
                    <td><StatusBadge value={s.status} />{s.featured && <span className="chip ms-1 bg-accent-500 text-white">★</span>}</td>
                    <td>
                      <div className="flex flex-wrap gap-1">
                        <button className="btn-ghost btn-sm" onClick={() => setOpen(open === s.id ? null : s.id)}>{t("documents")} ({s.docs.length})</button>
                        {s.status !== "approved" && <button className="btn-primary btn-sm" onClick={() => act(() => api.setSupplierStatus(s.id, "approved"), "Approved")}>{s.status === "suspended" ? t("reinstate") : t("approve")}</button>}
                        {s.status === "pending" && <button className="btn-ghost btn-sm" onClick={() => act(() => api.setSupplierStatus(s.id, "rejected"))}>{t("reject")}</button>}
                        {s.status === "approved" && <button className="btn-ghost btn-sm text-red-600" onClick={() => confirm("Suspend this supplier? Their listings will be hidden.") && act(() => api.setSupplierStatus(s.id, "suspended"))}>{t("suspend")}</button>}
                        {s.status === "approved" && <button className="btn-ghost btn-sm" onClick={() => act(() => api.toggleSupplierFeatured(s.id))}>{s.featured ? t("unfeature") : t("feature")}</button>}
                      </div>
                    </td>
                  </tr>
                  {open === s.id && (
                    <tr>
                      <td colSpan={6} className="bg-charcoal-50 dark:bg-charcoal-800/50">
                        <div className="grid gap-2 text-sm sm:grid-cols-2">
                          <div>
                            <strong>Verification checklist</strong>
                            <ul className="mt-1 list-disc ps-5 text-xs text-charcoal-600 dark:text-charcoal-300">
                              <li>Trade licence number matches the uploaded document and the issuing authority register</li>
                              <li>Licence activity covers used spare parts trading / vehicle dismantling</li>
                              <li>Licence is valid (not expired) and business name matches</li>
                              <li>Contact phone verified by call or WhatsApp</li>
                            </ul>
                          </div>
                          <div>
                            <strong>Documents</strong>
                            <ul className="mt-1 grid gap-1 text-xs">
                              {s.docs.map((d, i) => <li key={i}>{d.name} · {d.kind} · {d.sizeKb} KB · {new Date(d.uploadedAt).toLocaleDateString()}</li>)}
                            </ul>
                            <p className="mt-2 text-xs text-charcoal-500">Makes: {s.makes.map((m) => makeLabel(m)).join(", ")} · Categories: {s.categories.join(", ")}</p>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ListingsTable({ filter }: { filter: "pending" | "stale" | "all" | "featured" }) {
  const { t, lang, fmtPrice } = useI18n();
  const ago = useAgo();
  const act = useAct();
  const { data } = useData(() => api.adminListings(filter), [filter]);
  if (!data) return <p>{t("loading")}</p>;
  if (!data.parts.length) return <Empty>{t("nothing_here")}</Empty>;
  return (
    <div className="card overflow-x-auto">
      <table className="table-x min-w-[900px]">
        <thead><tr><th>{t("part")}</th><th>{t("supplier")}</th><th>{t("price")}</th><th>{t("moderation")}</th><th>{t("last_verified")}</th><th>{t("actions")}</th></tr></thead>
        <tbody>
          {data.parts.map((p) => (
            <tr key={p.id}>
              <td>
                <Link href={`/part/?id=${p.id}`} className="font-medium hover:underline">{partTypeLabel(p.partTypeId, lang)} · {makeLabel(p.make, lang)} {modelLabel(p.make, p.model, lang)}</Link>
                <div className="text-xs text-charcoal-500">{p.yearFrom}–{p.yearTo} {p.oem ? `· ${p.oem}` : ""} · source: {p.source}</div>
              </td>
              <td className="text-xs">{data.suppliers[p.supplierId]?.name}</td>
              <td className="tabular-nums">{fmtPrice(p.price)}</td>
              <td><StatusBadge value={p.moderation} /> <StatusBadge value={p.status} /></td>
              <td className="text-xs text-charcoal-500">{ago(p.lastVerified)}</td>
              <td>
                <div className="flex flex-wrap gap-1">
                  {p.moderation !== "approved" && <button className="btn-primary btn-sm" onClick={() => act(() => api.moderatePart(p.id, "approved"))}>{t("approve")}</button>}
                  {p.moderation !== "rejected" && <button className="btn-ghost btn-sm" onClick={() => act(() => api.moderatePart(p.id, "rejected"))}>{t("reject")}</button>}
                  <button className="btn-ghost btn-sm" onClick={() => act(() => api.toggleFeatured(p.id))}>{p.featured ? t("unfeature") : t("feature")}</button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Duplicates() {
  const { t, lang, fmtPrice } = useI18n();
  const act = useAct();
  const { data } = useData(() => api.adminDuplicates());
  if (!data) return <p>{t("loading")}</p>;
  if (!data.length) return <Empty>No duplicate groups detected.</Empty>;
  return (
    <div className="grid gap-3">
      {data.map((g, i) => (
        <div key={i} className="card p-4">
          <p className="mb-2 text-sm font-semibold">{partTypeLabel(g[0].partTypeId, lang)} · {makeLabel(g[0].make, lang)} {modelLabel(g[0].make, g[0].model, lang)} — {g.length} records from the same supplier</p>
          <ul className="grid gap-1 text-sm">
            {g.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-charcoal-50 px-3 py-2 dark:bg-charcoal-800">
                <span>#{p.id} · {fmtPrice(p.price)} · {p.oem ?? "no OEM"} · {p.source}</span>
                <button className="btn-ghost btn-sm text-red-600" onClick={() => act(() => api.adminRemovePart(p.id), "Removed")}>{t("remove")}</button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function Imports() {
  const { t } = useI18n();
  const { data } = useData(() => api.adminImports());
  if (!data) return <p>{t("loading")}</p>;
  if (!data.length) return <Empty>No imports yet. Log in as the demo supplier and upload a CSV to see reports here.</Empty>;
  return <div className="grid gap-4 lg:grid-cols-2">{data.map((j) => <div key={j.id} className="card p-4"><p className="mb-2 text-xs text-charcoal-500">Supplier {j.supplierId}</p><ImportReport job={j} /></div>)}</div>;
}

function Inquiries() {
  const { t, lang } = useI18n();
  const ago = useAgo();
  const { data } = useData(() => api.adminInquiries());
  if (!data) return <p>{t("loading")}</p>;
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="card overflow-x-auto">
        <h3 className="p-4 pb-0 font-semibold">{t("requests")}</h3>
        <table className="table-x">
          <thead><tr><th>Request</th><th>Matched</th><th>Quotes</th><th>{t("status")}</th></tr></thead>
          <tbody>
            {data.requests.map(({ request: r, quotes }) => (
              <tr key={r.id}>
                <td>{partTypeLabel(r.partTypeId, lang)} · {makeLabel(r.make, lang)} {r.year}<div className="text-xs text-charcoal-500">{ago(r.createdAt)}</div></td>
                <td className="tabular-nums">{r.matchedSupplierIds.length}</td>
                <td className="tabular-nums">{quotes}</td>
                <td><StatusBadge value={r.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="card max-h-[520px] overflow-auto">
        <h3 className="p-4 pb-0 font-semibold">{t("inquiries")}</h3>
        <table className="table-x">
          <thead><tr><th>{t("part")}</th><th>{t("supplier")}</th><th>When</th></tr></thead>
          <tbody>
            {data.inquiries.map(({ inquiry: i, part: p }) => (
              <tr key={i.id}><td className="text-xs">{p ? `${partTypeLabel(p.partTypeId, lang)} · ${makeLabel(p.make, lang)}` : i.partId}</td><td className="text-xs">{i.supplierId}</td><td className="text-xs text-charcoal-500">{ago(i.createdAt)}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Reports() {
  const { t, lang } = useI18n();
  const act = useAct();
  const ago = useAgo();
  const { data } = useData(() => api.adminReports());
  if (!data) return <p>{t("loading")}</p>;
  if (!data.length) return <Empty>{t("nothing_here")}</Empty>;
  return (
    <div className="grid gap-3">
      {data.map(({ report: r, part: p }) => (
        <div key={r.id} className="card flex flex-wrap items-start justify-between gap-3 p-4">
          <div>
            <div className="flex items-center gap-2"><StatusBadge value={r.status} /><span className="text-xs text-charcoal-500">{ago(r.createdAt)}</span></div>
            <p className="mt-1 text-sm">{r.reason}</p>
            {p && <Link className="text-xs text-accent-600 hover:underline" href={`/part/?id=${p.id}`}>{partTypeLabel(p.partTypeId, lang)} · {makeLabel(p.make, lang)} {modelLabel(p.make, p.model, lang)} (#{p.id})</Link>}
          </div>
          {r.status === "open" && (
            <div className="flex gap-2">
              <button className="btn-ghost btn-sm" onClick={() => act(() => api.resolveReport(r.id, "dismiss"))}>{t("dismiss")}</button>
              <button className="btn-sm btn bg-red-600 text-white hover:bg-red-700" onClick={() => act(() => api.resolveReport(r.id, "remove-listing"))}>Remove listing</button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function Taxonomy() {
  const { lang } = useI18n();
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="card p-4">
        <h3 className="mb-3 font-semibold">Part categories & synonyms</h3>
        <div className="grid max-h-[560px] gap-3 overflow-y-auto text-sm">
          {CATEGORIES.map((c) => (
            <div key={c.id}>
              <div className="font-semibold">{c.en} · {c.ar}</div>
              <ul className="mt-1 grid gap-1">
                {c.types.map((tp) => (
                  <li key={tp.id} className="rounded-lg bg-charcoal-50 px-3 py-1.5 text-xs dark:bg-charcoal-800">
                    <strong>{lang === "ar" ? tp.ar : tp.en}</strong>{tp.safetyCritical && <span className="chip ms-1 bg-red-50 text-red-700">safety-critical</span>}
                    <div className="text-charcoal-500">{tp.synonyms.join(", ")}</div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
      <div className="card p-4">
        <h3 className="mb-3 font-semibold">Vehicle catalogue</h3>
        <div className="grid max-h-[560px] gap-2 overflow-y-auto text-xs">
          {MAKES.map((m) => (
            <div key={m.id}>
              <strong className="text-sm">{m.name}</strong>
              {m.models.map((md) => <div key={md.id} className="ps-3 text-charcoal-600 dark:text-charcoal-400">{md.name}: {md.generations.map((g) => `${g.code} (${g.yearFrom}–${g.yearTo}: ${g.variants.map((v) => v.engineCode).join("/")})`).join(", ")}</div>)}
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-charcoal-500">Taxonomy and catalogue are versioned in the database (tables <code>part_categories</code>, <code>part_types</code>, <code>makes</code>, <code>models</code>, <code>generations</code>, <code>variants</code>) and refreshed by the vehicle import job. See docs/DATA_SOURCES.md.</p>
      </div>
    </div>
  );
}

function Plans() {
  const { t } = useI18n();
  const act = useAct();
  const { data } = useData(() => api.plans());
  if (!data) return <p>{t("loading")}</p>;
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {data.map((p) => (
        <form
          key={p.id}
          className="card grid gap-3 p-5"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            act(() => api.updatePlan(p.id, { priceAed: Number(fd.get("price")), listingLimit: Number(fd.get("limit")), featuredSlots: Number(fd.get("slots")), active: fd.get("active") === "on" }), t("saved_ok"));
          }}
        >
          <h3 className="text-lg font-bold">{p.name}</h3>
          <label><span className="label">AED / month</span><input name="price" className="input" type="number" min={0} defaultValue={p.priceAed} /></label>
          <label><span className="label">Listing limit</span><input name="limit" className="input" type="number" min={0} defaultValue={p.listingLimit} /></label>
          <label><span className="label">Featured slots</span><input name="slots" className="input" type="number" min={0} defaultValue={p.featuredSlots} /></label>
          <label className="flex items-center gap-2 text-sm"><input name="active" type="checkbox" defaultChecked={p.active} />Available for sign-up</label>
          <button className="btn-navy">{t("save")}</button>
        </form>
      ))}
      <p className="text-xs text-charcoal-500 md:col-span-3">MVP: free onboarding; payments are not enabled. Paid plans are configured here and activated when a payment provider is connected.</p>
    </div>
  );
}

function Audit() {
  const { t } = useI18n();
  const { data } = useData(() => api.auditLog());
  if (!data) return <p>{t("loading")}</p>;
  return (
    <div className="card overflow-x-auto">
      <table className="table-x">
        <thead><tr><th>When</th><th>Actor</th><th>Action</th><th>Target</th></tr></thead>
        <tbody>{data.map((a) => <tr key={a.id}><td className="whitespace-nowrap text-xs">{new Date(a.at).toLocaleString()}</td><td className="text-xs">{a.actor}</td><td className="font-mono text-xs">{a.action}</td><td className="font-mono text-xs">{a.target}</td></tr>)}</tbody>
      </table>
    </div>
  );
}

function Admin() {
  const { t } = useI18n();
  const [tab, setTab] = useState<Tab>("overview");
  const ov = useData(() => api.adminOverview());
  return (
    <>
      <PageHeader title={t("admin_dashboard")} sub="Supplier verification, listing moderation, data quality and platform activity." />
      <div className="container-x py-6">
        <Tabs<Tab>
          value={tab}
          onChange={setTab}
          tabs={[
            { id: "overview", label: t("overview") },
            { id: "suppliers", label: t("suppliers"), badge: ov.data?.suppliers.pending },
            { id: "moderation", label: t("moderation"), badge: ov.data?.pendingListings },
            { id: "stale", label: t("stale_stock") },
            { id: "duplicates", label: t("duplicates") },
            { id: "imports", label: t("imports") },
            { id: "inquiries", label: t("inquiries") },
            { id: "reports", label: t("reports"), badge: ov.data?.openReports },
            { id: "taxonomy", label: t("taxonomy") },
            { id: "plans", label: t("plans") },
            { id: "audit", label: t("audit") },
          ]}
        />
        <div className="mt-6">
          {tab === "overview" && <Overview />}
          {tab === "suppliers" && <Suppliers />}
          {tab === "moderation" && <ListingsTable filter="pending" />}
          {tab === "stale" && <ListingsTable filter="stale" />}
          {tab === "duplicates" && <Duplicates />}
          {tab === "imports" && <Imports />}
          {tab === "inquiries" && <Inquiries />}
          {tab === "reports" && <Reports />}
          {tab === "taxonomy" && <Taxonomy />}
          {tab === "plans" && <Plans />}
          {tab === "audit" && <Audit />}
        </div>
      </div>
    </>
  );
}

export default function AdminPage() {
  return (
    <RequireRole roles={["admin"]}>
      <Admin />
    </RequireRole>
  );
}
