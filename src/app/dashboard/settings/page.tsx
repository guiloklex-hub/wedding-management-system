import { getEventConfig } from "@/lib/event-config";
import { toIsoDate } from "@/lib/format";
import SettingsClient from "./settings-client";

export const dynamic = "force-dynamic";


export default async function SettingsPage() {
  const cfg = await getEventConfig();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">Ajustes</h1>
        <p className="text-sm text-zinc-500">Configurações gerais do casamento e do app.</p>
      </div>
      <SettingsClient
        initial={{
          eventDate: toIsoDate(cfg.eventDate),
          contingencyPercent: cfg.contingencyPercent,
          currency: cfg.currency,
          coupleNames: cfg.coupleNames ?? "",
        }}
      />
    </div>
  );
}
