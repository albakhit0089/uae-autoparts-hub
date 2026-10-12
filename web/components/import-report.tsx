"use client";

import { useI18n } from "@/lib/i18n";
import type { ImportJob } from "@/lib/types";

export function ImportReport({ job }: { job: ImportJob }) {
  const { t } = useI18n();
  return (
    <div className="grid gap-3">
      <div className="grid grid-cols-4 gap-2 text-center">
        {[[t("created"), job.created, "text-emerald-600"], [t("updated"), job.updated, "text-navy-600"], [t("duplicates"), job.duplicates, "text-amber-600"], [t("errors"), job.errors.length - job.duplicates, "text-red-600"]].map(([l, n, c]) => (
          <div key={l as string} className="rounded-xl bg-charcoal-50 p-2 dark:bg-charcoal-800"><div className={`text-xl font-bold ${c}`}>{n}</div><div className="text-[11px] text-charcoal-500">{l}</div></div>
        ))}
      </div>
      <p className="text-xs text-charcoal-500">{job.filename} · {job.total} rows</p>
      {!!job.errors.length && (
        <div className="max-h-72 overflow-y-auto rounded-xl border border-charcoal-200 dark:border-charcoal-800">
          <table className="table-x">
            <thead><tr><th>{t("row")}</th><th>Issue</th></tr></thead>
            <tbody>{job.errors.map((e, i) => <tr key={i}><td className="tabular-nums">{e.row}</td><td className="text-xs">{e.message}</td></tr>)}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}
