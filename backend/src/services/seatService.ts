import { PrismaClient } from '@prisma/client';

/**
 * Upserts a seat record in the database.
 *
 * If the seat exists, updates its status.
 * If the seat does not exist, creates it with the given status.
 *
 * @param id - Seat identifier (1-24)
 * @param status - Seat status (0 = available, 1 = occupied)
 * @param prisma - PrismaClient instance (optional, uses default if not provided)
 * @returns The updated or created seat object
 * @throws On database errors (caller handles)
 */
export async function upsertSeat(id: number, status: number, prisma?: PrismaClient) {
  const client = prisma ?? defaultPrisma;
  const seat = await client.seat.upsert({
    where: { id },
    update: { status },
    create: { id, status, zone: getZoneForSeat(id) },
  });
  return seat;
}

/**
 * Determines the zone for a given seat ID based on the floor plan mapping.
 * - Seats 1-4: "left" (Barista dan Kasir)
 * - Seats 5-10: "center" (Meja Beton)
 * - Seats 11-24: "upper" (Kursi Tangga)
 */
function getZoneForSeat(id: number): string {
  if (id >= 1 && id <= 4) return 'left';
  if (id >= 5 && id <= 10) return 'center';
  return 'upper';
}

// Lazy-initialized default Prisma client
let defaultPrisma: PrismaClient;

/**
 * Sets the default PrismaClient instance used by the seat service.
 * Call this during server initialization.
 */
export function setSeatServicePrisma(prisma: PrismaClient) {
  defaultPrisma = prisma;
}
