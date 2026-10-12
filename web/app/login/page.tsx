"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, isDemo } from "@/lib/api";
import { useToast } from "@/lib/hooks";
import { useI18n } from "@/lib/i18n";
import { Field } from "@/components/ui";
import { DEMO_PASSWORD } from "@/lib/data/seed";

export default function LoginPage() {
  const { t } = useI18n();
  const router = useRouter();
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const u = await api.login(email, password);
      router.push(u.role === "admin" ? "/dashboard/admin/" : u.role === "supplier" ? "/dashboard/supplier/" : "/account/");
    } catch (err) {
      toast((err as Error).message, "err");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="container-x flex justify-center py-16">
      <div className="w-full max-w-md">
        <form onSubmit={submit} className="card grid gap-4 p-6">
          <h1 className="text-2xl font-bold text-navy-900 dark:text-white">{t("login_title")}</h1>
          <Field label={t("email")}><input className="input" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
          <Field label={t("password")}><input className="input" type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
          <button className="btn-primary" disabled={busy}>{busy ? t("loading") : t("login")}</button>
          <p className="text-center text-sm text-charcoal-500">
            {t("no_account")} <Link href="/register/" className="font-semibold text-accent-600 hover:underline">{t("register")}</Link> · <Link href="/register/supplier/" className="font-semibold text-accent-600 hover:underline">{t("supplier_register")}</Link>
          </p>
        </form>
        {isDemo && (
          <div className="card mt-4 p-4 text-sm">
            <p className="mb-2 font-semibold">{t("demo_accounts")} <span className="font-normal text-charcoal-500">(password <code>{DEMO_PASSWORD}</code>)</span></p>
            <div className="grid gap-2 sm:grid-cols-3">
              {["customer@demo.ae", "supplier@demo.ae", "admin@demo.ae"].map((em) => (
                <button key={em} type="button" className="btn-ghost btn-sm" onClick={() => { setEmail(em); setPassword(DEMO_PASSWORD); }}>{em.split("@")[0]}</button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
