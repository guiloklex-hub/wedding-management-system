import type { Vendor, BudgetItem, Payment, Asset } from "@prisma/client";
import type { Role } from "@/lib/permissions";
import type { Locale } from "@/i18n/config";

export type VendorStatus = "NEGOTIATION" | "CONTRACTED" | "FINALIZED";
export type PaymentStatus = "PENDING" | "PAID";
export type PaymentMethod = "PIX" | "BOLETO" | "CREDIT" | "TRANSFER" | "CASH";

export type VendorWithChildren = Vendor & {
  budgetItems: BudgetItem[];
  payments: Payment[];
};

export type PaymentWithVendor = Payment & {
  vendor: Vendor;
};

export type ActionResult<T = unknown> =
  | { success: true; data?: T }
  | { success: false; error: string };

export type { Vendor, BudgetItem, Payment, Asset };
export type { Role };
export type { Locale };

declare module "next-auth" {
  interface User {
    id: string;
    role?: string;
    mustChangePassword?: boolean;
    onboardingCompleted?: boolean;
    locale?: Locale;
  }
  interface Session {
    user: {
      id: string;
      email?: string | null;
      name?: string | null;
      role?: Role;
      mustChangePassword?: boolean;
      onboardingCompleted?: boolean;
      locale?: Locale;
    };
  }
}
