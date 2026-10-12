"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api";
import { useToast } from "@/lib/hooks";
import { useI18n } from "@/lib/i18n";
import { EMIRATES, findEmirate } from "@/lib/data/emirates";
import { MAKES } from "@/lib/data/vehicles";
import { CATEGORIES } from "@/lib/data/taxonomy";
import { Field, PageHeader } from "@/components/ui";
import type { Emirate } from "@/lib/types";

function Multi({ options, value, onChange }: { options: { id: string; label: string }[]; value: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = value.includes(o.id);
        return (
          <button type="button" key={o.id} aria-pressed={on} onClick={() => onChange(on ? value.filter((x) => x !== o.id) : [...value, o.id])} className={`chip px-3 py-1.5 ring-1 ring-inset transition ${on ? "bg-navy-800 text-white ring-navy-800" : "bg-white text-charcoal-700 ring-charcoal-200 hover:ring-navy-300 dark:bg-charcoal-900 dark:text-charcoal-200 dark:ring-charcoal-700"}`}>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

const ALLOWED_DOC = ["application/pdf", "image/jpeg", "image/png"];

export default function SupplierRegisterPage() {
  const { t, lang } = useI18n();
  const router = useRouter();
  const toast = useToast();
  const [f, setF] = useState({
    businessName: "", businessNameAr: "", tradeLicence: "", contactName: "", phone: "", whatsapp: "", email: "", password: "",
    emirate: "sharjah" as Emirate, area: "al-sajaa", address: "", delivery: false, terms: false,
  });
  const [served, setServed] = useState<string[]>(["sharjah"]);
  const [makes, setMakes] = useState<string[]>([]);
  const [cats, setCats] = useState<string[]>([]);
  const [docs, setDocs] = useState<{ name: string; sizeKb: number }[]>([]);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setF((s) => ({ ...s, [k]: e.target.type === "checkbox" ? (e.target as HTMLInputElement).checked : e.target.value, ...(k === "emirate" ? { area: findEmirate(e.target.value)?.areas[0]?.id ?? "" } : {}) }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!f.terms) return toast(t("consent_terms"), "err");
    if (!makes.length || !cats.length) return toast(`${t("makes_handled")} / ${t("categories_handled")}`, "err");
    setBusy(true);
    try {
      await api.registerSupplier({
        businessName: f.businessName, businessNameAr: f.businessNameAr, tradeLicence: f.tradeLicence, contactName: f.contactName, phone: f.phone,
        whatsapp: f.whatsapp, email: f.email, password: f.password, emirate: f.emirate, area: f.area, address: f.address,
        emiratesServed: served as Emirate[], makes, categories: cats, delivery: f.delivery, docs,
      });
      toast(t("pending_review"));
      router.push("/dashboard/supplier/");
    } catch (err) {
      toast((err as Error).message, "err");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader title={t("supplier_reg_title")} sub={t("supplier_reg_sub")} />
      <form onSubmit={submit} className="container-x grid max-w-4xl gap-6 py-8">
        <section className="card grid gap-4 p-6 sm:grid-cols-2">
          <h2 className="font-semibold sm:col-span-2">1 · Business</h2>
          <Field label={t("business_name")}><input className="input" required maxLength={120} value={f.businessName} onChange={set("businessName")} /></Field>
          <Field label={t("business_name_ar")}><input className="input" dir="rtl" maxLength={120} value={f.businessNameAr} onChange={set("businessNameAr")} /></Field>
          <Field label={t("trade_licence")}><input className="input" required maxLength={40} value={f.tradeLicence} onChange={set("tradeLicence")} /></Field>
          <Field label={t("trade_licence_doc")} hint="Reviewed manually by our team. Never shown publicly.">
            <input
              type="file"
              required
              accept=".pdf,image/jpeg,image/png"
              className="block w-full text-sm file:me-3 file:rounded-lg file:border-0 file:bg-navy-50 file:px-3 file:py-2 file:font-semibold file:text-navy-800"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return setDocs([]);
                if (!ALLOWED_DOC.includes(file.type) || file.size > 5 * 1024 * 1024) {
                  e.target.value = "";
                  return toast("PDF, JPG or PNG up to 5 MB", "err");
                }
                setDocs([{ name: file.name, sizeKb: Math.round(file.size / 1024) }]);
              }}
            />
          </Field>
        </section>

        <section className="card grid gap-4 p-6 sm:grid-cols-2">
          <h2 className="font-semibold sm:col-span-2">2 · Location</h2>
          <Field label={t("emirate")}>
            <select className="input" value={f.emirate} onChange={set("emirate")}>
              {EMIRATES.map((e) => <option key={e.id} value={e.id}>{lang === "ar" ? e.ar : e.en}</option>)}
            </select>
          </Field>
          <Field label={t("area")}>
            <select className="input" value={f.area} onChange={set("area")}>
              {findEmirate(f.emirate)?.areas.map((a) => <option key={a.id} value={a.id}>{lang === "ar" ? a.ar : a.en}</option>)}
            </select>
          </Field>
          <Field label={t("shop_address")} className="sm:col-span-2"><input className="input" required maxLength={200} value={f.address} onChange={set("address")} placeholder="Shop no., street, landmark" /></Field>
          <div className="sm:col-span-2">
            <span className="label">{t("emirates_served")}</span>
            <Multi options={EMIRATES.map((e) => ({ id: e.id, label: lang === "ar" ? e.ar : e.en }))} value={served} onChange={setServed} />
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.delivery} onChange={set("delivery")} />{t("offers_delivery")}</label>
        </section>

        <section className="card grid gap-4 p-6">
          <h2 className="font-semibold">3 · Inventory</h2>
          <div><span className="label">{t("makes_handled")}</span><Multi options={MAKES.map((m) => ({ id: m.id, label: lang === "ar" ? m.nameAr : m.name }))} value={makes} onChange={setMakes} /></div>
          <div><span className="label">{t("categories_handled")}</span><Multi options={CATEGORIES.map((c) => ({ id: c.id, label: lang === "ar" ? c.ar : c.en }))} value={cats} onChange={setCats} /></div>
        </section>

        <section className="card grid gap-4 p-6 sm:grid-cols-2">
          <h2 className="font-semibold sm:col-span-2">4 · Account</h2>
          <Field label={t("contact_name")}><input className="input" required maxLength={80} value={f.contactName} onChange={set("contactName")} /></Field>
          <Field label={t("phone")}><input className="input" required type="tel" pattern="^\+?[0-9\s]{8,16}$" value={f.phone} onChange={set("phone")} /></Field>
          <Field label={t("whatsapp_number")} hint="International format, e.g. +971501234567"><input className="input" required type="tel" pattern="^\+?[0-9\s]{8,16}$" value={f.whatsapp} onChange={set("whatsapp")} /></Field>
          <Field label={t("email")}><input className="input" required type="email" autoComplete="email" value={f.email} onChange={set("email")} /></Field>
          <Field label={t("password")} hint="8+ characters"><input className="input" required type="password" minLength={8} autoComplete="new-password" value={f.password} onChange={set("password")} /></Field>
          <label className="flex items-start gap-2 text-sm sm:col-span-2"><input type="checkbox" className="mt-1" checked={f.terms} onChange={set("terms")} />{t("consent_terms")} — including the safety-critical parts policy and that listings must describe real stock you hold.</label>
        </section>
        <div className="flex justify-end"><button className="btn-primary px-6" disabled={busy}>{busy ? t("loading") : t("submit_application")}</button></div>
      </form>
    </>
  );
}
