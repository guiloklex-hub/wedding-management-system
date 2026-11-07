import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  serverExternalPackages: ["@whiskeysockets/baileys"],
  redirects() {
    return [
      {
        source: "/dashboard/save-the-date",
        destination: "/dashboard/communications/save-the-date",
        permanent: true,
      },
      {
        source: "/dashboard/invitations",
        destination: "/dashboard/communications/invitations",
        permanent: true,
      },
    ];
  },
  experimental: {
    // Uploads via Server Action (anexos, arte do Save the Date) chegam a 10 MB.
    // O padrão do Next é 1 MB, o que causava "Body exceeded 1 MB limit" (413).
    serverActions: {
      bodySizeLimit: "12mb",
    },
  },
};

export default withNextIntl(nextConfig);
