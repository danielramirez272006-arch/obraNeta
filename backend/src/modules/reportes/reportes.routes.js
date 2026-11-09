import { Router } from 'express';

/**
 * @param {import('./reportes.service.js').ReportesService} reportesService
 */
export function createReportesRouter(reportesService) {
  const router = Router();

  router.get('/ahorros', (req, res, next) => {
    try {
      const { mes } = req.query;
      const resultado = reportesService.consultarAhorros({ mes });
      res.json(resultado);
    } catch (error) {
      next(error);
    }
  });

  router.get('/promociones-sin-uso', (req, res, next) => {
    try {
      const { fecha } = req.query;
      const resultado = reportesService.consultarPromocionesSinUso({ fecha });
      res.json(resultado);
    } catch (error) {
      next(error);
    }
  });

  return router;
}

