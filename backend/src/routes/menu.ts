import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { sanitizerMiddleware } from '../middleware/sanitizer';

/**
 * Creates the menu REST API router.
 * GET / — returns full menu catalog (optionally filtered by category query param).
 * No authentication required.
 */
export function createMenuRouter(prisma: PrismaClient): Router {
  const router = Router();

  // Apply sanitizer middleware to sanitize query params
  router.use(sanitizerMiddleware);

  // GET /api/menu — return menu items, optionally filtered by category
  router.get('/', async (req, res) => {
    try {
      const { category } = req.query;

      const where: Record<string, unknown> = {};

      if (category && typeof category === 'string' && category.trim() !== '') {
        where.category = {
          equals: category,
          mode: 'insensitive',
        };
      }

      const items = await prisma.menuItem.findMany({
        where,
        orderBy: [
          { category: 'asc' },
          { name: 'asc' },
        ],
        select: {
          id: true,
          name: true,
          description: true,
          price: true,
          category: true,
          imageUrl: true,
          isAvailable: true,
        },
      });

      // Convert Decimal price to number for JSON response
      const result = items.map((item) => ({
        ...item,
        price: Number(item.price),
      }));

      res.json(result);
    } catch (error) {
      console.error('❌ Error fetching menu items:', error);
      res.status(500).json({ error: 'Failed to fetch menu items' });
    }
  });

  return router;
}
