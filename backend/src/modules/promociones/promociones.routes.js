import { Router } from 'express';

/**
 * @param {import('./promociones.service.js').PromocionesService} promocionesService
 */
export function createPromocionesRouter(promocionesService) {
  const router = Router();

  router.get('/', (req, res, next) => {
    try {
      const { proveedorId } = req.query;
      const items = promocionesService.listarPromociones({ proveedorId });
      res.json({ items });
    } catch (error) {
      next(error);
    }
  });

  router.post('/', (req, res, next) => {
    try {
      const promocion = promocionesService.crearPromocion(req.body);
      res.status(201).json(promocion);
    } catch (error) {
      next(error);
    }
  });

  return router;
}

