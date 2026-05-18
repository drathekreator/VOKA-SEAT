import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { adminAuthMiddleware } from '../middleware/auth';
import { sanitizerMiddleware } from '../middleware/sanitizer';

/**
 * Creates the inventory REST API router.
 *
 * All routes are admin-only. `adminAuthMiddleware` enforces the role
 * guard directly: HTTP 401 on missing/invalid JWT, HTTP 403 on a valid
 * JWT that lacks `role: 'admin'` (Property 19 / Requirements 15.7,
 * 15.8, 21.6).
 *
 * GET / — returns all inventory items ordered by itemName
 * PATCH /:id — updates inventory item quantity
 */
export function createInventoryRouter(prisma: PrismaClient): Router {
  const router = Router();

  router.use(adminAuthMiddleware);
  router.use(sanitizerMiddleware);

  // GET /api/inventory — return inventory list with quantities and thresholds
  router.get('/', async (_req, res) => {
    try {
      const items = await prisma.inventory.findMany({
        orderBy: { itemName: 'asc' },
        select: {
          id: true,
          itemName: true,
          quantity: true,
          unit: true,
          minimumThreshold: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      res.json(items);
    } catch (error) {
      console.error('❌ Error fetching inventory:', error);
      res.status(500).json({ error: 'Failed to fetch inventory' });
    }
  });

  // PATCH /api/inventory/:id — update inventory item quantity
  router.patch('/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);

      if (isNaN(id)) {
        res.status(400).json({ error: 'Invalid inventory item ID' });
        return;
      }

      const { quantity } = req.body;

      // Validate quantity is a non-negative integer
      if (quantity === undefined || quantity === null) {
        res.status(400).json({ error: 'quantity is required' });
        return;
      }

      if (typeof quantity !== 'number' || !Number.isInteger(quantity) || quantity < 0) {
        res.status(400).json({ error: 'quantity must be a non-negative integer' });
        return;
      }

      // Check if item exists
      const existing = await prisma.inventory.findUnique({ where: { id } });

      if (!existing) {
        res.status(404).json({ error: 'Inventory item not found' });
        return;
      }

      const updated = await prisma.inventory.update({
        where: { id },
        data: { quantity },
        select: {
          id: true,
          itemName: true,
          quantity: true,
          unit: true,
          minimumThreshold: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      res.json(updated);
    } catch (error) {
      console.error('❌ Error updating inventory:', error);
      res.status(500).json({ error: 'Failed to update inventory item' });
    }
  });

  return router;
}
