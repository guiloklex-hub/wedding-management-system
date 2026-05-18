"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Globe, Lock, Loader2 } from "lucide-react";
import { updateLocale } from "@/app/actions/profileActions";
import { LOCALES, LOCALE_NATIVE_LABELS, type Locale } from "@/i18n/config";
import { useToast } from "@/components/toast";

type Initial = {
  name: string;
  email: string;
  locale: Locale;
};

export default function ProfileClient({ initial }: { initial: Initial }) {
  const t = useTranslations("common");
  const tn = useTranslations("common.nav");
  const toast = useToast();
  const [locale, setLocaleState] = useState<Locale>(initial.locale);
  const [state, formAction, pending] = useActionState(updateLocale, undefined);

  useEffect(() => {
    if (state?.success) {
      toast.success(tn("settings"));
      window.location.reload();
    } else if (state && !state.success) {
      toast.error(t("common.errorGeneric"), state.error);
    }
  }, [state, t, tn, toast]);

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-white">{t("labels.name")}</h2>
        <p className="mt-1 text-sm text-zinc-400">{initial.name || "—"}</p>
        <h2 className="mt-4 text-lg font-semibold text-white">{t("labels.email")}</h2>
        <p className="mt-1 text-sm text-zinc-400">{initial.email}</p>
      </section>

      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 shadow-xl">
        <div className="flex items-center gap-2">
          <Globe className="h-5 w-5 text-rose-400" />
          <h2 className="text-lg font-semibold text-white">{t("labels.language")}</h2>
        </div>
        <p className="mt-1 text-sm text-zinc-400">
          {useTranslations("common")("locale.selectHint")}
        </p>
        <form action={formAction} className="mt-4 flex items-end gap-3">
          <div className="flex-1">
            <select
              name="locale"
              value={locale}
              onChange={(e) => setLocaleState(e.target.value as Locale)}
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-rose-500/50"
            >
              {LOCALES.map((l) => (
                <option key={l} value={l}>
                  {LOCALE_NATIVE_LABELS[l]}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            disabled={pending || locale === initial.locale}
            className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-500 disabled:opacity-50"
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {t("actions.save")}
          </button>
        </form>
      </section>

      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 shadow-xl">
        <div className="flex items-center gap-2">
          <Lock className="h-5 w-5 text-rose-400" />
          <h2 className="text-lg font-semibold text-white">{t("actions.edit")}</h2>
        </div>
        <Link
          href="/dashboard/profile/change-password"
          className="mt-3 inline-block text-sm text-rose-400 hover:text-rose-300"
        >
          /dashboard/profile/change-password
        </Link>
      </section>
    </div>
  );
}
