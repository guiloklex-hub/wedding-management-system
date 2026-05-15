import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getEventConfig, isOnboardingComplete } from "@/lib/event-config";
import { toIsoDate } from "@/lib/format";
import OnboardingClient from "./onboarding-client";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (role !== "ADMIN") redirect("/dashboard");

  const cfg = await getEventConfig();
  if (isOnboardingComplete(cfg)) redirect("/dashboard");

  return (
    <OnboardingClient
      initial={{
        coupleNames: cfg.coupleNames ?? "",
        eventDate: toIsoDate(cfg.eventDate),
        currency: cfg.currency,
        contingencyPercent: cfg.contingencyPercent,
      }}
    />
  );
}
