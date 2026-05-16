export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.WHATSAPP_AUTOSTART === "false") return;

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
