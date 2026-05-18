// Seed runner that uses the same Prisma adapter pattern as the server.
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const bcrypt = require('bcrypt');

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const seats = [];
  for (let i = 1; i <= 4; i++) seats.push({ id: i, zone: 'left' });
  for (let i = 5; i <= 10; i++) seats.push({ id: i, zone: 'center' });
  for (let i = 11; i <= 24; i++) seats.push({ id: i, zone: 'upper' });

  for (const seat of seats) {
    await prisma.seat.upsert({
      where: { id: seat.id },
      update: { zone: seat.zone },
      create: { id: seat.id, status: 0, zone: seat.zone },
    });
  }
  console.log(`✓ Seeded ${seats.length} seats`);

  const menu = [
    { name: 'Espresso', description: 'Single shot of rich, bold espresso.', price: 18000, category: 'Coffee', imageUrl: '/icons.svg', isAvailable: true },
    { name: 'Cappuccino', description: 'Espresso with steamed milk and foam.', price: 25000, category: 'Coffee', imageUrl: '/icons.svg', isAvailable: true },
    { name: 'Latte', description: 'Smooth espresso with steamed milk.', price: 27000, category: 'Coffee', imageUrl: '/icons.svg', isAvailable: true },
    { name: 'Americano', description: 'Espresso diluted with hot water.', price: 20000, category: 'Coffee', imageUrl: '/icons.svg', isAvailable: true },
    { name: 'Iced Matcha Latte', description: 'Premium matcha with chilled milk over ice.', price: 32000, category: 'Tea', imageUrl: '/icons.svg', isAvailable: true },
    { name: 'Hot Chocolate', description: 'Classic creamy hot chocolate.', price: 28000, category: 'Beverage', imageUrl: '/icons.svg', isAvailable: true },
    { name: 'Croissant', description: 'Buttery, flaky French pastry.', price: 22000, category: 'Pastry', imageUrl: '/icons.svg', isAvailable: true },
    { name: 'Chocolate Cake', description: 'Rich, moist chocolate layer cake.', price: 35000, category: 'Dessert', imageUrl: '/icons.svg', isAvailable: true },
  ];
  for (const item of menu) {
    const existing = await prisma.menuItem.findFirst({ where: { name: item.name } });
    if (existing) {
      await prisma.menuItem.update({ where: { id: existing.id }, data: item });
    } else {
      await prisma.menuItem.create({ data: item });
    }
  }
  console.log(`✓ Seeded ${menu.length} menu items`);

  const inventory = [
    { itemName: 'Coffee Beans', unit: 'kg', quantity: 25, minimumThreshold: 5 },
    { itemName: 'Milk', unit: 'L', quantity: 12, minimumThreshold: 8 },
    { itemName: 'Sugar', unit: 'kg', quantity: 3, minimumThreshold: 5 },
    { itemName: 'Chocolate Syrup', unit: 'bottle', quantity: 0, minimumThreshold: 2 },
    { itemName: 'Matcha Powder', unit: 'g', quantity: 800, minimumThreshold: 200 },
  ];
  for (const item of inventory) {
    await prisma.inventory.upsert({
      where: { itemName: item.itemName },
      update: item,
      create: item,
    });
  }
  console.log(`✓ Seeded ${inventory.length} inventory items`);

  const passwordHash = await bcrypt.hash('password123', 10);
  await prisma.user.upsert({
    where: { nim: '12345678' },
    update: { passwordHash, name: 'Demo User' },
    create: { nim: '12345678', passwordHash, name: 'Demo User' },
  });
  console.log('✓ Seeded demo user (NIM=12345678 / password=password123)');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    prisma.$disconnect();
    pool.end();
  });
