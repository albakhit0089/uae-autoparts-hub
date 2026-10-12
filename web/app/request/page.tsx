"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { useI18n } from "@/lib/i18n";
import { PageHeader } from "@/components/ui";
import { RequestForm } from "@/components/request-form";

function Inner() {
  const sp = useSearchParams();
  const { t } = useI18n();
  const initial = {
    make: sp.get("make") || undefined,
    model: sp.get("model") || undefined,
    year: sp.get("year") ? Number(sp.get("year")) : undefined,
    partType: sp.get("partType") || undefined,
  };
  return (
    <>
      <PageHeader title={t("request_title")} sub={t("request_sub")} />
      <div className="container-x max-w-4xl py-8">
        <RequestForm initial={initial} />
      </div>
    </>
  );
}

export default function RequestPage() {
  return (
    <Suspense fallback={null}>
      <Inner />
    </Suspense>
  );
}
