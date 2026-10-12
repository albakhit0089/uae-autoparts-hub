"use client";

import Link from "next/link";
import { useState } from "react";
import { api } from "@/lib/api";
import { useAuth, useToast } from "@/lib/hooks";
import { useI18n } from "@/lib/i18n";
import { CATEGORIES } from "@/lib/data/taxonomy";
import { EMIRATES } from "@/lib/data/emirates";
import { Field, VehicleSelector, fileToResizedDataUrl, useMathChallenge, type VehicleValue } from "./ui";
import { Icon } from "./icons";
import type { Emirate } from "@/lib/types";

export function RequestForm({ compact = false, initial }: { compact?: boolean; initial?: VehicleValue & { partType?: string } }) {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const toast = useToast();
  const challenge = useMathChallenge();
  const [vehicle, setVehicle] = useState<VehicleValue>(initial ?? {});
  const [partTypeId, setPartTypeId] = useState(initial?.partType ?? "");
  const [f, setF] = useState({ partText: "", oem: "", emirate: "sharjah" as Emirate, budget: "", description: "", contactName: "", contactPhone: "", contactEmail: "", contactMethod: "whatsapp" as "whatsapp" | "phone" | "email", answer: "", website: "", terms: false, waConsent: true });
  const [images, setImages] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ matched: number } | null>(null);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setF((s) => ({ ...s, [k]: e.target.type === "checkbox" ? (e.target as HTMLInputElement).checked : e.target.value }));

  if (done) {
    return (
      <div className="card flex flex-col items-center gap-3 p-8 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700"><Icon.check size={26} /></div>
        <h3 className="text-lg font-bold">{t("request_sent")}</h3>
        <p className="text-sm text-charcoal-600 dark:text-charcoal-300">
          <strong>{done.matched}</strong> {t("request_matched")}
        </p>
        <p className="text-xs text-charcoal-500">{t("privacy_contact_note")}</p>
        {user?.role === "customer" ? (
          <Link href="/account/?tab=requests" className="btn-navy">{t("my_requests")}</Link>
        ) : (
          <p className="text-xs text-charcoal-500">Create an account with the same phone number to compare offers online, or wait for suppliers to reach you after selection.</p>
        )}
        <button className="btn-ghost btn-sm" onClick={() => setDone(null)}>+ {t("nav_request")}</button>
      </div>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (f.website) return; // honeypot
    if (!challenge.check(f.answer)) return toast(t("wrong_answer"), "err");
    if (!f.terms) return toast(t("consent_terms"), "err");
    if (!vehicle.make || !vehicle.model || !vehicle.year) return toast(`${t("make")} / ${t("model")} / ${t("year")}`, "err");
    setBusy(true);
    try {
      const r = await api.createRequest({
        make: vehicle.make, model: vehicle.model, year: vehicle.year, engine: vehicle.engine, partTypeId, partText: f.partText || partTypeId,
        oem: f.oem || undefined, emirate: f.emirate, budget: f.budget ? Number(f.budget) : undefined, description: f.description, images,
        contactName: f.contactName || user?.name || "", contactPhone: f.contactPhone, contactEmail: f.contactEmail || user?.email, contactMethod: f.contactMethod,
      });
      setDone({ matched: r.matchedCount });
    } catch (err) {
      toast((err as Error).message, "err");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className={`card grid gap-4 ${compact ? "p-5" : "p-6"}`}>
      <VehicleSelector value={vehicle} onChange={setVehicle} required />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t("required_part")}>
          <select className="input" required value={partTypeId} onChange={(e) => setPartTypeId(e.target.value)}>
            <option value="">{t("select")}</option>
            {CATEGORIES.map((c) => (
              <optgroup key={c.id} label={lang === "ar" ? c.ar : c.en}>
                {c.types.map((tp) => <option key={tp.id} value={tp.id}>{lang === "ar" ? tp.ar : tp.en}</option>)}
              </optgroup>
            ))}
          </select>
        </Field>
        <Field label={t("part_details")}>
          <input className="input" value={f.partText} onChange={set("partText")} maxLength={120} placeholder="e.g. rear left air strut" />
        </Field>
        <Field label={`${t("oem")} (optional)`}>
          <input className="input font-mono" value={f.oem} onChange={set("oem")} maxLength={40} />
        </Field>
        <Field label={t("emirate")}>
          <select className="input" value={f.emirate} onChange={set("emirate")}>
            {EMIRATES.map((e) => <option key={e.id} value={e.id}>{lang === "ar" ? e.ar : e.en}</option>)}
          </select>
        </Field>
        <Field label={t("budget")}>
          <input className="input" type="number" min={0} step={50} value={f.budget} onChange={set("budget")} />
        </Field>
        <Field label={t("contact_method")}>
          <select className="input" value={f.contactMethod} onChange={set("contactMethod")}>
            <option value="whatsapp">WhatsApp</option>
            <option value="phone">{t("phone")}</option>
            <option value="email">{t("email")}</option>
          </select>
        </Field>
      </div>
      {!compact && (
        <Field label={t("description")}>
          <textarea className="input min-h-24" value={f.description} onChange={set("description")} maxLength={1000} />
        </Field>
      )}
      {!compact && (
        <Field label={t("photos")}>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="block w-full text-sm file:me-3 file:rounded-lg file:border-0 file:bg-navy-50 file:px-3 file:py-2 file:font-semibold file:text-navy-800"
            onChange={async (e) => {
              const files = [...(e.target.files ?? [])].slice(0, 4);
              try {
                setImages(await Promise.all(files.map((x) => fileToResizedDataUrl(x, 800))));
              } catch (err) {
                toast((err as Error).message, "err");
              }
            }}
          />
          {!!images.length && (
            <div className="mt-2 flex gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {images.map((src, i) => <img key={i} src={src} alt="" className="h-16 w-16 rounded-lg object-cover" />)}
            </div>
          )}
        </Field>
      )}
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label={t("your_name")}>
          <input className="input" required value={f.contactName || (user?.name ?? "")} onChange={set("contactName")} maxLength={80} autoComplete="name" />
        </Field>
        <Field label={t("phone")}>
          <input className="input" required type="tel" pattern="^\+?[0-9\s]{8,16}$" placeholder="+971 5x xxx xxxx" value={f.contactPhone} onChange={set("contactPhone")} autoComplete="tel" />
        </Field>
        <Field label={`${t("anti_spam")}: ${t("anti_spam_q")} ${challenge.question}?`}>
          <input className="input" required inputMode="numeric" value={f.answer} onChange={set("answer")} />
        </Field>
      </div>
      <input type="text" name="website" value={f.website} onChange={set("website")} className="hidden" tabIndex={-1} autoComplete="off" aria-hidden />
      <div className="space-y-2 text-sm">
        <label className="flex items-start gap-2"><input type="checkbox" className="mt-1" checked={f.terms} onChange={set("terms")} /> <span>{t("consent_terms")} (<Link className="underline" href="/legal/privacy/">{t("privacy")}</Link>)</span></label>
        <label className="flex items-start gap-2"><input type="checkbox" className="mt-1" checked={f.waConsent} onChange={set("waConsent")} /> <span>{t("consent_whatsapp")}</span></label>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-center gap-1.5 text-xs text-charcoal-500"><Icon.shield size={14} />{t("privacy_contact_note")}</p>
        <button className="btn-primary" disabled={busy}>{busy ? t("loading") : t("submit_request")}</button>
      </div>
    </form>
  );
}
