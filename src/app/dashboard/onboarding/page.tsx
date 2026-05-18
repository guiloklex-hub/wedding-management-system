import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getEventConfig, isOnboardingComplete } from "@/lib/event-config";
import { toIsoDate } from "@/lib/format";
import OnboardingClient from "./onboarding-client";
import AlreadyDone from "./already-done";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (role !== "ADMIN") redirect("/dashboard");

  const cfg = await getEventConfig();
  if (isOnboardingComplete(cfg)) {
    return <AlreadyDone />;
  }

  return (
    <OnboardingClient
      initial={{
        coupleNames: cfg.coupleNames ?? "",
        eventDate: toIsoDate(cfg.eventDate),
        currency: cfg.currency,
        contingencyPercent: cfg.contingencyPercent,
        locale: cfg.defaultLocale,
      }}
    />
  );
}
