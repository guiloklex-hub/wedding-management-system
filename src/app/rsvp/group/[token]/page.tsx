import { notFound } from "next/navigation";
import { getMessages, getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { getEventConfig } from "@/lib/event-config";
import { formatDate } from "@/i18n/format";
import { coerceLocale, isLocale } from "@/i18n/config";
import { RsvpLanding } from "../../_components/rsvp-landing";
import GroupRsvpForm from "./group-rsvp-form";

export const dynamic = "force-dynamic";

export default async function PublicGroupRsvpPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams?: Promise<{ lang?: string }>;
}) {
  const { token } = await params;
  const sp = await searchParams;
  const now = new Date();
  const group = await prisma.guestGroup.findFirst({
    where: {
      rsvpToken: token,
      deletedAt: null,
      OR: [{ rsvpTokenExpiresAt: null }, { rsvpTokenExpiresAt: { gt: now } }],
    },
    include: {
      guests: {
        where: { deletedAt: null },
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          rsvpStatus: true,
          plusOnesAllowed: true,
          plusOnesConfirmed: true,
          dietary: true,
          isChild: true,
          language: true,
        },
      },
    },
  });
  if (!group || group.guests.length === 0) return notFound();

  const cfg = await getEventConfig();

  const firstLang = group.guests.find((g) => isLocale(g.language))?.language;
  const locale = coerceLocale(
    isLocale(sp?.lang) ? sp.lang : isLocale(firstLang) ? firstLang : cfg.defaultLocale,
  );
  const messages = (await getMessages({ locale })) as Record<string, unknown>;
  const t = await getTranslations({ locale, namespace: "rsvp.group" });
  const tIndividual = await getTranslations({ locale, namespace: "rsvp.individual" });

  const dateLong = cfg.eventDate
    ? formatDate(cfg.eventDate, locale, { dateStyle: "long", timeZone: "UTC" })
    : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-950 via-zinc-950 to-zinc-950 px-4 py-10">
      <div className="mx-auto max-w-xl rounded-3xl border border-rose-500/20 bg-zinc-950/80 p-6 sm:p-8 shadow-2xl backdrop-blur">
        <p className="text-center text-xs uppercase tracking-widest text-rose-300">
          {cfg.coupleNames ? cfg.coupleNames : tIndividual("officialInvite")}
        </p>
        <h1 className="mt-2 text-center text-2xl font-bold text-white">
          {t("greeting", { name: group.name })}
        </h1>
        <p className="mt-3 text-center text-sm text-zinc-300">
          {dateLong
            ? t.rich("introWithDate", {
                date: dateLong,
                strong: (chunks) => (
                  <span className="font-semibold text-white">{chunks}</span>
                ),
              })
            : t("introWithoutDate")}
        </p>
        <RsvpLanding cfg={cfg} locale={locale} />
        <GroupRsvpForm group={group} locale={locale} messages={messages} />
      </div>
      <p className="mt-6 text-center text-[11px] text-zinc-600">{tIndividual("footer")}</p>
    </div>
  );
}
