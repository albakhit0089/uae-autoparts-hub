"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { api } from "@/lib/api";
import { useAuth, useData, useToast } from "@/lib/hooks";
import { useI18n } from "@/lib/i18n";
import { makeLabel, modelLabel } from "@/lib/data/vehicles";
import { partTypeLabel } from "@/lib/data/taxonomy";
import { emirateLabel } from "@/lib/data/emirates";
import { ConditionBadge, Empty, PageHeader, PartCard, PartGrid, RequireRole, StatusBadge, Tabs, VehicleSelector, useAgo, type VehicleValue } from "@/components/ui";
import { Icon } from "@/components/icons";

type Tab = "requests" | "favourites" | "vehicles" | "inquiries" | "preferences";

function Requests() {
  const { t, lang, fmtPrice } = useI18n();
  const toast = useToast();
  const ago = useAgo();
  const { data } = useData(() => api.myRequests());
  const suppliers = useData(() => api.listSuppliers());
  const name = (id: string) => suppliers.data?.find((s) => s.id === id)?.name ?? id;
  if (!data) return <p className="text-charcoal-500">{t("loading")}</p>;
  if (!data.length) return <Empty><p>{t("nothing_here")}</p><Link href="/request/" className="btn-primary btn-sm">{t("nav_request")}</Link></Empty>;
  return (
    <div className="grid gap-4">
      {data.map(({ request: r, quotations }) => (
        <div key={r.id} className="card p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2"><StatusBadge value={r.status} /><span className="text-xs text-charcoal-500">{ago(r.createdAt)} · #{r.id}</span></div>
              <h3 className="mt-1 text-lg font-semibold">{partTypeLabel(r.partTypeId, lang)} — {makeLabel(r.make, lang)} {modelLabel(r.make, r.model, lang)} {r.year}</h3>
              <p className="text-sm text-charcoal-500">{r.partText} · {emirateLabel(r.emirate, lang)}{r.budget ? ` · ≤ ${fmtPrice(r.budget)}` : ""}</p>
            </div>
            {r.status === "open" && <button className="btn-ghost btn-sm" onClick={() => api.closeRequest(r.id)}>{t("close_request")}</button>}
          </div>
          <h4 className="mb-2 mt-4 text-sm font-semibold">{t("offers")} ({quotations.length})</h4>
          {!quotations.length ? (
            <p className="text-sm text-charcoal-500">{t("no_offers_yet")}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="table-x min-w-[640px]">
                <thead><tr><th>{t("price")}</th><th>{t("supplier")}</th><th>{t("condition")}</th><th>{t("warranty")}</th><th>{t("availability")}</th><th>{t("delivery_days")}</th><th>{t("note")}</th><th></th></tr></thead>
                <tbody>
                  {quotations.map((q, i) => (
                    <tr key={q.id}>
                      <td className="font-bold tabular-nums">{fmtPrice(q.price)}{i === 0 && <span className="chip ms-1 bg-emerald-50 text-emerald-700">Lowest</span>}</td>
                      <td>{name(q.supplierId)}</td>
                      <td><ConditionBadge value={q.condition} /></td>
                      <td>{q.warrantyDays ? `${q.warrantyDays}d` : "—"}</td>
                      <td>{q.availability === "in-stock" ? t("in_stock") : q.availability === "1-3-days" ? t("days_1_3") : t("on_order")}</td>
                      <td>{q.deliveryDays}</td>
                      <td className="max-w-48 text-xs text-charcoal-600 dark:text-charcoal-400">{q.note}</td>
                      <td>
                        {q.status === "submitted" && r.status === "open" ? (
                          <button
                            className="btn-whatsapp btn-sm"
                            onClick={async () => {
                              const w = window.open("", "_blank");
                              try {
                                const res = await api.acceptQuotation(q.id);
                                if (w) w.location.href = res.url;
                                toast(t("accepted"));
                              } catch (e) {
                                w?.close();
                                toast((e as Error).message, "err");
                              }
                            }}
                          >
                            <Icon.whatsapp size={14} />{t("accept_offer")}
                          </button>
                        ) : (
                          <StatusBadge value={q.status} />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function Favourites() {
  const { t } = useI18n();
  const { data } = useData(() => api.favourites());
  if (!data) return <p className="text-charcoal-500">{t("loading")}</p>;
  if (!data.parts.length) return <Empty>{t("nothing_here")}</Empty>;
  return <PartGrid>{data.parts.map((p) => <PartCard key={p.id} part={p} supplier={data.suppliers[p.supplierId]} />)}</PartGrid>;
}

function Vehicles() {
  const { t, lang } = useI18n();
  const toast = useToast();
  const { data } = useData(() => api.savedVehicles());
  const [v, setV] = useState<VehicleValue>({});
  const [vin, setVin] = useState("");
  return (
    <div className="grid gap-4">
      {data?.map((x) => (
        <div key={x.id} className="card flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="flex items-center gap-3">
            <Icon.car size={22} className="text-navy-600" />
            <div>
              <div className="font-semibold">{makeLabel(x.make, lang)} {modelLabel(x.make, x.model, lang)} {x.year}</div>
              <div className="text-xs text-charcoal-500">{x.engine ?? ""} {x.vin ? `· VIN ${x.vin}` : ""}</div>
            </div>
          </div>
          <div className="flex gap-2">
            <Link className="btn-navy btn-sm" href={`/search/?make=${x.make}&model=${x.model}&year=${x.year}${x.engine ? `&engine=${encodeURIComponent(x.engine)}` : ""}`}>{t("find_for_vehicle")}</Link>
            <button className="btn-ghost btn-sm" onClick={() => api.removeVehicle(x.id)}>{t("remove")}</button>
          </div>
        </div>
      ))}
      <form
        className="card grid gap-3 p-5"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!v.make || !v.model || !v.year) return toast(`${t("make")} / ${t("model")} / ${t("year")}`, "err");
          try {
            await api.addVehicle({ make: v.make, model: v.model, year: v.year, engine: v.engine, vin: vin || undefined });
            setV({});
            setVin("");
          } catch (err) {
            toast((err as Error).message, "err");
          }
        }}
      >
        <h3 className="font-semibold">{t("add_vehicle")}</h3>
        <VehicleSelector value={v} onChange={setV} />
        <label><span className="label">{t("vin")}</span><input className="input font-mono uppercase" maxLength={17} value={vin} onChange={(e) => setVin(e.target.value)} /></label>
        <button className="btn-primary justify-self-start"><Icon.plus size={16} />{t("add_vehicle")}</button>
      </form>
    </div>
  );
}

function Inquiries() {
  const { t, lang, fmtPrice } = useI18n();
  const ago = useAgo();
  const { data } = useData(() => api.myInquiries());
  if (!data) return <p className="text-charcoal-500">{t("loading")}</p>;
  if (!data.length) return <Empty>{t("nothing_here")}</Empty>;
  return (
    <div className="card overflow-x-auto">
      <table className="table-x">
        <thead><tr><th>{t("part")}</th><th>{t("price")}</th><th>WhatsApp</th></tr></thead>
        <tbody>
          {data.map(({ inquiry: i, part: p }) => (
            <tr key={i.id}>
              <td>{p ? <Link className="font-medium hover:underline" href={`/part/?id=${p.id}`}>{partTypeLabel(p.partTypeId, lang)} · {makeLabel(p.make, lang)} {modelLabel(p.make, p.model, lang)}</Link> : "—"}</td>
              <td>{p ? fmtPrice(p.price) : "—"}</td>
              <td className="text-xs text-charcoal-500">{ago(i.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Preferences() {
  const { t } = useI18n();
  const { user } = useAuth();
  const toast = useToast();
  const router = useRouter();
  const [p, setP] = useState({ name: user?.name ?? "", phone: user?.phone ?? "", marketingConsent: !!user?.marketingConsent, whatsappConsent: !!user?.whatsappConsent });
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <form
        className="card grid gap-3 p-5"
        onSubmit={async (e) => {
          e.preventDefault();
          await api.updatePreferences(p);
          toast(t("saved_ok"));
        }}
      >
        <h3 className="font-semibold">{t("preferences")}</h3>
        <label><span className="label">{t("name")}</span><input className="input" value={p.name} onChange={(e) => setP({ ...p, name: e.target.value })} /></label>
        <label><span className="label">{t("phone")}</span><input className="input" value={p.phone} onChange={(e) => setP({ ...p, phone: e.target.value })} /></label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={p.whatsappConsent} onChange={(e) => setP({ ...p, whatsappConsent: e.target.checked })} />{t("consent_whatsapp")}</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={p.marketingConsent} onChange={(e) => setP({ ...p, marketingConsent: e.target.checked })} />{t("consent_marketing")}</label>
        <button className="btn-primary justify-self-start">{t("save")}</button>
      </form>
      <div className="card grid content-start gap-3 p-5">
        <h3 className="font-semibold">Your data</h3>
        <p className="text-sm text-charcoal-600 dark:text-charcoal-400">Download a copy of your data or delete your account. Deleting removes your saved vehicles and favourites and anonymises your requests.</p>
        <button
          className="btn-ghost justify-self-start"
          onClick={async () => {
            const blob = new Blob([JSON.stringify({ user: await api.currentUser(), vehicles: await api.savedVehicles(), requests: await api.myRequests(), inquiries: await api.myInquiries() }, null, 2)], { type: "application/json" });
            const a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            a.download = "my-uae-autoparts-data.json";
            a.click();
          }}
        >
          <Icon.download size={16} />Export my data
        </button>
        <button
          className="btn justify-self-start bg-red-600 text-white hover:bg-red-700"
          onClick={async () => {
            if (!confirm(t("delete_account_confirm"))) return;
            await api.deleteAccount();
            router.push("/");
          }}
        >
          {t("delete_account")}
        </button>
      </div>
    </div>
  );
}

function AccountInner() {
  const { t } = useI18n();
  const { user } = useAuth();
  const sp = useSearchParams();
  const [tab, setTab] = useState<Tab>((sp.get("tab") as Tab) || "requests");
  return (
    <>
      <PageHeader title={`${t("my_account")}`} sub={user?.email}>
        <Link href="/request/" className="btn-primary btn-sm"><Icon.plus size={16} />{t("nav_request")}</Link>
      </PageHeader>
      <div className="container-x py-6">
        <Tabs<Tab>
          value={tab}
          onChange={setTab}
          tabs={[
            { id: "requests", label: t("my_requests") },
            { id: "favourites", label: t("favourites") },
            { id: "vehicles", label: t("my_vehicles") },
            { id: "inquiries", label: t("inquiry_history") },
            { id: "preferences", label: t("preferences") },
          ]}
        />
        <div className="mt-6">
          {tab === "requests" && <Requests />}
          {tab === "favourites" && <Favourites />}
          {tab === "vehicles" && <Vehicles />}
          {tab === "inquiries" && <Inquiries />}
          {tab === "preferences" && <Preferences />}
        </div>
      </div>
    </>
  );
}

export default function AccountPage() {
  return (
    <RequireRole roles={["customer"]}>
      <Suspense fallback={null}>
        <AccountInner />
      </Suspense>
    </RequireRole>
  );
}
