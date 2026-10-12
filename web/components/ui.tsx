"use client";

import Link from "next/link";
import { useEffect, useId, useState } from "react";
import { CategoryGlyph, Icon } from "./icons";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/hooks";
import { emirateLabel, areaLabel } from "@/lib/data/emirates";
import { makeLabel, modelLabel, MAKES, findModel, yearsFor, variantsFor } from "@/lib/data/vehicles";
import { partTypeLabel } from "@/lib/data/taxonomy";
import type { Compatibility, Part, Role, Supplier } from "@/lib/types";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";
export const href = (p: string) => p; // Next <Link> already applies basePath
export const asset = (p: string) => `${BASE}${p}`;

// ------------------------------------------------------------------ images

const CAT_TONES: Record<string, string> = {
  engine: "from-navy-800 to-navy-600",
  transmission: "from-navy-900 to-charcoal-700",
  electrical: "from-charcoal-800 to-navy-700",
  brakes: "from-charcoal-900 to-charcoal-700",
  suspension: "from-navy-700 to-navy-500",
  body: "from-charcoal-700 to-navy-600",
  cooling: "from-navy-600 to-navy-400",
  wheels: "from-charcoal-800 to-charcoal-600",
  interior: "from-navy-800 to-charcoal-600",
};

export function PartImage({ part, className = "", large = false, index = 0 }: { part: Pick<Part, "images" | "categoryId" | "isSample">; className?: string; large?: boolean; index?: number }) {
  const { t } = useI18n();
  const src = part.images[index] ?? part.images[0];
  if (src && !src.startsWith("sample:")) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt="" className={`h-full w-full object-cover ${className}`} loading="lazy" />;
  }
  const cat = src?.slice(7) || part.categoryId;
  return (
    <div className={`relative flex h-full w-full items-center justify-center bg-gradient-to-br ${CAT_TONES[cat] ?? CAT_TONES.engine} text-white/90 ${className}`}>
      <div className="absolute inset-0 opacity-[0.08] [background-image:radial-gradient(circle_at_1px_1px,white_1px,transparent_0)] [background-size:14px_14px]" />
      <CategoryGlyph id={cat} size={large ? 120 : 64} />
      <span className="absolute bottom-2 start-2 rounded bg-black/35 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-white/90">
        {t("sample_record")}
      </span>
    </div>
  );
}

// ------------------------------------------------------------------ badges

export function CompatBadge({ value, withHelp = false }: { value: Compatibility; withHelp?: boolean }) {
  const { t } = useI18n();
  const styles = {
    verified: "bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-950 dark:text-emerald-300",
    likely: "bg-sky-50 text-sky-700 ring-sky-600/20 dark:bg-sky-950 dark:text-sky-300",
    confirm: "bg-amber-50 text-amber-800 ring-amber-600/20 dark:bg-amber-950 dark:text-amber-300",
  }[value];
  return (
    <span className={`chip ring-1 ring-inset ${styles}`} title={t(`compat_${value}_d` as const)}>
      {value === "verified" ? <Icon.shield size={13} /> : value === "likely" ? <Icon.check size={13} /> : <Icon.alert size={13} />}
      {t(`compat_${value}` as const)}
      {withHelp && <span className="sr-only">: {t(`compat_${value}_d` as const)}</span>}
    </span>
  );
}

export function ConditionBadge({ value }: { value: Part["condition"] }) {
  const { t } = useI18n();
  return <span className="chip bg-charcoal-100 text-charcoal-700 dark:bg-charcoal-800 dark:text-charcoal-200">{t(`cond_${value}` as const)}</span>;
}

export function StatusBadge({ value }: { value: string }) {
  const { t } = useI18n();
  const map: Record<string, string> = {
    available: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
    approved: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
    accepted: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
    open: "bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
    submitted: "bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
    reserved: "bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
    pending: "bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
    sold: "bg-charcoal-100 text-charcoal-600 dark:bg-charcoal-800 dark:text-charcoal-300",
    closed: "bg-charcoal-100 text-charcoal-600 dark:bg-charcoal-800 dark:text-charcoal-300",
    declined: "bg-charcoal-100 text-charcoal-600 dark:bg-charcoal-800 dark:text-charcoal-300",
    rejected: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300",
    suspended: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300",
  };
  const label = (["available", "reserved", "sold"].includes(value) ? t(`status_${value}` as "status_sold") : value) as string;
  return <span className={`chip capitalize ${map[value] ?? "bg-charcoal-100 text-charcoal-700"}`}>{label}</span>;
}

export function useAgo() {
  const { t, lang } = useI18n();
  return (iso: string) => {
    const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
    if (days <= 0) return t("today");
    if (lang === "ar") return days === 1 ? "منذ يوم" : `منذ ${days} ${t("days")}`;
    return days === 1 ? "1 day ago" : `${days} ${t("days")} ${t("ago")}`;
  };
}

// --------------------------------------------------------------- part card

export function PartCard({ part, supplier, compatibility }: { part: Part; supplier?: Supplier; compatibility?: Compatibility }) {
  const { t, lang, fmtPrice } = useI18n();
  const ago = useAgo();
  return (
    <Link href={`/part/?id=${part.id}`} className="card group flex flex-col overflow-hidden transition hover:-translate-y-0.5 hover:shadow-lg animate-in">
      <div className="relative aspect-[4/3] overflow-hidden">
        <PartImage part={part} className="transition duration-300 group-hover:scale-[1.03]" />
        {part.featured && <span className="chip absolute top-2 end-2 bg-accent-500 text-white shadow">★</span>}
        {part.status === "reserved" && <span className="chip absolute top-2 start-2 bg-amber-400 text-amber-950">{t("status_reserved")}</span>}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex flex-wrap items-center gap-1.5">
          <ConditionBadge value={part.condition} />
          {compatibility && <CompatBadge value={compatibility} />}
        </div>
        <h3 className="line-clamp-2 font-semibold leading-snug text-navy-900 dark:text-white">
          {partTypeLabel(part.partTypeId, lang)} · {makeLabel(part.make, lang)} {modelLabel(part.make, part.model, lang)}
        </h3>
        <p className="text-xs text-charcoal-500 dark:text-charcoal-400">
          {part.generation ? `${part.generation} · ` : ""}
          {part.yearFrom}–{part.yearTo}
          {part.engine ? ` · ${part.engine}` : ""}
        </p>
        <div className="mt-auto flex items-end justify-between gap-2 pt-2">
          <div>
            <div className="text-lg font-bold text-navy-900 dark:text-white">{fmtPrice(part.price)}</div>
            <div className="text-xs text-charcoal-500">{part.warrantyDays > 0 ? `${part.warrantyDays} ${t("days_warranty")}` : t("no_warranty")}</div>
          </div>
          <div className="text-end text-xs text-charcoal-500 dark:text-charcoal-400">
            <div className="flex items-center justify-end gap-1"><Icon.pin size={12} />{emirateLabel(part.emirate, lang)}</div>
            <div className="flex items-center justify-end gap-1"><Icon.clock size={12} />{ago(part.lastVerified)}</div>
          </div>
        </div>
        {supplier && <div className="truncate border-t border-charcoal-100 pt-2 text-xs text-charcoal-500 dark:border-charcoal-800">{lang === "ar" && supplier.nameAr ? supplier.nameAr : supplier.name}</div>}
      </div>
    </Link>
  );
}

export function PartGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{children}</div>;
}

export function CardSkeleton({ n = 4 }: { n?: number }) {
  return (
    <PartGrid>
      {Array.from({ length: n }, (_, i) => (
        <div key={i} className="card h-80 animate-pulse bg-charcoal-100 dark:bg-charcoal-800" />
      ))}
    </PartGrid>
  );
}

// -------------------------------------------------------------- form bits

export function Field({ label, children, hint, className = "" }: { label: string; children: React.ReactNode; hint?: string; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="label">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-charcoal-500">{hint}</span>}
    </label>
  );
}

export interface VehicleValue {
  make?: string;
  model?: string;
  year?: number;
  engine?: string;
}

/** Hierarchical Make → Model → Year → Engine selector driven by the vehicle catalogue. */
export function VehicleSelector({ value, onChange, required = false, compact = false, showEngine = true }: { value: VehicleValue; onChange: (v: VehicleValue) => void; required?: boolean; compact?: boolean; showEngine?: boolean }) {
  const { t, lang } = useI18n();
  const make = MAKES.find((m) => m.id === value.make);
  const years = yearsFor(value.make, value.model);
  const variants = variantsFor(value.make, value.model, value.year);
  const engines = [...new Map(variants.map((v) => [v.engineCode, v])).values()];
  const cls = compact ? "input py-3" : "input";
  return (
    <div className={`grid gap-3 ${showEngine ? "grid-cols-2 md:grid-cols-4" : "grid-cols-1 sm:grid-cols-3"}`}>
      <Field label={t("make")}>
        <select className={cls} required={required} value={value.make ?? ""} onChange={(e) => onChange({ make: e.target.value || undefined })}>
          <option value="">{t("any")}</option>
          {MAKES.map((m) => (
            <option key={m.id} value={m.id}>{lang === "ar" ? m.nameAr : m.name}</option>
          ))}
        </select>
      </Field>
      <Field label={t("model")}>
        <select className={cls} required={required} disabled={!make} value={value.model ?? ""} onChange={(e) => onChange({ make: value.make, model: e.target.value || undefined })}>
          <option value="">{t("any")}</option>
          {make?.models.map((m) => (
            <option key={m.id} value={m.id}>{lang === "ar" ? m.nameAr : m.name}</option>
          ))}
        </select>
      </Field>
      <Field label={t("year")}>
        <select className={cls} required={required} disabled={!value.model} value={value.year ?? ""} onChange={(e) => onChange({ make: value.make, model: value.model, year: e.target.value ? Number(e.target.value) : undefined })}>
          <option value="">{t("any")}</option>
          {years.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </Field>
      {showEngine && (
        <Field label={t("engine")}>
          <select className={cls} disabled={!value.year} value={value.engine ?? ""} onChange={(e) => onChange({ ...value, engine: e.target.value || undefined })}>
            <option value="">{t("any")}</option>
            {engines.map((v) => {
              const names = variants.filter((x) => x.engineCode === v.engineCode).map((x) => x.name).join(" / ");
              const gen = findModel(value.make, value.model)?.generations.find((g) => g.variants.includes(v))?.code;
              return (
                <option key={v.engineCode} value={v.engineCode}>
                  {names} · {v.engineCode} · {v.capacity}L {gen ? `(${gen})` : ""}
                </option>
              );
            })}
          </select>
        </Field>
      )}
    </div>
  );
}

// -------------------------------------------------------------- layout bits

export function PageHeader({ title, sub, children }: { title: string; sub?: string; children?: React.ReactNode }) {
  return (
    <div className="border-b border-charcoal-200 bg-white dark:border-charcoal-800 dark:bg-charcoal-900">
      <div className="container-x flex flex-col gap-3 py-8 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-navy-900 sm:text-3xl dark:text-white">{title}</h1>
          {sub && <p className="mt-1 max-w-2xl text-sm text-charcoal-500 dark:text-charcoal-400">{sub}</p>}
        </div>
        {children}
      </div>
    </div>
  );
}

export function Empty({ children, icon }: { children: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="card flex flex-col items-center gap-3 px-6 py-12 text-center text-sm text-charcoal-500">
      {icon ?? <Icon.search size={28} className="text-charcoal-300" />}
      {children}
    </div>
  );
}

export function Stat({ label, value, tone = "navy", hint }: { label: string; value: React.ReactNode; tone?: "navy" | "accent" | "amber" | "green"; hint?: string }) {
  const tones = { navy: "text-navy-800 dark:text-white", accent: "text-accent-600", amber: "text-amber-600", green: "text-emerald-600" };
  return (
    <div className="card p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-charcoal-500">{label}</div>
      <div className={`mt-1 text-2xl font-bold tabular-nums ${tones[tone]}`}>{value}</div>
      {hint && <div className="mt-0.5 text-xs text-charcoal-500">{hint}</div>}
    </div>
  );
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { id: T; label: string; badge?: number }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0" role="tablist">
      <div className="flex min-w-max gap-1 rounded-xl bg-charcoal-100 p-1 dark:bg-charcoal-800">
        {tabs.map((tb) => (
          <button
            key={tb.id}
            role="tab"
            aria-selected={value === tb.id}
            onClick={() => onChange(tb.id)}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition ${value === tb.id ? "bg-white text-navy-900 shadow-sm dark:bg-charcoal-950 dark:text-white" : "text-charcoal-600 hover:text-navy-900 dark:text-charcoal-300 dark:hover:text-white"}`}
          >
            {tb.label}
            {!!tb.badge && <span className="rounded-full bg-accent-500 px-1.5 text-[10px] font-bold text-white">{tb.badge}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}

export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  const id = useId();
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby={id} className="card max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-b-none p-5 sm:rounded-2xl animate-in" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 id={id} className="text-lg font-bold text-navy-900 dark:text-white">{title}</h2>
          <button className="btn-ghost btn-sm" onClick={onClose} aria-label="Close"><Icon.close size={16} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function SupplierLine({ supplier }: { supplier: Supplier }) {
  const { lang } = useI18n();
  return (
    <span className="inline-flex items-center gap-1 text-sm text-charcoal-600 dark:text-charcoal-300">
      <Icon.pin size={14} /> {areaLabel(supplier.emirate, supplier.area, lang)}, {emirateLabel(supplier.emirate, lang)}
    </span>
  );
}

/** Client-side guard. Real authorization is enforced by the API (and RLS in Postgres). */
export function RequireRole({ roles, children }: { roles: Role[]; children: React.ReactNode }) {
  const { user, ready } = useAuth();
  const { t } = useI18n();
  if (!ready) return <div className="container-x py-16 text-center text-charcoal-500">{t("loading")}</div>;
  if (!user || !roles.includes(user.role)) {
    return (
      <div className="container-x py-16">
        <Empty icon={<Icon.user size={28} className="text-charcoal-300" />}>
          <p>{t("login_required")}</p>
          <Link href="/login/" className="btn-primary">{t("login")}</Link>
        </Empty>
      </div>
    );
  }
  return <>{children}</>;
}

/** Reads an image file, downsizes it in the browser and returns a JPEG data URL. */
export async function fileToResizedDataUrl(file: File, max = 900): Promise<string> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error("Only JPG, PNG or WebP images are allowed");
  if (file.size > 8 * 1024 * 1024) throw new Error("Image is larger than 8 MB");
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => rej(new Error("Could not read image"));
      i.src = url;
    });
    const scale = Math.min(1, max / Math.max(img.width, img.height));
    const c = document.createElement("canvas");
    c.width = Math.round(img.width * scale);
    c.height = Math.round(img.height * scale);
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", 0.78);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function useMathChallenge() {
  const [pair, setPair] = useState<[number, number]>([3, 4]);
  useEffect(() => setPair([2 + Math.floor(Math.random() * 7), 1 + Math.floor(Math.random() * 8)]), []);
  return { question: `${pair[0]} + ${pair[1]}`, check: (v: string) => Number(v) === pair[0] + pair[1] };
}
