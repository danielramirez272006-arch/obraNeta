import { Router } from 'express';

/**
 * @param {import('./ordenes.service.js').OrdenesService} ordenesService
 */
export function createOrdenesRouter(ordenesService) {
  const router = Router();

  router.get('/', (_req, res, next) => {
    try {
      const items = ordenesService.listarOrdenes();
      res.json({ items });
    } catch (error) {
      next(error);
    }
  });

  router.post('/', (req, res, next) => {
    try {
      const resultado = ordenesService.registrarOrden(req.body);
      res.status(201).json(resultado);
    } catch (error) {
      next(error);
    }
  });

  router.get('/:id', (req, res, next) => {
    try {
      const orden = ordenesService.obtenerOrden(req.params.id);
      res.json(orden);
    } catch (error) {
      next(error);
    }
  });

  router.get('/:id/auditoria', (req, res, next) => {
    try {
      const auditoria = ordenesService.obtenerAuditoriaOrden(req.params.id);
      res.json(auditoria);
    } catch (error) {
      next(error);
    }
  });

  return router;
}

