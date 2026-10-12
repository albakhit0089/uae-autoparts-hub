"use client";

import Link from "next/link";
import Papa from "papaparse";
import { useState } from "react";
import { api, API_URL, isDemo } from "@/lib/api";
import { useData, useToast } from "@/lib/hooks";
import { useI18n } from "@/lib/i18n";
import { CATEGORIES, findPartType, partTypeLabel } from "@/lib/data/taxonomy";
import { EMIRATES, emirateLabel } from "@/lib/data/emirates";
import { makeLabel, modelLabel, generationsFor } from "@/lib/data/vehicles";
import { ImportReport } from "@/components/import-report";
import { templateCsv, TEMPLATE_COLUMNS, type RawRow } from "@/lib/importer";
import { ConditionBadge, Empty, Field, Modal, PageHeader, RequireRole, Stat, StatusBadge, Tabs, VehicleSelector, fileToResizedDataUrl, useAgo, type VehicleValue } from "@/components/ui";
import { Icon } from "@/components/icons";
import type { Condition, Emirate, ImportJob, Part, PartRequest, Quotation } from "@/lib/types";

type Tab = "overview" | "listings" | "import" | "inquiries" | "requests" | "profile" | "api";

function PartForm({ initial, onDone }: { initial?: Part; onDone: () => void }) {
  const { t, lang } = useI18n();
  const toast = useToast();
  const [v, setV] = useState<VehicleValue>(initial ? { make: initial.make, model: initial.model, year: initial.yearFrom, engine: initial.engine } : {});
  const [f, setF] = useState({
    partTypeId: initial?.partTypeId ?? "", name: initial?.name ?? "", oem: initial?.oem ?? "", yearFrom: String(initial?.yearFrom ?? ""), yearTo: String(initial?.yearTo ?? ""),
    transmission: initial?.transmission ?? "", generation: initial?.generation ?? "", marketSpec: initial?.marketSpec ?? "GCC", condition: (initial?.condition ?? "used") as Condition,
    price: String(initial?.price ?? ""), quantity: String(initial?.quantity ?? 1), warrantyDays: String(initial?.warrantyDays ?? 0), description: initial?.description ?? "", donorVehicle: initial?.donorVehicle ?? "",
  });
  const [images, setImages] = useState<string[]>(initial?.images.filter((x) => !x.startsWith("sample:")) ?? []);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF((s) => ({ ...s, [k]: e.target.value }));
  const pt = findPartType(f.partTypeId);

  const onVehicle = (nv: VehicleValue) => {
    setV(nv);
    if (nv.year) {
      const g = generationsFor(nv.make, nv.model, nv.year)[0];
      setF((s) => ({ ...s, yearFrom: s.yearFrom || String(g?.yearFrom ?? nv.year), yearTo: s.yearTo || String(g?.yearTo ?? nv.year), generation: s.generation || g?.code || "" }));
    }
  };

  return (
    <form
      className="grid gap-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          await api.savePart({
            id: initial?.id, partTypeId: f.partTypeId, name: f.name || undefined, oem: f.oem || undefined, make: v.make, model: v.model, engine: v.engine,
            generation: f.generation || undefined, yearFrom: Number(f.yearFrom), yearTo: Number(f.yearTo), transmission: f.transmission || undefined,
            marketSpec: f.marketSpec as Part["marketSpec"], condition: f.condition, price: Number(f.price), quantity: Number(f.quantity), warrantyDays: Number(f.warrantyDays),
            description: f.description, donorVehicle: f.donorVehicle || undefined, images,
          });
          toast(t("saved_ok"));
          onDone();
        } catch (err) {
          toast((err as Error).message, "err");
        } finally {
          setBusy(false);
        }
      }}
    >
      <VehicleSelector value={v} onChange={onVehicle} required />
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label={t("part")}>
          <select className="input" required value={f.partTypeId} onChange={set("partTypeId")}>
            <option value="">{t("select")}</option>
            {CATEGORIES.map((c) => (
              <optgroup key={c.id} label={lang === "ar" ? c.ar : c.en}>
                {c.types.map((tp) => <option key={tp.id} value={tp.id}>{lang === "ar" ? tp.ar : tp.en}{tp.safetyCritical ? " ⚠" : ""}</option>)}
              </optgroup>
            ))}
          </select>
        </Field>
        <Field label={t("part_details")}><input className="input" maxLength={120} value={f.name} onChange={set("name")} /></Field>
        <Field label={`${t("oem")}${pt?.safetyCritical ? " *" : ""}`}><input className="input font-mono" required={!!pt?.safetyCritical} maxLength={40} value={f.oem} onChange={set("oem")} /></Field>
        <Field label={`${t("year")} from`}><input className="input" type="number" required min={1980} max={2030} value={f.yearFrom} onChange={set("yearFrom")} /></Field>
        <Field label={`${t("year")} to`}><input className="input" type="number" required min={1980} max={2030} value={f.yearTo} onChange={set("yearTo")} /></Field>
        <Field label={t("generation")}><input className="input" maxLength={20} value={f.generation} onChange={set("generation")} /></Field>
        <Field label={t("transmission")}><input className="input" maxLength={60} value={f.transmission} onChange={set("transmission")} /></Field>
        <Field label={t("market_spec")}>
          <select className="input" value={f.marketSpec} onChange={set("marketSpec")}><option>GCC</option><option>Imported</option><option>Unknown</option></select>
        </Field>
        <Field label={t("condition")}>
          <select className="input" value={f.condition} onChange={set("condition")}>{(["used", "tested", "refurbished"] as const).map((c) => <option key={c} value={c}>{t(`cond_${c}`)}</option>)}</select>
        </Field>
        <Field label={`${t("price")} (AED)`}><input className="input" type="number" required min={1} value={f.price} onChange={set("price")} /></Field>
        <Field label={t("quantity")}><input className="input" type="number" min={0} value={f.quantity} onChange={set("quantity")} /></Field>
        <Field label={`${t("warranty")} (days)`}><input className="input" type="number" min={0} max={730} value={f.warrantyDays} onChange={set("warrantyDays")} /></Field>
      </div>
      <Field label={t("donor_vehicle")}><input className="input" maxLength={120} value={f.donorVehicle} onChange={set("donorVehicle")} placeholder="e.g. 2016 C200 GCC, 85,000 km" /></Field>
      <Field label={t("description")}><textarea className="input min-h-24" maxLength={2000} value={f.description} onChange={set("description")} /></Field>
      <Field label={t("images")} hint={t("images_hint")}>
        <input
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp"
          className="block w-full text-sm file:me-3 file:rounded-lg file:border-0 file:bg-navy-50 file:px-3 file:py-2 file:font-semibold file:text-navy-800"
          onChange={async (e) => {
            try {
              const add = await Promise.all([...(e.target.files ?? [])].slice(0, 6 - images.length).map((x) => fileToResizedDataUrl(x)));
              setImages((s) => [...s, ...add].slice(0, 6));
            } catch (err) {
              toast((err as Error).message, "err");
            }
          }}
        />
      </Field>
      {!!images.length && (
        <div className="flex flex-wrap gap-2">
          {images.map((src, i) => (
            <div key={i} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" className="h-20 w-24 rounded-lg object-cover" />
              <button type="button" className="absolute -end-1.5 -top-1.5 rounded-full bg-red-600 p-0.5 text-white" onClick={() => setImages((s) => s.filter((_, j) => j !== i))} aria-label="Remove photo"><Icon.close size={12} /></button>
            </div>
          ))}
        </div>
      )}
      {pt?.safetyCritical && <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-900 dark:bg-amber-950 dark:text-amber-200">⚠ {t("safety_notice")} Listings of this type are reviewed by an administrator before they go live.</p>}
      <div className="flex justify-end gap-2">
        <button type="button" className="btn-ghost" onClick={onDone}>{t("cancel")}</button>
        <button className="btn-primary" disabled={busy}>{t("save_part")}</button>
      </div>
    </form>
  );
}

function Overview({ go }: { go: (t: Tab) => void }) {
  const { t, lang, fmtNum } = useI18n();
  const { data } = useData(() => api.supplierStats());
  if (!data) return <p className="text-charcoal-500">{t("loading")}</p>;
  return (
    <div className="grid gap-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Stat label={t("total_parts")} value={fmtNum(data.total)} />
        <Stat label={t("available_stock")} value={fmtNum(data.available)} tone="green" />
        <Stat label={t("inquiries_received")} value={fmtNum(data.inquiries)} tone="accent" />
        <Stat label={t("quotations_sent")} value={fmtNum(data.quotations)} />
        <Stat label={t("need_verification")} value={fmtNum(data.needsVerification)} tone="amber" hint="> 30 days" />
        <Stat label={t("pending_moderation")} value={fmtNum(data.pendingModeration)} tone="amber" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card p-5">
          <h3 className="mb-3 font-semibold">{t("most_viewed")}</h3>
          <ol className="grid gap-2 text-sm">
            {data.mostViewed.map((p, i) => (
              <li key={p.id} className="flex items-center justify-between gap-3">
                <span className="truncate"><span className="me-2 text-charcoal-400">{i + 1}.</span>{partTypeLabel(p.partTypeId, lang)} · {makeLabel(p.make, lang)} {modelLabel(p.make, p.model, lang)}</span>
                <span className="tabular-nums text-charcoal-500">{fmtNum(p.views)} {t("views")}</span>
              </li>
            ))}
          </ol>
        </div>
        <div className="card grid content-start gap-2 p-5">
          <h3 className="mb-1 font-semibold">Quick actions</h3>
          <button className="btn-ghost justify-start" onClick={() => go("listings")}><Icon.plus size={16} />{t("add_part")}</button>
          <button className="btn-ghost justify-start" onClick={() => go("import")}><Icon.upload size={16} />{t("import")}</button>
          <button className="btn-ghost justify-start" onClick={() => go("requests")}><Icon.scale size={16} />{t("requests")}</button>
        </div>
      </div>
    </div>
  );
}

function Listings() {
  const { t, lang, fmtPrice } = useI18n();
  const toast = useToast();
  const ago = useAgo();
  const { data } = useData(() => api.myParts());
  const [editing, setEditing] = useState<Part | "new" | null>(null);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const list = (data ?? []).filter((p) => !q || `${p.name} ${p.oem} ${p.make} ${p.model} ${p.sku}`.toLowerCase().includes(q.toLowerCase()));
  const stale = (p: Part) => Date.now() - new Date(p.lastVerified).getTime() > 30 * 86_400_000;
  const act = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
    } catch (e) {
      toast((e as Error).message, "err");
    }
  };
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <input className="input max-w-xs" placeholder={`${t("search")}…`} value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="btn-primary" onClick={() => setEditing("new")}><Icon.plus size={16} />{t("add_part")}</button>
        {!!selected.length && <button className="btn-ghost" onClick={() => act(async () => { await api.verifyStock(selected); setSelected([]); toast(t("saved_ok")); })}><Icon.check size={16} />{t("confirm_stock")} ({selected.length})</button>}
      </div>
      {!data ? <p>{t("loading")}</p> : !list.length ? <Empty>{t("nothing_here")}</Empty> : (
        <div className="card overflow-x-auto">
          <table className="table-x min-w-[900px]">
            <thead>
              <tr>
                <th><input type="checkbox" aria-label="Select all" checked={selected.length === list.length} onChange={(e) => setSelected(e.target.checked ? list.map((p) => p.id) : [])} /></th>
                <th>{t("part")}</th><th>{t("price")}</th><th>{t("quantity")}</th><th>{t("status")}</th><th>{t("last_verified")}</th><th>{t("views")}</th><th>{t("actions")}</th>
              </tr>
            </thead>
            <tbody>
              {list.map((p) => (
                <tr key={p.id}>
                  <td><input type="checkbox" checked={selected.includes(p.id)} onChange={(e) => setSelected((s) => (e.target.checked ? [...s, p.id] : s.filter((x) => x !== p.id)))} aria-label="Select" /></td>
                  <td>
                    <Link href={`/part/?id=${p.id}`} className="font-medium hover:underline">{partTypeLabel(p.partTypeId, lang)} · {makeLabel(p.make, lang)} {modelLabel(p.make, p.model, lang)}</Link>
                    <div className="text-xs text-charcoal-500">{p.yearFrom}–{p.yearTo} {p.engine ?? ""} {p.oem ? `· ${p.oem}` : ""} {p.sku ? `· SKU ${p.sku}` : ""}</div>
                    <div className="mt-1 flex gap-1"><ConditionBadge value={p.condition} />{p.moderation !== "approved" && <StatusBadge value={p.moderation} />}<span className="chip bg-charcoal-100 text-charcoal-600 dark:bg-charcoal-800">{p.source}</span></div>
                  </td>
                  <td className="font-semibold tabular-nums">{fmtPrice(p.price)}</td>
                  <td className="tabular-nums">{p.quantity}</td>
                  <td><StatusBadge value={p.status} /></td>
                  <td className={stale(p) ? "font-semibold text-amber-600" : "text-charcoal-500"}>{ago(p.lastVerified)}</td>
                  <td className="tabular-nums text-charcoal-500">{p.views}</td>
                  <td>
                    <div className="flex flex-wrap gap-1">
                      <button className="btn-ghost btn-sm" onClick={() => setEditing(p)}>{t("edit")}</button>
                      {p.status !== "sold" && <button className="btn-ghost btn-sm" onClick={() => act(() => api.setPartStatus(p.id, "sold"))}>{t("mark_sold")}</button>}
                      {p.status === "available" && <button className="btn-ghost btn-sm" onClick={() => act(() => api.setPartStatus(p.id, "reserved"))}>{t("mark_reserved")}</button>}
                      {p.status !== "available" && <button className="btn-ghost btn-sm" onClick={() => act(() => api.setPartStatus(p.id, "available"))}>{t("mark_available")}</button>}
                      {stale(p) && <button className="btn-ghost btn-sm" onClick={() => act(() => api.verifyStock([p.id]))}>{t("confirm_stock")}</button>}
                      <button className="btn-ghost btn-sm text-red-600" onClick={() => confirm(`${t("delete")}?`) && act(() => api.deletePart(p.id))}>{t("delete")}</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing === "new" ? t("add_part") : t("edit_part")}>
        {editing && <PartForm initial={editing === "new" ? undefined : editing} onDone={() => setEditing(null)} />}
      </Modal>
    </div>
  );
}

function ImportTab() {
  const { t } = useI18n();
  const toast = useToast();
  const { data: jobs } = useData(() => api.myImports());
  const [report, setReport] = useState<ImportJob | null>(null);
  const [busy, setBusy] = useState(false);

  const download = () => {
    const blob = new Blob([templateCsv()], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "uae-autoparts-inventory-template.csv";
    a.click();
  };

  const upload = (file: File) => {
    if (!/\.csv$/i.test(file.name)) return toast("Please upload a .csv file (Excel: File → Save As → CSV UTF-8). The API also accepts .xlsx.", "err");
    if (file.size > 5 * 1024 * 1024) return toast("Maximum file size is 5 MB", "err");
    setBusy(true);
    Papa.parse<RawRow>(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (res) => {
        try {
          const job = await api.importRows(file.name, res.data);
          setReport(job);
        } catch (e) {
          toast((e as Error).message, "err");
        } finally {
          setBusy(false);
        }
      },
      error: (err) => {
        toast(err.message, "err");
        setBusy(false);
      },
    });
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
      <div className="card grid content-start gap-4 p-5">
        <h3 className="font-semibold">{t("import")} — Excel / CSV</h3>
        <ol className="list-decimal space-y-1 ps-5 text-sm text-charcoal-600 dark:text-charcoal-400">
          <li>Download the template and fill one row per part (Excel works — save as “CSV UTF-8”).</li>
          <li>Use any common names: “Mercedes Benz”, “C200”, “Gear box”, “قير” are standardized automatically.</li>
          <li>Include a <code>sku</code> to update the same item on later uploads instead of creating a duplicate.</li>
          <li>Safety-critical parts need <code>oem_number</code> and are reviewed before going live.</li>
        </ol>
        <p className="text-xs text-charcoal-500">Columns: <code className="break-all">{TEMPLATE_COLUMNS.join(", ")}</code></p>
        <div className="flex flex-wrap gap-2">
          <button className="btn-ghost" onClick={download}><Icon.download size={16} />{t("download_template")}</button>
          <label className={`btn-primary cursor-pointer ${busy ? "opacity-60" : ""}`}>
            <Icon.upload size={16} />{busy ? t("loading") : t("upload_file")}
            <input type="file" accept=".csv,text/csv" className="sr-only" disabled={busy} onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ""; }} />
          </label>
        </div>
      </div>
      <div className="card p-5">
        <h3 className="mb-3 font-semibold">{t("import_report")}</h3>
        {report ? <ImportReport job={report} /> : <p className="text-sm text-charcoal-500">Upload a file to see the validation report.</p>}
        {!!jobs?.length && (
          <>
            <h4 className="mb-2 mt-6 text-sm font-semibold">History</h4>
            <ul className="grid gap-1 text-sm">
              {jobs.map((j) => (
                <li key={j.id}><button className="w-full rounded-lg px-2 py-1.5 text-start hover:bg-charcoal-100 dark:hover:bg-charcoal-800" onClick={() => setReport(j)}>{j.filename} — {j.created} new, {j.updated} updated, {j.errors.length} issues <span className="text-xs text-charcoal-500">({new Date(j.createdAt).toLocaleString()})</span></button></li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}

function SupplierInquiries() {
  const { t, lang, fmtPrice } = useI18n();
  const ago = useAgo();
  const { data } = useData(() => api.supplierInquiries());
  if (!data) return <p>{t("loading")}</p>;
  if (!data.length) return <Empty>{t("nothing_here")}</Empty>;
  return (
    <div className="card overflow-x-auto">
      <table className="table-x min-w-[640px]">
        <thead><tr><th>{t("part")}</th><th>{t("price")}</th><th>From</th><th>Message</th><th>When</th></tr></thead>
        <tbody>
          {data.map(({ inquiry: i, part: p }) => (
            <tr key={i.id}>
              <td>{p ? `${partTypeLabel(p.partTypeId, lang)} · ${makeLabel(p.make, lang)} ${modelLabel(p.make, p.model, lang)}` : "—"}</td>
              <td>{p ? fmtPrice(p.price) : ""}</td>
              <td>{i.customerId ? "Registered customer" : i.guestName}</td>
              <td className="max-w-md text-xs text-charcoal-600 dark:text-charcoal-400">{i.message}</td>
              <td className="whitespace-nowrap text-xs text-charcoal-500">{ago(i.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="p-3 text-xs text-charcoal-500">The conversation itself continues on WhatsApp. This log records which listings generated inquiries.</p>
    </div>
  );
}

function QuoteForm({ request, existing, onDone }: { request: PartRequest; existing?: Quotation; onDone: () => void }) {
  const { t } = useI18n();
  const toast = useToast();
  const [f, setF] = useState({ price: String(existing?.price ?? ""), availability: existing?.availability ?? "in-stock", condition: existing?.condition ?? "used", warrantyDays: String(existing?.warrantyDays ?? 0), deliveryDays: String(existing?.deliveryDays ?? 1), note: existing?.note ?? "" });
  const [images, setImages] = useState<string[]>(existing?.images ?? []);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF((s) => ({ ...s, [k]: e.target.value }));
  return (
    <form
      className="grid gap-3"
      onSubmit={async (e) => {
        e.preventDefault();
        try {
          await api.submitQuotation({ requestId: request.id, price: Number(f.price), availability: f.availability as Quotation["availability"], condition: f.condition as Condition, warrantyDays: Number(f.warrantyDays), deliveryDays: Number(f.deliveryDays), note: f.note, images });
          toast(t("quote_sent"));
          onDone();
        } catch (err) {
          toast((err as Error).message, "err");
        }
      }}
    >
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Field label={`${t("price")} (AED)`}><input className="input" type="number" min={1} required value={f.price} onChange={set("price")} /></Field>
        <Field label={t("availability")}>
          <select className="input" value={f.availability} onChange={set("availability")}><option value="in-stock">{t("in_stock")}</option><option value="1-3-days">{t("days_1_3")}</option><option value="on-order">{t("on_order")}</option></select>
        </Field>
        <Field label={t("condition")}>
          <select className="input" value={f.condition} onChange={set("condition")}>{(["used", "tested", "refurbished"] as const).map((c) => <option key={c} value={c}>{t(`cond_${c}`)}</option>)}</select>
        </Field>
        <Field label={`${t("warranty")} (days)`}><input className="input" type="number" min={0} value={f.warrantyDays} onChange={set("warrantyDays")} /></Field>
        <Field label={t("delivery_days")}><input className="input" type="number" min={0} value={f.deliveryDays} onChange={set("deliveryDays")} /></Field>
        <Field label={t("photos")}>
          <input type="file" multiple accept="image/jpeg,image/png,image/webp" className="block w-full text-xs" onChange={async (e) => { try { setImages(await Promise.all([...(e.target.files ?? [])].slice(0, 4).map((x) => fileToResizedDataUrl(x, 800)))); } catch (err) { toast((err as Error).message, "err"); } }} />
        </Field>
      </div>
      <Field label={t("note")}><textarea className="input" maxLength={500} value={f.note} onChange={set("note")} /></Field>
      <p className="text-xs text-charcoal-500"><Icon.shield size={12} className="inline" /> {t("customer_contact_hidden")}</p>
      <button className="btn-primary justify-self-end">{existing ? t("update_quote") : t("send_quote")}</button>
    </form>
  );
}

function SupplierRequests() {
  const { t, lang, fmtPrice } = useI18n();
  const ago = useAgo();
  const { data } = useData(() => api.matchedRequests());
  const [active, setActive] = useState<{ request: PartRequest; myQuotation?: Quotation } | null>(null);
  if (!data) return <p>{t("loading")}</p>;
  if (!data.length) return <Empty>{t("nothing_here")}</Empty>;
  return (
    <div className="grid gap-3">
      {data.map((row) => {
        const r = row.request;
        return (
          <div key={r.id} className="card flex flex-wrap items-start justify-between gap-4 p-5">
            <div>
              <div className="flex items-center gap-2"><StatusBadge value={r.status} />{row.myQuotation && <StatusBadge value={row.myQuotation.status} />}<span className="text-xs text-charcoal-500">{ago(r.createdAt)}</span></div>
              <h3 className="mt-1 font-semibold">{partTypeLabel(r.partTypeId, lang)} — {makeLabel(r.make, lang)} {modelLabel(r.make, r.model, lang)} {r.year} {r.engine ?? ""}</h3>
              <p className="text-sm text-charcoal-600 dark:text-charcoal-400">{r.partText}{r.oem ? ` · OEM ${r.oem}` : ""} · {emirateLabel(r.emirate, lang)}{r.budget ? ` · ${t("budget")}: ${fmtPrice(r.budget)}` : ""}</p>
              {r.description && <p className="mt-1 text-sm text-charcoal-500">{r.description}</p>}
              <p className="mt-2 text-xs text-charcoal-500">{r.contactName} · {r.contactPhone}</p>
            </div>
            {r.status === "open" && <button className="btn-primary btn-sm" onClick={() => setActive(row)}>{row.myQuotation ? t("update_quote") : t("send_quote")}</button>}
          </div>
        );
      })}
      <Modal open={!!active} onClose={() => setActive(null)} title={t("send_quote")}>
        {active && <QuoteForm request={active.request} existing={active.myQuotation} onDone={() => setActive(null)} />}
      </Modal>
    </div>
  );
}

function Profile() {
  const { t, lang } = useI18n();
  const toast = useToast();
  const { data: s } = useData(() => api.mySupplier());
  const [f, setF] = useState<Record<string, string | boolean | string[]> | null>(null);
  if (!s) return <p>{t("loading")}</p>;
  const v = f ?? { name: s.name, nameAr: s.nameAr ?? "", phone: s.phone, whatsapp: s.whatsapp, address: s.address, contactName: s.contactName, delivery: s.delivery, emiratesServed: s.emiratesServed };
  const set = (k: string, val: string | boolean | string[]) => setF({ ...v, [k]: val });
  return (
    <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
      <form
        className="card grid gap-3 p-5 sm:grid-cols-2"
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            await api.updateSupplier(v as never);
            setF(null);
            toast(t("saved_ok"));
          } catch (err) {
            toast((err as Error).message, "err");
          }
        }}
      >
        <h3 className="font-semibold sm:col-span-2">{t("profile")}</h3>
        <Field label={t("business_name")}><input className="input" value={v.name as string} onChange={(e) => set("name", e.target.value)} /></Field>
        <Field label={t("business_name_ar")}><input className="input" dir="rtl" value={v.nameAr as string} onChange={(e) => set("nameAr", e.target.value)} /></Field>
        <Field label={t("contact_name")}><input className="input" value={v.contactName as string} onChange={(e) => set("contactName", e.target.value)} /></Field>
        <Field label={t("phone")}><input className="input" value={v.phone as string} onChange={(e) => set("phone", e.target.value)} /></Field>
        <Field label={t("whatsapp_number")} hint="Customers are sent here by the Contact Supplier button."><input className="input" value={v.whatsapp as string} onChange={(e) => set("whatsapp", e.target.value)} placeholder="+9715XXXXXXXX" /></Field>
        <Field label={t("shop_address")}><input className="input" value={v.address as string} onChange={(e) => set("address", e.target.value)} /></Field>
        <div className="sm:col-span-2">
          <span className="label">{t("emirates_served")}</span>
          <div className="flex flex-wrap gap-2">
            {EMIRATES.map((e) => {
              const on = (v.emiratesServed as string[]).includes(e.id);
              return <button type="button" key={e.id} onClick={() => set("emiratesServed", on ? (v.emiratesServed as string[]).filter((x) => x !== e.id) : [...(v.emiratesServed as string[]), e.id])} className={`chip px-3 py-1.5 ring-1 ring-inset ${on ? "bg-navy-800 text-white ring-navy-800" : "ring-charcoal-200 dark:ring-charcoal-700"}`}>{lang === "ar" ? e.ar : e.en}</button>;
            })}
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={v.delivery as boolean} onChange={(e) => set("delivery", e.target.checked)} />{t("offers_delivery")}</label>
        <button className="btn-primary justify-self-end sm:col-span-2">{t("save")}</button>
      </form>
      <div className="card grid content-start gap-3 p-5">
        <h3 className="font-semibold">{t("documents")}</h3>
        <div className="flex items-center gap-2 text-sm">{t("status")}: <StatusBadge value={s.status} /></div>
        <p className="text-xs text-charcoal-500">{t("trade_licence")}: {s.tradeLicence}</p>
        <ul className="grid gap-1 text-sm">
          {s.docs.map((d, i) => <li key={i} className="flex justify-between rounded-lg bg-charcoal-50 px-3 py-2 dark:bg-charcoal-800"><span>{d.name}</span><span className="text-xs text-charcoal-500">{d.kind} · {d.sizeKb} KB</span></li>)}
        </ul>
        <label className="btn-ghost cursor-pointer justify-self-start">
          <Icon.upload size={16} />Upload document
          <input
            type="file"
            className="sr-only"
            accept=".pdf,image/jpeg,image/png"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              if (!["application/pdf", "image/jpeg", "image/png"].includes(file.type) || file.size > 5 * 1024 * 1024) return toast("PDF, JPG or PNG up to 5 MB", "err");
              await api.uploadSupplierDoc({ name: file.name, sizeKb: Math.round(file.size / 1024), kind: "other" });
              toast(t("saved_ok"));
            }}
          />
        </label>
        <p className="text-xs text-charcoal-500">Documents are visible only to platform administrators for verification.</p>
      </div>
    </div>
  );
}

function ApiAccess() {
  const toast = useToast();
  const { data: s } = useData(() => api.mySupplier());
  const [key, setKey] = useState<string | null>(null);
  const base = API_URL || "https://api.your-domain.ae";
  return (
    <div className="card grid gap-4 p-5">
      <h3 className="font-semibold">Inventory API (Method B)</h3>
      <p className="text-sm text-charcoal-600 dark:text-charcoal-400">Connect your existing stock system. Send your full or partial inventory; items are matched by <code>sku</code>. Price and stock changes update in place; deleted SKUs are marked sold.</p>
      {isDemo && <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-900 dark:bg-amber-950 dark:text-amber-200">Demo mode: keys generated here are for illustration only. The live endpoint is provided by the FastAPI backend.</p>}
      <div className="flex flex-wrap items-center gap-2">
        <button className="btn-navy" onClick={async () => { try { setKey(await api.regenerateApiKey()); } catch (e) { toast((e as Error).message, "err"); } }}>{s?.apiKey ? "Rotate API key" : "Generate API key"}</button>
        {key && <code className="break-all rounded-lg bg-charcoal-100 px-3 py-2 text-xs dark:bg-charcoal-800">{key}</code>}
      </div>
      {key && <p className="text-xs text-amber-700">Copy this key now — it will not be shown again.</p>}
      <pre className="overflow-x-auto rounded-xl bg-charcoal-950 p-4 text-xs text-charcoal-100">{`curl -X PUT ${base}/integrations/inventory \\
  -H "X-API-Key: <your key>" -H "Content-Type: application/json" \\
  -d '{"mode":"upsert","items":[{"sku":"SAJ-0001","part_type":"gearbox",
       "make":"Mercedes-Benz","model":"C-Class","year_from":2015,"year_to":2018,
       "engine_code":"M274","condition":"tested","price_aed":2750,"quantity":1}]}'

# Remove an item that was sold elsewhere
curl -X DELETE ${base}/integrations/inventory/SAJ-0001 -H "X-API-Key: <your key>"`}</pre>
      <p className="text-xs text-charcoal-500">Full OpenAPI docs: <code>{base}/docs</code></p>
    </div>
  );
}

function Dashboard() {
  const { t } = useI18n();
  const [tab, setTab] = useState<Tab>("overview");
  const { data: s } = useData(() => api.mySupplier());
  const reqs = useData(() => api.matchedRequests());
  const openReqs = reqs.data?.filter((r) => r.request.status === "open" && !r.myQuotation).length ?? 0;
  return (
    <>
      <PageHeader title={s?.name ?? t("supplier_dashboard")} sub={s ? `${s.address} · ${emirateLabel(s.emirate as Emirate)}` : undefined}>
        {s && <Link href={`/shop/?id=${s.id}`} className="btn-ghost btn-sm">{t("view_shop")}</Link>}
      </PageHeader>
      <div className="container-x py-6">
        {s?.status === "pending" && <p className="mb-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">{t("pending_review")}</p>}
        {s?.status === "suspended" && <p className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">{t("account_suspended")}</p>}
        <Tabs<Tab>
          value={tab}
          onChange={setTab}
          tabs={[
            { id: "overview", label: t("overview") },
            { id: "listings", label: t("listings") },
            { id: "import", label: t("import") },
            { id: "inquiries", label: t("inquiries") },
            { id: "requests", label: t("requests"), badge: openReqs },
            { id: "profile", label: t("profile") },
            { id: "api", label: t("api_access") },
          ]}
        />
        <div className="mt-6">
          {tab === "overview" && <Overview go={setTab} />}
          {tab === "listings" && <Listings />}
          {tab === "import" && <ImportTab />}
          {tab === "inquiries" && <SupplierInquiries />}
          {tab === "requests" && <SupplierRequests />}
          {tab === "profile" && <Profile />}
          {tab === "api" && <ApiAccess />}
        </div>
      </div>
    </>
  );
}

export default function SupplierDashboardPage() {
  return (
    <RequireRole roles={["supplier"]}>
      <Dashboard />
    </RequireRole>
  );
}

