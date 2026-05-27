import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { GuestImportClient } from "./import-client";

export const dynamic = "force-dynamic";

export default async function GuestImportPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return <GuestImportClient />;
}
