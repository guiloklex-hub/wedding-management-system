export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  if (process.env.WHATSAPP_AUTOSTART !== "false") {
    try {
      const { ensureWhatsAppStarted, startWatchdog } = await import(
        "@/lib/notifications/whatsapp"
      );
      startWatchdog();
      ensureWhatsAppStarted().catch((err) => {
        console.error("[whatsapp] autostart falhou:", err);
      });
    } catch (err) {
      console.error("[instrumentation] falha ao registrar WhatsApp:", err);
    }
  }

  // Retoma broadcasts (Save the Date) que ficaram pendentes antes de um restart.
  try {
    const { armBroadcastWorker, hasPendingBroadcast } = await import(
      "@/lib/notifications/broadcast-worker"
    );
    if (await hasPendingBroadcast()) armBroadcastWorker();
  } catch (err) {
    console.error("[broadcast] retomada no boot falhou:", err);
  }
}
