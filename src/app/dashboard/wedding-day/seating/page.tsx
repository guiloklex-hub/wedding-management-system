import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import SeatingClient from "./seating-client";

export const dynamic = "force-dynamic";

export default async function SeatingPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const [tables, guests] = await Promise.all([
    prisma.seatingTable.findMany({
      orderBy: { createdAt: "asc" },
    }),
    prisma.guest.findMany({
      where: { rsvpStatus: "CONFIRMED" },
      select: {
        id: true,
        name: true,
        plusOnesConfirmed: true,
        isChild: true,
        isVIP: true,
        tableId: true,
        groupName: true,
      },
      orderBy: { name: "asc" },
    }),
  ]);

  return <SeatingClient initialTables={tables} initialGuests={guests} />;
}
