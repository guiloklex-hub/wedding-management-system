import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { getEventConfig } from "@/lib/event-config";
import { formatDate } from "@/i18n/format";
import { coerceLocale, isLocale } from "@/i18n/config";
import { RsvpLanding } from "../_components/rsvp-landing";
import { PinGateForm } from "../_components/pin-gate-form";
import { verifyRsvpPinCookie } from "@/lib/rsvp-pin-auth";
import RsvpForm from "./rsvp-form";

export const dynamic = "force-dynamic";

export default async function PublicRsvpPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams?: Promise<{ lang?: string }>;
}) {
  const { token } = await params;
  const sp = await searchParams;
  const now = new Date();
  const guest = await prisma.guest.findFirst({
    where: {
      rsvpToken: token,
      deletedAt: null,
      OR: [{ rsvpTokenExpiresAt: null }, { rsvpTokenExpiresAt: { gt: now } }],
    },
  });
  if (!guest) return notFound();

  const cfg = await getEventConfig();

  const locale = coerceLocale(
    isLocale(sp?.lang)
      ? sp.lang
      : isLocale(guest.language)
        ? guest.language
        : cfg.defaultLocale,
  );

  if (guest.rsvpPin) {
    const isPinVerified = await verifyRsvpPinCookie(token);
    if (!isPinVerified) {
      const tPin = await getTranslations({ locale, namespace: "rsvp.pin" });
      const tIndiv = await getTranslations({ locale, namespace: "rsvp.individual" });
      return (
        <div className="min-h-screen bg-gradient-to-br from-rose-950 via-zinc-950 to-zinc-950 px-4 py-10">
          <div className="mx-auto max-w-md rounded-3xl border border-rose-500/20 bg-zinc-950/80 p-8 shadow-2xl backdrop-blur">
            <p className="text-center text-xs uppercase tracking-widest text-rose-300">
              {cfg.coupleNames ? cfg.coupleNames : tIndiv("officialInvite")}
            </p>
            <h1 className="mt-2 text-center text-2xl font-bold text-white">
              {tPin("title")}
            </h1>
            <PinGateForm
              token={token}
              type="individual"
              labels={{
                title: tPin("title"),
                description: tPin("description"),
                placeholder: tPin("placeholder"),
                submit: tPin("submit"),
              }}
            />
          </div>
        </div>
      );
    }
  }

  const t = await getTranslations({ locale, namespace: "rsvp.individual" });

  const labels = {
    question: t("question"),
    choiceYes: t("choices.yes"),
    choiceMaybe: t("choices.maybe"),
    choiceNo: t("choices.no"),
    plusOnes: t("plusOnes"),
    plusOnesAllowed: t("plusOnesAllowed", { max: guest.plusOnesAllowed }),
    dietary: t("dietary"),
    dietaryPlaceholder: t("dietaryPlaceholder"),
    notes: t("notes"),
    submit: t("submit"),
    resultConfirmed: t("result.confirmed"),
    resultDeclined: t("result.declined"),
    resultMaybe: t("result.maybe"),
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-950 via-zinc-950 to-zinc-950 px-4 py-10">
      <div className="mx-auto max-w-md rounded-3xl border border-rose-500/20 bg-zinc-950/80 p-8 shadow-2xl backdrop-blur">
        <p className="text-center text-xs uppercase tracking-widest text-rose-300">
          {cfg.coupleNames ? cfg.coupleNames : t("officialInvite")}
        </p>
        <h1 className="mt-2 text-center text-2xl font-bold text-white">
          {t("greeting", { name: guest.name })}
        </h1>
        <p className="mt-3 text-center text-sm text-zinc-300">
          {t("intro")}
          {cfg.eventDate ? (
            <>
              {" "}
              <span className="font-semibold text-white">
                {formatDate(cfg.eventDate, locale, { dateStyle: "long", timeZone: "UTC" })}
              </span>
            </>
          ) : null}
          .
        </p>
        <RsvpLanding cfg={cfg} locale={locale} />
        <RsvpForm guest={guest} labels={labels} />
      </div>
      <p className="mt-6 text-center text-[11px] text-zinc-600">{t("footer")}</p>
    </div>
  );
}
