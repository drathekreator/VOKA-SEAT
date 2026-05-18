import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Seed the database with:
 *   - 24 seats with zone assignments
 *   - 8 menu items with product photos
 *   - 7 inventory rows
 *
 * Uses upsert throughout — safe to run multiple times.
 */
async function main() {
  // ===================================================================
  // 1. Seats (24 total)
  // ===================================================================
  const seats: Array<{ id: number; zone: string }> = [];

  // Zona Kiri: Seats 1-4 (Barista dan Kasir)
  for (let i = 1; i <= 4; i++) seats.push({ id: i, zone: "left" });
  // Zona Tengah & Kanan: Seats 5-10 (Meja Beton)
  for (let i = 5; i <= 10; i++) seats.push({ id: i, zone: "center" });
  // Zona Atas: Seats 11-24 (Kursi Tangga)
  for (let i = 11; i <= 24; i++) seats.push({ id: i, zone: "upper" });

  for (const seat of seats) {
    await prisma.seat.upsert({
      where: { id: seat.id },
      update: { zone: seat.zone },
      create: { id: seat.id, status: 0, zone: seat.zone },
    });
  }
  console.log(`✅ Seeded ${seats.length} seats.`);

  // ===================================================================
  // 2. Menu Items (8 total)
  // ===================================================================
  const menuItems = [
    {
      id: 1,
      name: "Iced Latte",
      description: "Smooth espresso over cold milk and ice.",
      price: 25000,
      category: "Coffee",
      imageUrl: "/product_photo/iced_latte.png",
      isAvailable: true,
    },
    {
      id: 2,
      name: "Cappuccino",
      description: "Espresso topped with steamed milk and rich foam.",
      price: 22000,
      category: "Coffee",
      imageUrl: "/product_photo/cappuccino.png",
      isAvailable: true,
    },
    {
      id: 3,
      name: "Americano",
      description: "Bold espresso lengthened with hot water.",
      price: 18000,
      category: "Coffee",
      imageUrl: "/product_photo/americano.png",
      isAvailable: true,
    },
    {
      id: 4,
      name: "Matcha Latte",
      description: "Stone-ground Japanese matcha with creamy milk.",
      price: 28000,
      category: "Tea",
      imageUrl: "/product_photo/matcha_latte.png",
      isAvailable: true,
    },
    {
      id: 5,
      name: "Earl Grey",
      description: "Fragrant black tea with bergamot oil.",
      price: 16000,
      category: "Tea",
      imageUrl: "/product_photo/earl_grey.png",
      isAvailable: true,
    },
    {
      id: 6,
      name: "Almond Croissant",
      description: "Flaky croissant filled with almond cream.",
      price: 20000,
      category: "Pastry",
      imageUrl: "/product_photo/almond_croissant.png",
      isAvailable: true,
    },
    {
      id: 7,
      name: "Pain au Chocolat",
      description: "Buttery laminated dough with dark chocolate.",
      price: 19000,
      category: "Pastry",
      imageUrl: "/product_photo/pain_au_chocolat.png",
      isAvailable: true,
    },
    {
      id: 8,
      name: "Seasonal Cold Brew",
      description: "Limited edition slow-brewed cold coffee.",
      price: 30000,
      category: "Coffee",
      imageUrl: "/product_photo/seasonal_cold_brew.png",
      isAvailable: false,
    },
  ];

  for (const item of menuItems) {
    await prisma.menuItem.upsert({
      where: { id: item.id },
      update: {
        name: item.name,
        description: item.description,
        price: item.price,
        category: item.category,
        imageUrl: item.imageUrl,
        isAvailable: item.isAvailable,
      },
      create: item,
    });
  }
  console.log(`✅ Seeded ${menuItems.length} menu items.`);

  // ===================================================================
  // 3. Inventory (7 items)
  // ===================================================================
  const inventoryItems = [
    { id: 1, itemName: "Espresso Beans", unit: "kg", quantity: 5, minThreshold: 2 },
    { id: 2, itemName: "Whole Milk", unit: "liter", quantity: 20, minThreshold: 5 },
    { id: 3, itemName: "Matcha Powder", unit: "pack", quantity: 3, minThreshold: 2 },
    { id: 4, itemName: "Earl Grey Leaves", unit: "pack", quantity: 4, minThreshold: 2 },
    { id: 5, itemName: "Croissant Dough", unit: "batch", quantity: 1, minThreshold: 2 },
    { id: 6, itemName: "Almond Cream", unit: "kg", quantity: 2, minThreshold: 1 },
    { id: 7, itemName: "Dark Chocolate", unit: "kg", quantity: 3, minThreshold: 1 },
  ];

  for (const inv of inventoryItems) {
    await prisma.inventory.upsert({
      where: { id: inv.id },
      update: {
        itemName: inv.itemName,
        unit: inv.unit,
        quantity: inv.quantity,
        minThreshold: inv.minThreshold,
      },
      create: inv,
    });
  }
  console.log(`✅ Seeded ${inventoryItems.length} inventory items.`);
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
