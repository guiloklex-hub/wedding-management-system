import type { Vendor, BudgetItem, Payment, Asset } from "@prisma/client";

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
