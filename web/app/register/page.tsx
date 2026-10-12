"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api";
import { useToast } from "@/lib/hooks";
import { useI18n } from "@/lib/i18n";
import { Field } from "@/components/ui";

export default function RegisterPage() {
  const { t } = useI18n();
  const router = useRouter();
  const toast = useToast();
  const [f, setF] = useState({ name: "", email: "", phone: "", password: "", terms: false, marketing: false, whatsapp: true });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF((s) => ({ ...s, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!f.terms) return toast(t("consent_terms"), "err");
    setBusy(true);
    try {
      await api.registerCustomer({ name: f.name, email: f.email, phone: f.phone, password: f.password, marketingConsent: f.marketing, whatsappConsent: f.whatsapp });
      router.push("/account/");
    } catch (err) {
      toast((err as Error).message, "err");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="container-x flex justify-center py-16">
      <form onSubmit={submit} className="card grid w-full max-w-md gap-4 p-6">
        <h1 className="text-2xl font-bold text-navy-900 dark:text-white">{t("register_title")}</h1>
        <Field label={t("name")}><input className="input" required maxLength={80} autoComplete="name" value={f.name} onChange={set("name")} /></Field>
        <Field label={t("email")}><input className="input" type="email" required autoComplete="email" value={f.email} onChange={set("email")} /></Field>
        <Field label={t("phone")}><input className="input" type="tel" pattern="^\+?[0-9\s]{8,16}$" autoComplete="tel" placeholder="+971 5x xxx xxxx" value={f.phone} onChange={set("phone")} /></Field>
        <Field label={t("password")} hint="8+ characters"><input className="input" type="password" required minLength={8} autoComplete="new-password" value={f.password} onChange={set("password")} /></Field>
        <div className="space-y-2 text-sm">
          <label className="flex items-start gap-2"><input type="checkbox" className="mt-1" checked={f.terms} onChange={set("terms")} />{t("consent_terms")}</label>
          <label className="flex items-start gap-2"><input type="checkbox" className="mt-1" checked={f.whatsapp} onChange={set("whatsapp")} />{t("consent_whatsapp")}</label>
          <label className="flex items-start gap-2"><input type="checkbox" className="mt-1" checked={f.marketing} onChange={set("marketing")} />{t("consent_marketing")}</label>
        </div>
        <button className="btn-primary" disabled={busy}>{busy ? t("loading") : t("register")}</button>
        <p className="text-center text-sm text-charcoal-500">{t("have_account")} <Link href="/login/" className="font-semibold text-accent-600 hover:underline">{t("login")}</Link></p>
      </form>
    </div>
  );
}
