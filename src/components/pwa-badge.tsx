"use client";

import { useEffect } from "react";

export function PWABadge({ count }: { count: number }) {
  useEffect(() => {
    if (typeof window === "undefined" || !("setAppBadge" in navigator)) return;

    // A Badging API funciona quando o PWA está instalado e roda sob HTTPS (Cloudflare Tunnels)
    try {
      if (count > 0) {
        navigator.setAppBadge(count).catch((err) => {
          console.warn("[PWA Badge] failed to set badge:", err);
        });
      } else {
        navigator.clearAppBadge().catch((err) => {
          console.warn("[PWA Badge] failed to clear badge:", err);
        });
      }
    } catch (err) {
      console.warn("[PWA Badge] error calling API:", err);
    }
  }, [count]);

  return null;
}
