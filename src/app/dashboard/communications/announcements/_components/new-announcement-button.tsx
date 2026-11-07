"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Loader2, Plus } from "lucide-react";
import { useToast } from "@/components/toast";
import { createAnnouncementDraft } from "@/app/actions/announcementActions";

export function NewAnnouncementButton() {
  const t = useTranslations("dashboard.announcements.list");
  const tc = useTranslations("common");
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          const res = await createAnnouncementDraft();
          if (!res.success || !res.data) {
            toast.error(tc("common.errorGeneric"), res.success ? undefined : res.error);
            return;
          }
          router.push(`/dashboard/communications/announcements/${res.data.id}`);
        } finally {
          setBusy(false);
        }
      }}
      className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-500 disabled:opacity-50"
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
      {t("new")}
    </button>
  );
}
