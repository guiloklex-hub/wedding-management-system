import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import GroupsClient from "./groups-client";

export const dynamic = "force-dynamic";

export default async function GuestGroupsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const [groups, allGuests] = await Promise.all([
    prisma.guestGroup.findMany({
      where: { deletedAt: null },
      include: {
        guests: {
          where: { deletedAt: null },
          orderBy: { name: "asc" },
          select: { id: true, name: true, phone: true, email: true, rsvpStatus: true },
        },
      },
      orderBy: { name: "asc" },
    }),
    prisma.guest.findMany({
      where: { deletedAt: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true, groupId: true, rsvpStatus: true },
    }),
  ]);

  return <GroupsClient initialGroups={groups} allGuests={allGuests} />;
}
