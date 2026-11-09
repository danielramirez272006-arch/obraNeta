import cors from 'cors';
import express from 'express';
import { createDatabase } from './db/connection.js';
import { NotFoundError, errorHandler } from './http/errors.js';
import { CatalogosRepository, createCatalogosRouter } from './modules/catalogos/catalogos.routes.js';
import { OrdenesRepository } from './modules/ordenes/ordenes.repository.js';
import { createOrdenesRouter } from './modules/ordenes/ordenes.routes.js';
import { OrdenesService } from './modules/ordenes/ordenes.service.js';
import { PromocionesRepository } from './modules/promociones/promociones.repository.js';
import { createPromocionesRouter } from './modules/promociones/promociones.routes.js';
import { PromocionesService } from './modules/promociones/promociones.service.js';
import { ReportesRepository } from './modules/reportes/reportes.repository.js';
import { createReportesRouter } from './modules/reportes/reportes.routes.js';
import { ReportesService } from './modules/reportes/reportes.service.js';

/**
 * Crea y configura la aplicación Express inyectando dependencias.
 * Soporta base SQLite temporal / en memoria para pruebas de integración rápidas
 * o pool de conexiones MySQL 8.4 para entorno persistente con Docker.
 *
 * @param {object} [options]
 * @param {any} [options.db] Instancia SQLite o adaptador DB
 * @param {string} [options.dbPath=':memory:'] Ruta SQLite
 * @param {boolean} [options.seed=true] Cargar semillas
 */
export function createApp({ db: providedDb, dbPath = ':memory:', seed = true } = {}) {
  const db = providedDb ?? createDatabase({ dbPath, initialize: true, seed });

  const catalogosRepo = new CatalogosRepository(db);
  const promocionesRepo = new PromocionesRepository(db);
  const promocionesService = new PromocionesService(promocionesRepo);

  const ordenesRepo = new OrdenesRepository(db);
  const ordenesService = new OrdenesService(ordenesRepo, promocionesRepo);

  const reportesRepo = new ReportesRepository(db);
  const reportesService = new ReportesService(reportesRepo);

  const app = express();
  app.locals.db = db;
  app.locals.services = {
    promocionesService,
    ordenesService,
    reportesService
  };

  app.use(cors());
  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', service: 'obraneta-api' });
  });

  const catalogosRouter = createCatalogosRouter(catalogosRepo);
  app.use('/api/catalogos', catalogosRouter);
  app.get('/api/proveedores', (req, res, next) => {
    req.url = '/proveedores';
    catalogosRouter(req, res, next);
  });
  app.get('/api/categorias', (req, res, next) => {
    req.url = '/categorias';
    catalogosRouter(req, res, next);
  });
  app.get('/api/articulos', (req, res, next) => {
    req.url = '/articulos';
    catalogosRouter(req, res, next);
  });

  app.use('/api/promociones', createPromocionesRouter(promocionesService));
  app.use('/api/ordenes', createOrdenesRouter(ordenesService));
  app.use('/api/reportes', createReportesRouter(reportesService));

  app.use('/api', (req, _res, next) => {
    next(new NotFoundError(`Ruta no encontrada: ${req.method} ${req.originalUrl}`));
  });

  app.use(errorHandler);

  return { app, db, services: app.locals.services };
}
